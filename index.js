const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { botToken, port, mongoUri } = require("./config/env");
const bot = require("./src/bot"); // Importar la lógica del bot
const subscriptionRoutes = require("./src/routes/subscription"); // Importar las rutas de suscripción
const successRoutes = require("./src/routes/success"); // Importar la ruta de éxito
const webhookRoutes = require("./src/routes/webhook");
const tracking = require("./src/routes/tracking");
const logger = require("./src/config/logger");
const { cronJobs } = require("./src/tasks/cronTasks");
const { testScraping } = require("./src/tests/cronTestingTasks");

const app = express();

// Configurar middlewares y parseo de JSON
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, "public")));

// Ruta para renderizar el archivo HTML de la landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Conectar a MongoDB
mongoose
  .connect(mongoUri)
  .then(() => {
    logger.info("Conectado a MongoDB");
  })
  .catch((err) => {
    logger.info("Error al conectar a MongoDB:", err);
  });

// Iniciar el bot de Telegram
bot.launch();

// Rutas para suscripción y éxito
app.use("/subscription", subscriptionRoutes);
app.use("/success", successRoutes);
app.use("/webhook", webhookRoutes);
app.use("/tracking", tracking);

// Middleware para manejar rutas no encontradas y servir la página 404
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "public/views", "404.html"));
});


//cronJobs()
testScraping(50)


// Iniciar el servidor
app.listen(port, () => {
  console.log(
    `Servidor corriendo en el puerto ${port} en modo ${process.env.NODE_ENV}`
  );
});
