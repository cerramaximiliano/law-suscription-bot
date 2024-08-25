const express = require('express');
const mongoose = require('mongoose');
const { botToken, port, mongoUri } = require('./config/env');
const bot = require('./src/bot'); // Importar la lógica del bot
const subscriptionRoutes = require('./src/routes/subscription'); // Importar las rutas de suscripción
const successRoutes = require('./src/routes/success'); // Importar la ruta de éxito

const app = express();

// Configurar middlewares y parseo de JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar a MongoDB
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((err) => {
  console.error('Error al conectar a MongoDB:', err);
});

// Iniciar el bot de Telegram
bot.launch();

// Rutas para suscripción y éxito
app.use('/suscripcion', subscriptionRoutes);
app.use('/success', successRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port} en modo ${process.env.NODE_ENV}`);
});
