const path = require("path");
const express = require("express");
const {logger} = require("../config/logger");
const router = express.Router();
const fs = require("fs");
const bot = require("../bot");

router.get("/download", (req, res) => {
  const filename = req.query.filename;
  const userId = req.query.userId; // Asegúrate de que el userId esté en los parámetros
  logger.info(`Ruta download screenshot. Path: ${filename}`);
  const filePath = path.join(__dirname, "../services/screenshots", filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`Archivo no encontrado: ${filePath}`);
      return res.status(404).send("Archivo no encontrado.");
    }

    // Enviar la imagen al usuario a través del bot de Telegram
    bot.telegram.sendPhoto(userId, { source: filePath })
      .then(() => {
        logger.info("Imagen enviada a través del bot");
        res.status(200).send("Imagen enviada exitosamente.");
      })
      .catch((error) => {
        logger.error("Error al enviar la imagen:", error);
        res.status(500).send("Error al enviar la imagen.");
      });
  });
});


module.exports = router;
