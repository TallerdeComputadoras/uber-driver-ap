const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Pre-trip data (captured when driver starts shift)
    startMileage: {
      type: Number,
      required: false,
    },
    startFuelLevel: {
      type: Number, // % o litros restantes
      required: [true, 'El nivel de combustible inicial es obligatorio para iniciar la jornada'],
      min: [0.1, 'El nivel de combustible inicial debe ser mayor a 0'],
    },
    startFuelLevelDate: {
      type: Date,
      default: Date.now,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    isFinished: {
      type: Boolean,
      default: false,
    },
    // Post-trip data (captured when driver ends shift)
    endMileage: {
      type: Number,
    },
    endFuelLevel: {
      type: Number, // % o litros restantes
    },
    fuelLitersAdded: {
      type: Number, // litros de nafta cargados en el turno (0 si no cargó)
      default: 0,
    },
    moneyObtained: {
      type: Number, // dinero recaudado total en el turno
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // Métricas calculadas
    kilometersDone: {
      type: Number,
      default: 0,
    },
    fuelConsumedLiters: {
      type: Number,
      default: 0,
    },
    fuelCost: {
      type: Number,
      default: 0,
    },
    netProfit: {
      type: Number,
      default: 0,
    },
    // Retenciones automáticas
    carWearAmount: {
      type: Number, // 10% de ganancia neta por desgaste del auto
      default: 0,
    },
    carReplacementAmount: {
      type: Number, // 10% de ganancia neta para futuro cambio del auto
      default: 0,
    },
    totalTransferAmount: {
      type: Number, // suma de las 2 retenciones
      default: 0,
    },
    // Estado de la transferencia
    transferStatus: {
      type: String,
      enum: ['pending', 'paid_pending_approval', 'approved'],
      default: 'pending',
    },
    transferReportedAt: {
      type: Date,
    },
    transferApprovedAt: {
      type: Date,
    },
    // Control de administración
    isCancelled: {
      type: Boolean,
      default: false,
    },
    editedByAdmin: {
      type: Boolean,
      default: false,
    },
    editedFields: {
      type: [String],
      default: [],
    },
    adminNotes: {
      type: String,
      default: '',
    },
    durationMinutes: {
      type: Number,
    },
  },
  { timestamps: true }
);

// Method to compute kilometers done
tripSchema.methods.computeKilometers = function () {
  if (this.kilometersDone !== undefined && this.kilometersDone !== null && this.kilometersDone > 0) {
    return this.kilometersDone;
  }
  if (this.endMileage !== undefined && this.startMileage !== undefined) {
    this.kilometersDone = Math.max(0, Number(this.endMileage) - Number(this.startMileage));
  }
  return this.kilometersDone || 0;
};

// Method to compute fuel consumed liters using 10 L / 100 km rate (kms / 10)
tripSchema.methods.computeFuelConsumed = function () {
  const kms = Number(this.kilometersDone) || 0;
  // Tasa de 10 litros cada 100 km: Litros = (10 * kms) / 100 = kms / 10
  this.fuelConsumedLiters = Math.round((kms / 10) * 100) / 100;
  return this.fuelConsumedLiters;
};

// Method to compute fuel cost using a given price per liter
tripSchema.methods.computeFuelCost = function (pricePerLiter) {
  const consumed = Number(this.fuelConsumedLiters) || 0;
  this.fuelCost = Math.round(consumed * (Number(pricePerLiter) || 0) * 100) / 100;
  return this.fuelCost;
};

// Complete computation of all shift metrics
tripSchema.methods.computeMetrics = function (pricePerLiter = 0) {
  this.computeKilometers();
  this.computeFuelConsumed();
  this.computeFuelCost(pricePerLiter);

  const money = Number(this.moneyObtained) || 0;
  const cost = Number(this.fuelCost) || 0;
  // Ganancia neta = dinero obtenido - costo combustible
  this.netProfit = Math.max(0, Math.round((money - cost) * 100) / 100);

  // 10% desgaste del auto
  this.carWearAmount = Math.round((this.netProfit * 0.10) * 100) / 100;
  // 10% futuro cambio del auto
  this.carReplacementAmount = Math.round((this.netProfit * 0.10) * 100) / 100;
  // Total a transferir
  this.totalTransferAmount = Math.round((this.carWearAmount + this.carReplacementAmount) * 100) / 100;

  return {
    kilometersDone: this.kilometersDone,
    fuelConsumedLiters: this.fuelConsumedLiters,
    fuelCost: this.fuelCost,
    netProfit: this.netProfit,
    carWearAmount: this.carWearAmount,
    carReplacementAmount: this.carReplacementAmount,
    totalTransferAmount: this.totalTransferAmount,
  };
};

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;