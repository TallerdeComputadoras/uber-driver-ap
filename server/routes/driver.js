const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User');
const FuelPrice = require('../models/FuelPrice');
const authMiddleware = require('../middleware/auth');

// Require authentication for all driver routes
router.use(authMiddleware);

// Protect routes: verify driver or admin role
const driverAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(403).json({ message: 'Usuario no encontrado' });
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
    const { startMileage, startFuelLevel } = req.body;
    if (startMileage === undefined || startFuelLevel === undefined) {
      return res.status(400).json({ message: 'Por favor ingresa el kilometraje y nivel de nafta' });
    }
    const trip = new Trip({
      driver: req.user.id,
      startMileage: Number(startMileage),
      startFuelLevel: Number(startFuelLevel),
    });
    await trip.save();
    res.status(201).json({ message: 'Inicio de jornada guardado con éxito', trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Register post-trip data (end shift)
// @route   POST /api/driver/post-trip
// @access  Private (driver)
router.post('/post-trip', driverAuth, async (req, res) => {
  try {
    const { endMileage, endFuelLevel, fuelLitersAdded, moneyObtained } = req.body;
    if (endMileage === undefined || endFuelLevel === undefined || moneyObtained === undefined) {
      return res.status(400).json({ message: 'Por favor completa todos los campos obligatorios' });
    }

    // Find the latest active trip for this driver that doesn't have endMileage
    let activeTrip = await Trip.findOne({ driver: req.user.id, endMileage: null }).sort({ createdAt: -1 });

    if (!activeTrip) {
      // If no active pre-trip exists, create one with default start values
      activeTrip = new Trip({
        driver: req.user.id,
        startMileage: Math.max(0, Number(endMileage) - 10),
        startFuelLevel: 100,
      });
    }

    activeTrip.endMileage = Number(endMileage);
    activeTrip.endFuelLevel = Number(endFuelLevel);
    activeTrip.fuelLitersAdded = Number(fuelLitersAdded) || 0;
    activeTrip.moneyObtained = Number(moneyObtained);

    // Compute metrics
    activeTrip.computeKilometers();
    activeTrip.computeFuelConsumed();

    const fuelPrice = await FuelPrice.getCurrentPrice();
    activeTrip.computeFuelCost(fuelPrice);

    await activeTrip.save();
    res.json({ message: 'Jornada finalizada y métricas calculadas con éxito', trip: activeTrip });
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
    let tripCount = trips.length;

    trips.forEach((trip) => {
      if (trip.kilometersDone) totalKm += trip.kilometersDone;
      if (trip.moneyObtained) totalMoney += trip.moneyObtained;
      if (trip.fuelCost) totalFuelCost += trip.fuelCost;
    });

    res.json({
      period: period || 'month',
      driverId: filter.driver,
      tripCount,
      totalKilometers: totalKm,
      totalMoneyObtained: totalMoney,
      totalFuelCost,
      netProfit: totalMoney - totalFuelCost,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
