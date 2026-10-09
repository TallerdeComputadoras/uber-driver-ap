const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization').startsWith('Bearer ')
      ? req.header('Authorization').substring(7)
      : req.header('Authorization');
    if (!token) {
      return res.status(401).json({ message: 'Sin token, autorización denegada' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};

module.exports = authenticate;