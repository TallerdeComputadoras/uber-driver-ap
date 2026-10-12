const mongoose = require('mongoose');

const fuelPriceSchema = new mongoose.Schema({
  pricePerLiter: {
    type: Number,
    required: [true, 'Por favor ingresa el precio por litro de nafta'],
    min: [0, 'El precio no puede ser negativo'],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

// Ensure only one document exists (singleton pattern)
fuelPriceSchema.statics.getCurrentPrice = async function () {
  const doc = await this.findOne();
  // Si aún no se configuró un precio, devolvemos 0 en lugar de crear un
  // documento inválido (pricePerLiter es required y rompería el guardado).
  if (!doc) {
    return 0;
  }
  return doc.pricePerLiter;
};

fuelPriceSchema.statics.updatePrice = async function (newPrice, adminUserId) {
  const doc = await this.findOneAndUpdate(
    {},
    { pricePerLiter: newPrice, updatedBy: adminUserId, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return doc.pricePerLiter;
};

module.exports = mongoose.model('FuelPrice', fuelPriceSchema);