const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trip = require('../models/Trip');
const FuelPrice = require('../models/FuelPrice');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');
require('dotenv').config();

// Helper: generate JWT token
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'uber_driver_secret_key_change_in_production', {
    expiresIn: '30d',
  });

// Helper: generar contraseña aleatoria segura
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

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
    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }
    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: 'driver',
      isActive: true,
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
    if (!password || !identifier) {
      return res.status(400).json({ message: 'Por favor ingresa usuario/correo y contraseña' });
    }

    let user;
    // Check if trying to login as admin
    if (identifier === 'Administrador' || identifier.toLowerCase() === 'tallerdecomputadoras.it@gmail.com') {
      user = await User.findOne({ role: 'admin' });
      if (!user) {
        // Create initial admin if not exists
        user = new User({
          name: 'Administrador',
          email: 'tallerdecomputadoras.it@gmail.com',
          password: 'Chofer4059!', // Will be hashed pre-save
          role: 'admin',
          isActive: true,
        });
        await user.save();
      } else {
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return res.status(401).json({ message: 'Credenciales de administrador incorrectas' });
        }
      }
    } else {
      // Normal login with email
      user = await User.findOne({ email: identifier.toLowerCase().trim() });
      if (!user) {
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
    }

    // Comprobar si el usuario fue dado de baja por la administración
    if (user.isActive === false) {
      return res.status(403).json({
        message: 'Esta cuenta ha sido dada de baja por la administración. Comuníquese para más información.',
      });
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
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Forgot password (genera contraseña aleatoria nueva y la envía por email)
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Por favor ingresa tu correo electrónico' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ message: 'No existe una cuenta registrada con ese correo electrónico' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Esta cuenta se encuentra dada de baja. Contacte al administrador.' });
    }

    // Generar contraseña aleatoria provisoria
    const tempPassword = generateRandomPassword();
    user.password = tempPassword; // el pre('save') hook se encarga del hashing bcrypt
    await user.save();

    // Enviar correo
    const emailResult = await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name,
      tempPassword,
    });

    res.json({
      message: 'Se ha generado y enviado una nueva contraseña provisoria a tu correo.',
      // Si el servidor no tiene SMTP configurado, informamos la contraseña generada para facilitar pruebas
      tempPasswordNotice: emailResult.simulated
        ? `[Modo desarrollo/sin SMTP]: Tu nueva contraseña provisoria es: ${tempPassword}`
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Cambio de contraseña para usuario autenticado
// @route   POST /api/auth/change-password
// @access  Private
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Por favor completa todos los campos requeridos' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'La nueva contraseña y su confirmación no coinciden' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const isCurrentMatch = await user.comparePassword(currentPassword);
    if (!isCurrentMatch) {
      return res.status(400).json({ message: 'La contraseña actual ingresada es incorrecta' });
    }

    // Guardar nueva contraseña
    user.password = newPassword;
    await user.save();

    res.json({ message: '¡Tu contraseña ha sido actualizada con éxito!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
