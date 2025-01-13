// dismissalHandler.js
const { DismissalController } = require("../controllers/calculatorController");

const dismissalHandler = async (req, res) => {
  try {
    const {
      fechaIngreso,
      fechaEgreso,
      remuneracion,
      folderId = null,
      incluirSAC = false,
      isTopes = false,
      topeLegalVigente = 0,
      isLiquidacion = false,
      liquidacion = [],
      isMultas = false,
      multas = [],
      multaLE = 0,
      fechaFalsa = null,
      salarioFalso = 0,
    } = req.body;

    // Validación de parámetros requeridos en el handler
    if (!fechaIngreso || !fechaEgreso || !remuneracion) {
      return res.status(400).json({
        success: false,
        message: "Faltan parámetros requeridos: fechaIngreso, fechaEgreso, remuneracion",
      });
    }

    // Llamada al controlador con los datos procesados
    const resultado = await DismissalController.calculateDismissal({
      fechaIngreso,
      fechaEgreso,
      remuneracion,
      folderId,
      incluirSAC,
      isTopes,
      topeLegalVigente,
      isLiquidacion,
      liquidacion,
      isMultas,
      multas,
      multaLE,
      fechaFalsa,
      salarioFalso,
    });

    return res.status(200).json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error("Error en el cálculo de la liquidación:", error);
    return res.status(500).json({
      success: false,
      message: "Error en el cálculo de la liquidación",
      error: error.message,
    });
  }
};

module.exports = {
  dismissalHandler,
};