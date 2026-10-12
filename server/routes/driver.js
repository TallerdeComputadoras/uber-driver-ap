const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User');
const FuelPrice = require('../models/FuelPrice');
const authMiddleware = require('../middleware/auth');
const { sendTransferNotification } = require('../utils/email');

// Require authentication for all driver routes
router.use(authMiddleware);

// Protect routes: verify driver or admin role
const driverAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(403).json({ message: 'Usuario no encontrado' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Su cuenta ha sido dada de baja por la administración.' });
    }
    // Drivers and admins can access driver routes
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register pre-trip data (start shift)
// @route   POST /api/driver/pre-trip
// @access  Private (driver)
router.post('/pre-trip', driverAuth, async (req, res) => {
  try {
    // Verificar que no haya una jornada ya abierta
    const openTrip = await Trip.findOne({ driver: req.user.id, isFinished: false, isCancelled: { $ne: true } });
    if (openTrip) {
      return res.status(400).json({ message: 'Ya tenés una jornada abierta. Debés cerrarla antes de iniciar una nueva.' });
    }

    const { startFuelLevel } = req.body;
    // Al iniciar turno ya no se ingresan kilómetros del auto, solo nivel de combustible (opcional)
    const trip = new Trip({
      driver: req.user.id,
      startFuelLevel: startFuelLevel !== undefined && startFuelLevel !== '' ? Number(startFuelLevel) : 0,
      date: new Date(),
      isFinished: false,
    });
    await trip.save();
    res.status(201).json({ message: 'Turno iniciado con éxito', trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Register post-trip data (end shift)
// @route   POST /api/driver/post-trip
// @access  Private (driver)
router.post('/post-trip', driverAuth, async (req, res) => {
  try {
    const { kilometersDone, moneyObtained, endFuelLevel, fuelLitersAdded, endMileage } = req.body;

    // Solo validar que se ingrese dinero recaudado
    if (moneyObtained === undefined || moneyObtained === '') {
      return res.status(400).json({ message: 'Por favor ingresa el dinero recaudado' });
    }

    const parsedKm = kilometersDone !== undefined && kilometersDone !== ''
      ? Number(kilometersDone)
      : (endMileage !== undefined && endMileage !== '' ? Number(endMileage) : 0);

    // Buscar turno activo no finalizado del chofer
    let activeTrip = await Trip.findOne({ driver: req.user.id, isFinished: false, isCancelled: { $ne: true } }).sort({ createdAt: -1 });

    if (!activeTrip) {
      // Si no inició turno previamente con pre-trip, crear uno nuevo directamente
      activeTrip = new Trip({
        driver: req.user.id,
        date: new Date(),
      });
    }

    if (parsedKm > 0) activeTrip.kilometersDone = parsedKm;
    activeTrip.moneyObtained = Number(moneyObtained);
    if (endMileage !== undefined && endMileage !== '') activeTrip.endMileage = Number(endMileage);
    if (endFuelLevel !== undefined && endFuelLevel !== '') activeTrip.endFuelLevel = Number(endFuelLevel);
    if (fuelLitersAdded !== undefined && fuelLitersAdded !== '') activeTrip.fuelLitersAdded = Number(fuelLitersAdded);
    activeTrip.isFinished = true;
    activeTrip.transferStatus = activeTrip.transferStatus || 'pending';

    await activeTrip.save();

    res.json({
      message: 'Turno finalizado con éxito',
      trip: activeTrip,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Informar que la transferencia del turno fue realizada
// @route   POST /api/driver/trip/:id/report-transfer
// @access  Private (driver)
router.post('/trip/:id/report-transfer', driverAuth, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, driver: req.user.id });
    if (!trip) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    trip.transferStatus = 'paid_pending_approval';
    trip.transferReportedAt = new Date();
    await trip.save();

    // Notificar al Administrador por correo
    const driver = await User.findById(req.user.id);
    sendTransferNotification({
      driverName: driver ? driver.name : 'Conductor',
      driverEmail: driver ? driver.email : 'N/A',
      tripDate: trip.date,
      carWearAmount: trip.carWearAmount || 0,
      carReplacementAmount: trip.carReplacementAmount || 0,
      totalTransferAmount: trip.totalTransferAmount || 0,
      tripId: trip._id,
    }).catch((err) => console.error('Error background email:', err));

    res.json({
      message: 'Transferencia informada correctamente. Estado: Falta aprobación.',
      trip,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Obtener lista de turnos propios del chofer
// @route   GET /api/driver/my-trips
// @access  Private (driver)
router.get('/my-trips', driverAuth, async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get statistics for a driver (or any driver)
// @route   GET /api/driver/stats
// @access  Private
router.get('/stats', driverAuth, async (req, res) => {
  try {
    const { driverId, period } = req.query;
    let filter = {};
    if (driverId && driverId !== 'undefined' && driverId !== 'null') {
      filter.driver = driverId;
    } else {
      filter.driver = req.user.id;
    }

    // Exclude cancelled trips from statistics
    filter.isCancelled = { $ne: true };

    const now = new Date();
    let startDate;

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === 'week') {
      const day = now.getDay() || 7;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    }

    if (startDate) {
      filter.date = { $gte: startDate };
    }

    const trips = await Trip.find(filter).sort({ date: 1 });

    let totalKm = 0;
    let totalMoney = 0;
    let totalFuelCost = 0;
    let totalCarWear = 0;
    let totalCarReplacement = 0;
    let totalTransfers = 0;
    let pendingApprovalTransfersCount = 0;
    let tripCount = trips.length;

    trips.forEach((trip) => {
      if (trip.kilometersDone) totalKm += trip.kilometersDone;
      if (trip.moneyObtained) totalMoney += trip.moneyObtained;
      if (trip.fuelCost) totalFuelCost += trip.fuelCost;
      if (trip.carWearAmount) totalCarWear += trip.carWearAmount;
      if (trip.carReplacementAmount) totalCarReplacement += trip.carReplacementAmount;
      if (trip.totalTransferAmount) totalTransfers += trip.totalTransferAmount;
      if (trip.transferStatus === 'paid_pending_approval') {
        pendingApprovalTransfersCount += 1;
      }
    });

    res.json({
      period: period || 'month',
      driverId: filter.driver,
      tripCount,
      totalKilometers: totalKm,
      totalMoneyObtained: totalMoney,
      totalFuelCost,
      netProfit: Math.max(0, totalMoney - totalFuelCost),
      totalCarWear,
      totalCarReplacement,
      totalTransfers,
      pendingApprovalTransfersCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Eliminar una jornada propia (solo si no está aprobada)
// @route   DELETE /api/driver/trip/:id
// @access  Private (driver)
router.delete('/trip/:id', driverAuth, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, driver: req.user.id });
    if (!trip) {
      return res.status(404).json({ message: 'Jornada no encontrada' });
    }
    if (trip.transferStatus === 'approved') {
      return res.status(400).json({ message: 'No se puede eliminar una jornada con transferencia aprobada.' });
    }
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ message: 'Jornada eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Editar datos de una jornada propia (solo si no está aprobada)
// @route   PUT /api/driver/trip/:id
// @access  Private (driver)
router.put('/trip/:id', driverAuth, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, driver: req.user.id });
    if (!trip) {
      return res.status(404).json({ message: 'Jornada no encontrada' });
    }
    if (trip.transferStatus === 'approved') {
      return res.status(400).json({ message: 'No se puede editar una jornada con transferencia aprobada.' });
    }

    const { kilometersDone, moneyObtained, startFuelLevel, endFuelLevel, fuelLitersAdded } = req.body;

    if (kilometersDone !== undefined) trip.kilometersDone = Number(kilometersDone);
    if (moneyObtained !== undefined) trip.moneyObtained = Number(moneyObtained);
    if (startFuelLevel !== undefined) trip.startFuelLevel = Number(startFuelLevel);
    if (endFuelLevel !== undefined) trip.endFuelLevel = Number(endFuelLevel);
    if (fuelLitersAdded !== undefined) trip.fuelLitersAdded = Number(fuelLitersAdded);

    await trip.save();
    res.json({ message: 'Jornada actualizada correctamente.', trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
