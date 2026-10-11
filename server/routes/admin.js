const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trip = require('../models/Trip');
const FuelPrice = require('../models/FuelPrice');
const authMiddleware = require('../middleware/auth');

// Public route to get current fuel price
router.get('/fuel-price', async (req, res) => {
  try {
    const price = await FuelPrice.getCurrentPrice();
    res.json({ pricePerLiter: price });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Middleware to verify admin role
const adminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: se requiere rol de administrador' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// 1. GESTIÓN DE COMBUSTIBLE
// ==========================================

// @desc    Set fuel price per liter (admin)
// @route   POST /api/admin/fuel-price
// @access  Private (admin)
router.post('/fuel-price', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { pricePerLiter } = req.body;
    if (pricePerLiter === undefined || pricePerLiter < 0) {
      return res.status(400).json({ message: 'Por favor ingresa un precio válido' });
    }
    const price = await FuelPrice.updatePrice(Number(pricePerLiter), req.user.id);
    res.json({ message: 'Precio de nafta actualizado', pricePerLiter: price });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 2. GESTIÓN DE USUARIOS (Baja y Eliminación)
// ==========================================

// @desc    Listar todos los usuarios
// @route   GET /api/admin/users
// @access  Private (admin)
router.get('/users', authMiddleware, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    // Enriquecer con contador de viajes y transferencias pendientes
    const userSummaries = await Promise.all(
      users.map(async (u) => {
        const tripsCount = await Trip.countDocuments({ driver: u._id, isCancelled: { $ne: true } });
        const pendingTransfers = await Trip.countDocuments({
          driver: u._id,
          transferStatus: 'paid_pending_approval',
        });
        return {
          ...u.toObject(),
          tripsCount,
          pendingTransfers,
        };
      })
    );

    res.json({ users: userSummaries });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Dar de baja a un usuario (no puede loguearse, mantiene historial)
// @route   POST /api/admin/user/:id/deactivate
// @access  Private (admin)
router.post('/user/:id/deactivate', authMiddleware, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'No se puede dar de baja la cuenta de administrador principal' });
    }

    user.isActive = false;
    user.deactivatedAt = new Date();
    await user.save();

    res.json({
      message: `El usuario ${user.name} ha sido dado de baja. No podrá iniciar sesión pero su historial se conserva.`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Reactivar a un usuario dado de baja
// @route   POST /api/admin/user/:id/activate
// @access  Private (admin)
router.post('/user/:id/activate', authMiddleware, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.isActive = true;
    user.deactivatedAt = null;
    await user.save();

    res.json({
      message: `El usuario ${user.name} ha sido reactivado exitosamente.`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Eliminar definitivamente a un usuario (solo si fue dado de baja previamente)
// @route   DELETE /api/admin/user/:id
// @access  Private (admin)
router.delete('/user/:id', authMiddleware, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'No se puede eliminar la cuenta de administrador' });
    }

    // Regla obligatoria: Para eliminar primero debe ser dado de baja
    if (user.isActive !== false) {
      return res.status(400).json({
        message: 'Para eliminar un usuario, primero debe ser dado de baja.',
      });
    }

    // Desaparece todo rastro del usuario: borrar todos sus viajes y el usuario
    const deletedTrips = await Trip.deleteMany({ driver: user._id });
    await User.findByIdAndDelete(user._id);

    res.json({
      message: `Usuario ${user.name} y todos sus ${deletedTrips.deletedCount} turnos/registros fueron eliminados definitivamente.`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 3. GESTIÓN Y EDICIÓN DE TURNOS
// ==========================================

// @desc    Listar turnos con filtros
// @route   GET /api/admin/trips
// @access  Private (admin)
router.get('/trips', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { driverId, transferStatus, period } = req.query;
    let filter = {};

    if (driverId && driverId !== 'undefined' && driverId !== 'null' && driverId !== '') {
      filter.driver = driverId;
    }
    if (transferStatus && transferStatus !== 'all') {
      filter.transferStatus = transferStatus;
    }

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

    const trips = await Trip.find(filter)
      .populate('driver', 'name email isActive')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ trips });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Editar datos de un turno (por administrador)
// @route   PUT /api/admin/trip/:id
// @access  Private (admin)
router.put('/trip/:id', authMiddleware, adminAuth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const {
      startMileage,
      endMileage,
      startFuelLevel,
      endFuelLevel,
      fuelLitersAdded,
      moneyObtained,
      transferStatus,
      isCancelled,
      adminNotes,
    } = req.body;

    const modifiedFields = new Set(trip.editedFields || []);

    // Comparar y registrar qué campos fueron modificados
    if (startMileage !== undefined && Number(startMileage) !== trip.startMileage) {
      trip.startMileage = Number(startMileage);
      modifiedFields.add('startMileage');
    }
    if (endMileage !== undefined && Number(endMileage) !== trip.endMileage) {
      trip.endMileage = Number(endMileage);
      modifiedFields.add('endMileage');
    }
    if (startFuelLevel !== undefined && Number(startFuelLevel) !== trip.startFuelLevel) {
      trip.startFuelLevel = Number(startFuelLevel);
      modifiedFields.add('startFuelLevel');
    }
    if (endFuelLevel !== undefined && Number(endFuelLevel) !== trip.endFuelLevel) {
      trip.endFuelLevel = Number(endFuelLevel);
      modifiedFields.add('endFuelLevel');
    }
    if (fuelLitersAdded !== undefined && Number(fuelLitersAdded) !== trip.fuelLitersAdded) {
      trip.fuelLitersAdded = Number(fuelLitersAdded);
      modifiedFields.add('fuelLitersAdded');
    }
    if (moneyObtained !== undefined && Number(moneyObtained) !== trip.moneyObtained) {
      trip.moneyObtained = Number(moneyObtained);
      modifiedFields.add('moneyObtained');
    }
    if (isCancelled !== undefined && Boolean(isCancelled) !== trip.isCancelled) {
      trip.isCancelled = Boolean(isCancelled);
      modifiedFields.add('isCancelled');
    }
    if (transferStatus !== undefined && transferStatus !== trip.transferStatus) {
      trip.transferStatus = transferStatus;
      modifiedFields.add('transferStatus');
      if (transferStatus === 'approved') {
        trip.transferApprovedAt = new Date();
      }
    }
    if (adminNotes !== undefined) {
      trip.adminNotes = adminNotes;
    }

    trip.editedByAdmin = true;
    trip.editedFields = Array.from(modifiedFields);

    // Recalcular métricas automáticas con el precio actual de nafta
    const currentFuelPrice = await FuelPrice.getCurrentPrice();
    trip.computeMetrics(currentFuelPrice);

    await trip.save();

    res.json({
      message: 'Turno actualizado por el administrador exitosamente.',
      trip,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Aprobar transferencia de un turno
// @route   POST /api/admin/trip/:id/approve-transfer
// @access  Private (admin)
router.post('/trip/:id/approve-transfer', authMiddleware, adminAuth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    trip.transferStatus = 'approved';
    trip.transferApprovedAt = new Date();
    await trip.save();

    res.json({
      message: 'Transferencia confirmada y aprobada exitosamente.',
      trip,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Dar de baja o reactivar un turno específico
// @route   POST /api/admin/trip/:id/toggle-cancel
// @access  Private (admin)
router.post('/trip/:id/toggle-cancel', authMiddleware, adminAuth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    trip.isCancelled = !trip.isCancelled;
    trip.editedByAdmin = true;
    const modified = new Set(trip.editedFields || []);
    modified.add('isCancelled');
    trip.editedFields = Array.from(modified);
    await trip.save();

    res.json({
      message: trip.isCancelled ? 'Turno dado de baja (anulado)' : 'Turno reactivado',
      trip,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. ESTADÍSTICAS Y RENDICIONES MENSUALES
// ==========================================

// @desc    Get all drivers stats (admin)
// @route   GET /api/admin/drivers-stats
// @access  Private (admin)
router.get('/drivers-stats', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { period, driverId } = req.query;
    let filter = { isCancelled: { $ne: true } };

    if (driverId && driverId !== 'undefined' && driverId !== 'null') {
      filter.driver = driverId;
    }

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

    const trips = await Trip.find(filter).sort({ date: -1 });

    // Aggregate per driver
    const driverStats = {};
    trips.forEach((trip) => {
      const dId = trip.driver.toString();
      if (!driverStats[dId]) {
        driverStats[dId] = {
          tripCount: 0,
          totalKm: 0,
          totalMoney: 0,
          totalFuelCost: 0,
          totalCarWear: 0,
          totalCarReplacement: 0,
          totalTransfers: 0,
          pendingTransfers: 0,
          approvedTransfers: 0,
        };
      }
      driverStats[dId].tripCount += 1;
      if (trip.kilometersDone) driverStats[dId].totalKm += trip.kilometersDone;
      if (trip.moneyObtained) driverStats[dId].totalMoney += trip.moneyObtained;
      if (trip.fuelCost) driverStats[dId].totalFuelCost += trip.fuelCost;
      if (trip.carWearAmount) driverStats[dId].totalCarWear += trip.carWearAmount;
      if (trip.carReplacementAmount) driverStats[dId].totalCarReplacement += trip.carReplacementAmount;
      if (trip.totalTransferAmount) driverStats[dId].totalTransfers += trip.totalTransferAmount;
      if (trip.transferStatus === 'paid_pending_approval') driverStats[dId].pendingTransfers += 1;
      if (trip.transferStatus === 'approved') driverStats[dId].approvedTransfers += 1;
    });

    const allDrivers = await User.find({ role: 'driver' }).select('name email isActive deactivatedAt');

    const result = allDrivers.map((d) => {
      const stats = driverStats[d._id.toString()] || {
        tripCount: 0,
        totalKm: 0,
        totalMoney: 0,
        totalFuelCost: 0,
        totalCarWear: 0,
        totalCarReplacement: 0,
        totalTransfers: 0,
        pendingTransfers: 0,
        approvedTransfers: 0,
      };
      return {
        _id: d._id,
        name: d.name,
        email: d.email,
        isActive: d.isActive,
        deactivatedAt: d.deactivatedAt,
        trips: stats.tripCount,
        totalKilometers: stats.totalKm,
        totalMoney: stats.totalMoney,
        totalFuelCost: stats.totalFuelCost,
        netProfit: Math.max(0, stats.totalMoney - stats.totalFuelCost),
        totalCarWear: stats.totalCarWear,
        totalCarReplacement: stats.totalCarReplacement,
        totalTransfers: stats.totalTransfers,
        pendingTransfers: stats.pendingTransfers,
        approvedTransfers: stats.approvedTransfers,
      };
    });

    res.json({ period: period || 'month', drivers: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark monthly rendition as paid for a driver
// @route   POST /api/admin/monthly-rendition
// @access  Private (admin)
router.post('/monthly-rendition', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ message: 'ID de conductor requerido' });
    }
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Conductor no encontrado' });
    }

    // Aprobar todas las transferencias pendientes del conductor
    await Trip.updateMany(
      { driver: driverId, transferStatus: { $ne: 'approved' }, isCancelled: { $ne: true } },
      { $set: { transferStatus: 'approved', transferApprovedAt: new Date() } }
    );

    res.json({
      message: `Rendición mensual marcada como abonada exitosamente para ${driver.name}.`,
      driverId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
