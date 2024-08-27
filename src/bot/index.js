const { Telegraf } = require("telegraf");
const { botToken } = require("../../config/env");
const bot = new Telegraf(botToken);

// Importar middlewares
require("./middlewares")(bot);
const trackingMiddleware = require("./middlewares");
const suscriptionsTopic = process.env.TOPIC_SUSCRIPTIONS;

// Comando /start
bot.start((ctx) => {
  const BASE_URL = process.env.BASE_URL;
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  const subscriptionUrl = `${BASE_URL}/suscripcion?userId=${userId}&name=${encodeURIComponent(
    firstName
  )}&chatid=${chatId}`;

  if (ctx.chat.type === "private") {
    // Mensaje cuando el bot es iniciado en una conversación privada
    ctx.reply(
      `¡Hola! Este bot está diseñado para suscripciones dentro de un grupo.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Unirme al grupo",
                url: "https://t.me/lawinfochatbot", // Enlace de invitación al grupo
              },
              {
                text: "Suscribirme",
                url: subscriptionUrl, // Enlace de suscripción
              },
            ],
          ],
        },
      }
    );
  } else if (
    ctx.message &&
    ctx.message.message_thread_id == suscriptionsTopic
  ) {
    // Mensaje cuando el bot es iniciado en el topic específico dentro de un grupo
    ctx.reply(
      `¡Bienvenido! Suscríbete a nuestro servicio premium para obtener acceso completo a todas las funciones. Con la suscripción, podrás realizar un seguimiento detallado de causas legales y telegramas/documentos.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Suscribirme", callback_data: "suscribirme" }],
          ],
        },
      }
    );
  }
});

// Acción para el botón de suscripción
bot.action("suscribirme", (ctx) => {
  require("../controllers/subscriptionBotController").handleBotSubscription(
    ctx
  );
});

bot.command(
  "comenzar",
  require("../controllers/subscriptionBotController").handleBotAccess
);

bot.action(
  "subscription_info",
  require("../controllers/subscriptionBotController").handleSubscriptionInfo
);

// Acción para cancelar suscripción
bot.action(
  "cancel_subscription",
  require("../controllers/subscriptionBotController").handleCancelSubscription
);
// Acción para cambiar método de pago
bot.action(
  "change_payment_method",
  require("../controllers/subscriptionBotController").handleChangePaymentMethod
);

// Aplicar el middleware solo en las acciones de tracking
bot.action(
  "tracking_options",
  trackingMiddleware,
  require("../controllers/subscriptionBotController").handleTrackingOptions
);
bot.action(
  "tracking_causas",
  trackingMiddleware,
  require("../controllers/subscriptionBotController").handleTrackingCausas
);
bot.action(
  "tracking_telegramas",
  trackingMiddleware,
  require("../controllers/subscriptionBotController").handleTrackingTelegramas
);

bot.action(
  "back_to_main",
  require("../controllers/subscriptionBotController").handleBackToMain
);

bot.catch((err, ctx) => {
  console.error(`Error en el bot para ${ctx.updateType}:`, err);
});

// Exportar el bot para ser utilizado en otras partes del proyecto
module.exports = bot;
