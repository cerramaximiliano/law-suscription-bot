// routes/dismissal.routes.js
const express = require("express");
const moment = require("moment");
const { dismissalHandler } = require("../handlers/calculator");

const router = express.Router();

// Middleware para validar el formato de las fechas
const validateDates = (req, res, next) => {
  const { fechaIngreso, fechaEgreso } = req.body;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(fechaIngreso) || !dateRegex.test(fechaEgreso)) {
    return res.status(400).json({
      success: false,
      message: "Las fechas deben tener el formato YYYY-MM-DD",
    });
  }

  const fechaIngresoMoment = moment(fechaIngreso);
  const fechaEgresoMoment = moment(fechaEgreso);

  // Validar que las fechas sean válidas
  if (!fechaIngresoMoment.isValid() || !fechaEgresoMoment.isValid()) {
    return res.status(400).json({
      success: false,
      message: "Las fechas proporcionadas no son válidas",
    });
  }

  // Validar que fechaIngreso sea anterior a fechaEgreso
  if (!fechaIngresoMoment.isBefore(fechaEgresoMoment)) {
    return res.status(400).json({
      success: false,
      message: "La fecha de ingreso debe ser anterior a la fecha de egreso",
    });
  }

  next();
};

// Middleware para validar la remuneración
const validateRemuneration = (req, res, next) => {
  const { remuneracion } = req.body;

  if (isNaN(remuneracion) || remuneracion <= 0) {
    return res.status(400).json({
      success: false,
      message: "La remuneración debe ser un número positivo",
    });
  }
  next();
};

// Ruta principal para el cálculo de despido
router.post(
  "/calculate",
  [validateDates, validateRemuneration],
  dismissalHandler
);

module.exports = router;
