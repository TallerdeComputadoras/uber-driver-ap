const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trip = require('../Models/Trip');
const FuelPrice = require('../Models/FuelPrice');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Helper: generate JWT token
const generateToken = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// @desc    Register new driver
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Por favor completa todos los campos' });
    }
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }
    const user = new User({
      name,
      email,
      password,
      role: 'driver',
    });
    await user.save();
    const token = generateToken(user._id, user.role);
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Login user (driver or admin)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { password, identifier } = req.body; // identifier can be email or "Administrador"
    let user;
    // Check if trying to login as admin
    if (identifier === 'Administrador') {
      // Hardcoded admin credentials
      user = await User.findOne({ role: 'admin' });
      if (!user) {
        // Create admin if not exists (using hardcoded password)
        user = new User({
          name: 'Administrador',
          email: 'admin@uberclone.com',
          password: 'Chofer4059!', // Will be hashed pre-save
          role: 'admin',
        });
        await user.save();
      } else {
        // Compare password
        const isMatch = await user.comparePassword('Chofer4059!');
        if (!isMatch) {
          return res.status(401).json({ message: 'Credenciales incorrectas' });
        }
      }
    } else {
      // Normal login with email
      user = await User.findOne({ email: identifier });
      if (!user) {
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
    }
    const token = generateToken(user._id, user.role);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Forgot password (request reset token)
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No hay una cuenta con ese correo' });
    }
    // Generate a reset token (simple approach: send email with token)
    // For now, just respond with success; in production send email
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    // In real app, send email with reset link containing token
    res.json({ message: 'Se ha enviado un enlace de restablecimiento a tu correo', resetToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Faltan datos' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Contraseña restablecida exitosamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
