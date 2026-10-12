const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://localhost:27017/uber_driver';
const UserSchema = new mongoose.Schema({ name: String, email: String, role: String }, { strict: false });
const TripSchema = new mongoose.Schema({ driver: mongoose.Schema.Types.ObjectId }, { strict: false });
const User = mongoose.model('User', UserSchema);
const Trip = mongoose.model('Trip', TripSchema);
async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado');
  const users = await User.find({ role: { '': 'admin' } });
  const testUsers = users.filter(u => /yago|brenca|bruno/i.test(u.name));
  if (!testUsers.length) { console.log('No se encontraron usuarios de prueba'); }
  for (const u of testUsers) {
    console.log('Usuario:', u.name, u.email, String(u._id));
    const r = await Trip.deleteMany({ driver: u._id });
    console.log('  Jornadas eliminadas:', r.deletedCount);
  }
  await mongoose.disconnect();
  console.log('Listo');
}
run().catch(e => { console.error(e.message); process.exit(1); });
