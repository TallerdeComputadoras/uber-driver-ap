require('dotenv').config();
const mongoose = require('mongoose');
const Trip = require('./models/Trip');
const FuelPrice = require('./models/FuelPrice');

// Script de migración: recalcula las métricas (ganancia neta, desgaste,
// cambio de auto y total a transferir) de TODOS los turnos finalizados.
//
// Es idempotente: se puede ejecutar varias veces sin problema, siempre deja
// los valores consistentes con las reglas actuales (10% + 10% = 20%).
//
// Uso (en la Shell de Render, donde MONGODB_URI ya está configurada):
//   node server/recalculate_metrics.js
// o localmente:
//   MONGODB_URI="..." node server/recalculate_metrics.js
//   node server/recalculate_metrics.js --dry-run   (solo muestra, no guarda)

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uber_driver';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Conectado a MongoDB');
  if (DRY_RUN) console.log('*** MODO DRY-RUN: no se guardarán cambios ***');

  const fuelPrice = await FuelPrice.getCurrentPrice();
  console.log(`Precio actual de nafta: $${fuelPrice}/L`);

  // Solo turnos cerrados y no cancelados.
  const trips = await Trip.find({ isFinished: true, isCancelled: { $ne: true } });
  console.log(`Turnos finalizados a revisar: ${trips.length}`);

  let updated = 0;
  let changed = 0;

  for (const trip of trips) {
    const before = {
      netProfit: trip.netProfit,
      carWearAmount: trip.carWearAmount,
      carReplacementAmount: trip.carReplacementAmount,
      totalTransferAmount: trip.totalTransferAmount,
    };

    trip.computeMetrics(fuelPrice);

    const after = {
      netProfit: trip.netProfit,
      carWearAmount: trip.carWearAmount,
      carReplacementAmount: trip.carReplacementAmount,
      totalTransferAmount: trip.totalTransferAmount,
    };

    const diff =
      before.netProfit !== after.netProfit ||
      before.carWearAmount !== after.carWearAmount ||
      before.carReplacementAmount !== after.carReplacementAmount ||
      before.totalTransferAmount !== after.totalTransferAmount;

    if (diff) {
      changed += 1;
      console.log(
        `- Turno ${trip._id} (${new Date(trip.date).toLocaleDateString('es-AR')}): ` +
          `recaudado=$${trip.moneyObtained} -> neta=$${after.netProfit}, ` +
          `desgaste=$${after.carWearAmount}, cambio=$${after.carReplacementAmount}, ` +
          `transferir=$${after.totalTransferAmount}`
      );
      if (!DRY_RUN) {
        await trip.save();
        updated += 1;
      }
    }
  }

  console.log('----------------------------------------');
  console.log(`Turnos con valores distintos: ${changed}`);
  console.log(DRY_RUN ? 'Dry-run: nada guardado.' : `Turnos actualizados: ${updated}`);

  await mongoose.disconnect();
  console.log('Listo.');
}

main().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
