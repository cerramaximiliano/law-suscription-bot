const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { port, mongoUri, host } = require("./config/env");
const bot = require("./src/bot"); // Importar la lógica del bot
const subscriptionRoutes = require("./src/routes/subscription"); // Importar las rutas de suscripción
const successRoutes = require("./src/routes/success"); // Importar la ruta de éxito
const webhookRoutes = require("./src/routes/webhook");
const tracking = require("./src/routes/tracking");
const calculatorRoutes = require("./src/routes/calculator");
const { logger } = require("./src/config/logger");

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
const initBot = async () => {
  try {
    // Verificar la conexión antes de iniciar
    await bot.telegram.getMe();
    logger.info("Bot conectado exitosamente");

    // Iniciar el polling con opciones
    await bot.launch({
      polling: {
        timeout: 30,
        limit: 100,
      },
    });
  } catch (error) {
    logger.error("Error al iniciar el bot:", error);
    console.log(error);
    // Reintentar la conexión después de un delay
    setTimeout(initBot, 5000);
  }
};

initBot();

// Rutas para suscripción y éxito
app.use("/subscription", subscriptionRoutes);
app.use("/success", successRoutes);
app.use("/webhook", webhookRoutes);
app.use("/tracking", tracking);
app.use("/calculator", calculatorRoutes);

// Middleware para manejar rutas no encontradas y servir la página 404
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "public/views", "404.html"));
});

// Iniciar el servidor
app.listen(port, host, async () => {
  try {
    logger.info(
      `Servidor corriendo en el puerto ${port} en modo ${process.env.NODE_ENV}`
    );
  } catch (error) {
    logger.error(`Error en servidor: ${error}`);
  }
});
