const Tracking = require("../models/trackingModel");

async function getTrackingTelegramas(userId) {
  try {
    // Buscar en la colección Tracking todos los documentos que coincidan con el userId y tengan un trackingType relacionado a telegramas/cartas documento
    const trackingTelegramas = await Tracking.find({
      userId: userId,
      trackingType: "carta_documento",
    });

    // Si no encuentra nada, retornar un array vacío
    return trackingTelegramas.length > 0 ? trackingTelegramas : [];
  } catch (error) {
    console.error("Error al obtener los telegramas/cartas:", error);
    return []; // En caso de error, retornar un array vacío
  }
}

module.exports = { getTrackingTelegramas };
