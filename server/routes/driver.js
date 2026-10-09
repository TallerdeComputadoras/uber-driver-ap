const express = require('express');
const router = express.Router();
const Trip = require('../Models/Trip');
const User = require('../Models/User');
const FuelPrice = require('../Models/FuelPrice');
const authMiddleware = require('../middleware/auth');

// Protect routes: verify driver role
const driverAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'driver') {
      return res.status(403).json({ message: 'Acceso denegado: se requiere rol de conductor' });
    }
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
      startMileage,
      startFuelLevel,
    });
    await trip.save();
    res.status(201).json({ message: 'Datos de inicio guardados', trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Register post-trip data (end shift)
// @route   POST /api/driver/post-trip
// @access  Private (driver)
router.post('/post-trip', driverAuth, async (req, res) => {
  try const { endMileage, endFuelLevel, fuelLitersAdded, moneyObtained } = req.body;
    if (endMileage === undefined || endFuelLevel === undefined || moneyObtained === undefined) {
      return res.status(400).json({ message: 'Por favor completa todos los campos obligatorios' });
    }
    const trip = await Trip.findOne({ driver: req.user.id, endMileage: null }).sort({ createdAt: -1 }) || await Trip.findOne({ driver: req.user.id }).sort({ createdAt: -1 });
    // Actually we need to find an active trip without end data. Let's find the latest trip for this driver that doesn't have endMileage.
    const activeTrip = await Trip.findOne({ driver: req.user.id, endMileage: null }).sort({ startMileage: -1 });
    if (!activeTrip) {
      return res.status(404).json({ message: 'No hay un viaje activo para finalizar' });
    }
    // Update the trip with post-trip data
    activeTrip.endMileage = endMileage;
    activeTrip.endFuelLevel = endFuelLevel;
    activeTrip.fuelLitersAdded = fuelLitersAdded || 0;
    activeTrip.moneyObtained = moneyObtained;
    // Compute kilometers, fuel consumed, fuel cost
    activeTrip.computeKilometers();
    activeTrip.computeFuelConsumed();
    // Get fuel price
    const fuelPrice = await FuelPrice.getCurrentPrice();
    activeTrip.computeFuelCost(fuelPrice);
    await activeTrip.save();
    res.json({ message: 'Viaje finalizado', trip: activeTrip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get statistics for a driver (or any driver)
// @route   GET /api/driver/stats
// @access  Private (driver) - can select any driver by query param
router.get('/stats', driverAuth, async (req, res) => {
  try {
    const { driverId, period } = req.query; // period: day, week, month, year
    let filter = {};
    if (driverId) {
      filter.driver = driverId;
    } else {
      filter.driver = req.user.id;
    }
    // Determine date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        const day = now.getDay() || 7;
        startDate = new Date(now.setDate(now.getDate() - day + 1));
        startDate = new Date(startDate.setHours(0, 0, 0, 0));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0); // all time
    }
    if (startDate) {
      filter.date = { $gte: startDate };
    }
    const trips = await Trip.find(filter).sort({ date: 1 });
    // Calculate aggregates
    let totalKm = 0;
    let totalHours = 0; // we don't have duration, but can approximate or leave 0
    let totalMoney = 0;
    let totalFuelCost = 0;
    let tripCount = trips.length;
    trips.forEach(trip => {
      if (trip.kilometersDone) totalKm += trip.kilometersDone;
      if (trip.moneyObtained) totalMoney += trip.moneyObtained;
      if (trip.fuelCost) totalFuelCost += trip.fuelCost;
      // duration not stored, skip or set 0
    });
    res.json({
      period: period || 'all',
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