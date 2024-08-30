const Subscription = require("../models/subscriptionModel");

module.exports = (bot) => {
  bot.use(async (ctx, next) => {
    if (ctx.message) {
      // Si el contexto tiene un mensaje con texto
      console.log(
        `Recibido mensaje de ${ctx.from.username}: ${ctx.message.text}`
      );
    } else if (ctx.callbackQuery) {
      // Si el contexto proviene de un callbackQuery (botón de teclado en línea)
      console.log(
        `Recibido callbackQuery de ${ctx.from.username}: ${ctx.callbackQuery.data}`
      );
    }

    // Continuar al siguiente middleware
    await next();
  });

  // Throttling
  const rateLimit = require("telegraf-ratelimit");
  const limitConfig = {
    window: 1000, // Tiempo de la ventana en ms
    limit: 1, // Número de mensajes permitidos por ventana de tiempo
    onLimitExceeded: async (ctx) => {
      const message = await ctx.reply(
        "Estás enviando mensajes muy rápido, por favor espera un momento."
      );

      // Eliminar el mensaje después de 5 segundos (5000 ms)
      setTimeout(() => {
        ctx.deleteMessage(message.message_id).catch((err) => {
          console.error("Error eliminando el mensaje:", err);
        });
      }, 5000); // 5000 ms = 5 segundos
    },
  };
  bot.use(rateLimit(limitConfig));
};

const trackingMiddleware = async (ctx, next) => {
  // Verificar si ctx.from existe antes de acceder a sus propiedades
  if (ctx.from && ctx.from.id) {
    const userId = ctx.from.id;

    try {
      // Verificar si existe una suscripción activa
      const subscription = await Subscription.findOne({ userId: userId });

      if (subscription && subscription.status === "active") {
        // Si la suscripción está activa, continuar con la ejecución normal
        await next();
      } else {
        // Si no hay una suscripción activa, reemplazar el menú existente
        if (ctx.update.callback_query) {
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          const firstName = ctx.from.first_name;

          const BASE_URL = process.env.BASE_URL;

          const subscriptionUrl = `${BASE_URL}/suscripcion?userId=${userId}&name=${encodeURIComponent(
            firstName
          )}&chatid=${chatId}`;
          await ctx.editMessageText(
            "No tienes una suscripción activa. Presiona el botón para suscribirte:",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Suscribirme",
                      url: subscriptionUrl, // El enlace de suscripción se pasa como URL en el botón
                    },
                    { text: "Volver", callback_data: "back_to_main" },
                  ],
                ],
              },
            }
          );
        } else {
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          const firstName = ctx.from.first_name;

          const BASE_URL = process.env.BASE_URL;

          const subscriptionUrl = `${BASE_URL}/suscripcion?userId=${userId}&name=${encodeURIComponent(
            firstName
          )}&chatid=${chatId}`;

          await ctx.reply(
            "No tienes una suscripción activa. Presiona el botón para suscribirte:",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Suscribirme",
                      url: subscriptionUrl, // El enlace de suscripción se pasa como URL en el botón
                    },
                    { text: "Volver", callback_data: "back_to_main" },
                  ],
                ],
              },
            }
          );
        }
      }
    } catch (error) {
      console.error("Error al verificar la suscripción:", error);
      // Reemplazar el mensaje con un mensaje de error
      if (ctx.update.callback_query) {
        await ctx.editMessageText(
          "Hubo un problema al verificar tu suscripción. Por favor, intenta nuevamente más tarde.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Volver", callback_data: "back_to_main" }],
              ],
            },
          }
        );
      } else {
        await ctx.reply(
          "Hubo un problema al verificar tu suscripción. Por favor, intenta nuevamente más tarde.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Volver", callback_data: "back_to_main" }],
              ],
            },
          }
        );
      }
    }
  } else {
    // Si ctx.from no está definido, manejar el error
    console.error("Error: ctx.from no está definido");
    if (ctx.chat && ctx.chat.id) {
      await ctx.telegram.sendMessage(
        ctx.chat.id,
        "Hubo un problema al procesar tu solicitud. Por favor, intenta nuevamente más tarde."
      );
    }
  }
};

module.exports = trackingMiddleware;

module.exports = trackingMiddleware;
