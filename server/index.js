require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin', adminRoutes);

const path = require('path');
const fs = require('fs');

// API Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Uber Driver App Backend API is running' });
});

// Path to client build
const clientBuildPath = path.resolve(__dirname, '../client/build');
if (fs.existsSync(clientBuildPath)) {
  console.log('Serving frontend from:', clientBuildPath);
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(clientBuildPath, 'index.html'));
  });
} else {
  console.warn('Frontend build not found at:', clientBuildPath);
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 2rem; border-radius: 12px; background: #0f172a; color: #fff; text-align: center;">
        <h2 style="color: #38bdf8;">Uber Driver App - Backend API</h2>
        <p style="color: #94a3b8;">El servidor API está en ejecución correctamente.</p>
        <div style="padding: 1rem; background: #1e293b; border-radius: 8px; margin: 1.5rem 0; font-size: 0.9rem; color: #facc15;">
          ⚠️ La interfaz web (React) aún no ha sido compilada. Corre <code>npm run build</code> en la carpeta client.
        </div>
        <p style="font-size: 0.85rem; color: #64748b;">Endpoint de salud: <a href="/api/health" style="color: #38bdf8;">/api/health</a></p>
      </div>
    `);
  });
}

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uber_driver';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Conectado a MongoDB');
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error conectando a MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;