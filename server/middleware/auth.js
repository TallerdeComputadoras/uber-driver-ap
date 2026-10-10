const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Sin token, autorización denegada' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader.trim();

    if (!token) {
      return res.status(401).json({ message: 'Formato de token no válido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uber_driver_secret_key_change_in_production');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = authenticate;