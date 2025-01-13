// routes/dismissal.routes.js
const express = require('express');
const { calculateDismissal } = require('../controllers/calculatorController');
const router = express.Router();


// Middleware para validar el formato de las fechas
const validateDates = (req, res, next) => {
    const { fechaIngreso, fechaEgreso } = req.body;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(fechaIngreso) || !dateRegex.test(fechaEgreso)) {
        return res.status(400).json({
            success: false,
            message: 'Las fechas deben tener el formato YYYY-MM-DD'
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
            message: 'La remuneración debe ser un número positivo'
        });
    }
    next();
};

// Ruta principal para el cálculo de despido
router.get(
    '/calculate', 
    [validateDates, validateRemuneration],
    calculateDismissal
);

module.exports = router;
