const { Telegraf } = require('telegraf');
const { botToken } = require('../../config/env');
const bot = new Telegraf(botToken);


// Importar middlewares
require('./middlewares')(bot);

// Comando /start
bot.start((ctx) => {
  ctx.reply(`Hola, ${ctx.from.first_name}! Usa /suscribirme para comenzar tu suscripción.`);
});

// Comando /suscribirme
bot.command('suscribirme', require('../controllers/subscriptionBotController').handleBotSubscription);

// Exportar el bot para ser utilizado en otras partes del proyecto
module.exports = bot;
