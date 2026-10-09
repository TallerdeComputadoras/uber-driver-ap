const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FuelPrice = require('../models/FuelPrice');
const authMiddleware = require('../middleware/auth');

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

// @desc    Set fuel price per liter (admin)
// @route   POST /api/admin/fuel-price
// @access  Private (admin)
router.post('/fuel-price', adminAuth, async (req, res) => {
  try {
    const { pricePerLiter } = req.body;
    if (pricePerLiter === undefined || pricePerLiter < 0) {
      return res.status(400).json({ message: 'Por favor ingresa un precio válido' });
    }
    const price = await FuelPrice.updatePrice(pricePerLiter, req.user.id);
    res.json({ message: 'Precio de nafta actualizado', pricePerLiter: price });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get current fuel price
// @route   GET /api/admin/fuel-price
// @access  Public
router.get('/fuel-price', async (req, res) => {
  try {
    const price = await FuelPrice.getCurrentPrice();
    res.json({ pricePerLiter: price });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all drivers stats (admin)
// @route   GET /api/admin/drivers-stats
// @access  Private (admin)
router.get('/drivers-stats', adminAuth, async (req, res) => {
  try {
    const { period, driverId } = req.query;
    let filter = {};
    if (driverId) {
      filter.driver = driverId;
    }
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
        startDate = new Date(0);
    }
    if (startDate) {
      filter.date = { $gte: startDate };
    }
    const trips = await Trip.find(filter).sort({ date: -1 });
    // Aggregate per driver
    const driverStats = {};
    trips.forEach(trip => {
      const driverId = trip.driver.toString();
      if (!driverStats[driverId]) {
        driverStats[driverId] = { tripCount: 0, totalKm: 0, totalMoney: 0, totalFuelCost: 0 };
      }
      driverStats[driverId].tripCount += 1;
      if (trip.kilometersDone) driverStats[driverId].totalKm += trip.kilometersDone;
      if (trip.moneyObtained) driverStats[driverId].totalMoney += trip.moneyObtained;
      if (trip.fuelCost) driverStats[driverId].totalFuelCost += trip.fuelCost;
    });
    // Add user info
    const driverIds = Object.keys(driverStats);
    const drivers = await User.find({ _id: { $in: driverIds } }).select('name email');
    const result = [];
    drivers.forEach(d => {
      const stats = driverStats[d._id.toString()];
      result.push({
        _id: d._id,
        name: d.name,
        email: d.email,
        trips: stats.tripCount,
        totalKilometers: stats.totalKm,
        totalMoney: stats.totalMoney,
        totalFuelCost: stats.totalFuelCost,
        netProfit: stats.totalMoney - stats.totalFuelCost,
      });
    });
    res.json({ period: period || 'all', drivers: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark monthly rendition as paid for a driver
// @route   POST /api/admin/monthly-rendition
// @access  Private (admin)
router.post('/monthly-rendition', adminAuth, async (req, res) => {
  try const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ message: 'ID de conductor requerido' });
    }
    // In a real app, we'd have a rendition status field on User or a separate model.
    // For now, just acknowledge.
    res.json({ message: 'Rendición mensual marcada como abonada para el conductor', driverId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
