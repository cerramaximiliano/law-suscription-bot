const mongoose = require("mongoose");

const indemnizacionSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
  },
  sueldoBruto: {
    type: Number,
    required: true,
  },
  fechaIngreso: {
    type: Date,
    required: true,
  },
  fechaEgreso: {
    type: Date,
    required: true,
  },
  antiguedadAnios: {
    type: Number,
    required: true,
  },
  resultado: {
    type: Number,
    default: null,
  },
  estado: {
    type: String,
    enum: ["pendiente", "calculado"],
    default: "pendiente",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Indemnizacion", indemnizacionSchema);
