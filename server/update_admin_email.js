require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Script de migración: actualiza el correo del usuario "Administrador".
//
// El usuario admin se identifica por su rol ('admin'). Este script cambia su
// correo de admin@uberclone.com (valor anterior) a tallerdecomputadoras.it@gmail.com.
//
// Es idempotente: se puede ejecutar varias veces sin problema. Si el admin ya
// tiene el correo correcto, no hace nada.
//
// Uso:
//   node server/update_admin_email.js
//   node server/update_admin_email.js --dry-run   (solo muestra, no guarda)

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uber_driver';
const OLD_EMAIL = 'admin@uberclone.com';
const NEW_EMAIL = 'tallerdecomputadoras.it@gmail.com';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Conectado a MongoDB');
  if (DRY_RUN) console.log('*** MODO DRY-RUN: no se guardarán cambios ***');

  // Buscamos TODOS los usuarios con rol admin (no debería haber más de uno).
  const admins = await User.find({ role: 'admin' });
  console.log(`Usuarios administradores encontrados: ${admins.length}`);

  if (admins.length === 0) {
    console.log(
      'No se encontró ningún administrador. Se creará automáticamente con el correo ' +
        `nuevo (${NEW_EMAIL}) en el próximo inicio de sesión.`
    );
    await mongoose.disconnect();
    return;
  }

  for (const admin of admins) {
    console.log(`- Admin: ${admin.name} | correo actual: ${admin.email}`);

    if (admin.email === NEW_EMAIL) {
      console.log('  El correo ya es el correcto. Nada que hacer.');
      continue;
    }

    // Verificamos que el correo nuevo no esté usado por OTRO usuario (email es unique).
    const existing = await User.findOne({ email: NEW_EMAIL });
    if (existing && String(existing._id) !== String(admin._id)) {
      console.error(
        `  No se puede actualizar: el correo ${NEW_EMAIL} ya está en uso por ` +
          `otro usuario (${existing.name}).`
      );
      continue;
    }

    const previousEmail = admin.email;
    if (!DRY_RUN) {
      admin.email = NEW_EMAIL;
      await admin.save();
    }
    console.log(`  Correo actualizado: ${previousEmail} -> ${NEW_EMAIL}`);
  }

  await mongoose.disconnect();
  console.log('Listo.');
}

main().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
