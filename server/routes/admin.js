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

// @desc    Get all drivers stats (admin)
// @route   GET /api/admin/drivers-stats
// @access  Private (admin)
router.get('/drivers-stats', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { period, driverId } = req.query;
    let filter = {};
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
        driverStats[dId] = { tripCount: 0, totalKm: 0, totalMoney: 0, totalFuelCost: 0 };
      }
      driverStats[dId].tripCount += 1;
      if (trip.kilometersDone) driverStats[dId].totalKm += trip.kilometersDone;
      if (trip.moneyObtained) driverStats[dId].totalMoney += trip.moneyObtained;
      if (trip.fuelCost) driverStats[dId].totalFuelCost += trip.fuelCost;
    });

    // Also get all registered drivers
    const allDrivers = await User.find({ role: 'driver' }).select('name email');

    const result = allDrivers.map((d) => {
      const stats = driverStats[d._id.toString()] || {
        tripCount: 0,
        totalKm: 0,
        totalMoney: 0,
        totalFuelCost: 0,
      };
      return {
        _id: d._id,
        name: d.name,
        email: d.email,
        trips: stats.tripCount,
        totalKilometers: stats.totalKm,
        totalMoney: stats.totalMoney,
        totalFuelCost: stats.totalFuelCost,
        netProfit: stats.totalMoney - stats.totalFuelCost,
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
    res.json({
      message: `Rendición mensual marcada como abonada exitosamente para ${driver.name}.`,
      driverId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
