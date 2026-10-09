const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Pre-trip data (captured when driver starts shift)
  startMileage: {
    type: Number,
    required: [true, 'Por favor ingresa el kilometraje al iniciar'],
  },
  startFuelLevel: {
    type: Number, // en litros restantes
    required: [true, 'Por favor ingresa el nivel de nafta al iniciar'],
  },
  startFuelLevelDate: {
    type: Date,
    default: Date.now,
  },
  // Post-trip data (captured when driver ends shift)
  endMileage: {
    type: Number,
    required: [true, 'Por favor ingresa el kilometraje al finalizar'],
  },
  endFuelLevel: {
    type: Number, // en litros restantes
    required: [true, 'Por favor ingresa el nivel de nafta al finalizar'],
  },
  fuelLitersAdded: {
    type: Number, // liters of fuel added if any (0 if none)
    default: 0,
  },
  moneyObtained: {
    type: Number, // money earned from the trip
    required: [true, 'Por favor ingresa el dinero obtenido'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  // Calculated fields (can be computed later)
  kilometersDone: {
    type: Number,
    // Computed: endMileage - startMileage
  },
  fuelConsumedLiters: {
    type: Number,
    // Computed based on mileage difference and fuel level change
  },
  fuelCost: {
    type: Number,
    // Computed: fuelConsumedLiters * fuel price from admin settings
  },
  // Duration in minutes (optional)
  durationMinutes: {
    type: Number,
  },
}, { timestamps: true });

// Method to compute kilometers done
tripSchema.methods.computeKilometers = function () {
  if (this.endMileage && this.startMileage) {
    this.kilometersDone = this.endMileage - this.startMileage;
  }
  return this.kilometersDone;
};

// Method to compute fuel consumed liters
// Logic: (startFuelLevel - endFuelLevel) + fuelLitersAdded
tripSchema.methods.computeFuelConsumed = function () {
  // fuelConsumed = startFuelLevel - endFuelLevel + fuelLitersAdded
  // But ensure not negative
  const start = this.startFuelLevel || 0;
  const end = this.endFuelLevel || 0;
  const added = this.fuelLitersAdded || 0;
  this.fuelConsumedLiters = Math.max(0, start - end + added);
  return this.fuelConsumedLiters;
};

// Method to compute fuel cost using a given price per liter
tripSchema.methods.computeFuelCost = function (pricePerLiter) {
  const consumed = this.fuelConsumedLiters || 0;
  this.fuelCost = consumed * (pricePerLiter || 0);
  return this.fuelCost;
};

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;