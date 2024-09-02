const path = require("path");
const express = require("express");
const router = express.Router();

router.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "screenshots", filename);
  res.download(filePath, (err) => {
    if (err) {
      console.error("Error al descargar el archivo:", err);
      res.status(500).send("Error al descargar el archivo.");
    }
  });
});

module.exports = router;
