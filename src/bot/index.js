const { Telegraf, session } = require("telegraf");
const { botToken } = require("../../config/env");
const bot = new Telegraf(botToken);
require("./middlewares")(bot);
const trackingMiddleware = require("./middlewares");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scraper");
const logger = require("../config/logger");
const suscriptionsTopic = process.env.TOPIC_SUSCRIPTIONS;

async function editMessageWithButtons(ctx, text, buttons) {
  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      ctx.session.messageIdToEdit,
      undefined,
      text,
      {
        reply_markup: {
          inline_keyboard: buttons,
        },
      }
    );
  } catch (error) {
    if (error.response && error.response.error_code === 400 && error.response.description.includes("message is not modified")) {
      logger.warn("El mensaje no se modificó porque el contenido es el mismo.");
    } else {
      logger.error("Error al editar el mensaje:", error);
      const errorMessage = await ctx.reply(
        "Hubo un problema al actualizar el mensaje. Por favor, intenta nuevamente."
      );
      setTimeout(() => {
        ctx.deleteMessage(errorMessage.message_id).catch((err) => {
          console.error("Error al eliminar el mensaje de error:", err);
        });
      }, 5000);
    }
  }
}
bot.use(session());

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

bot.on("text", async (ctx) => {
  if (!ctx.session) {
    ctx.session = {}; // Inicializa la sesión si no está definida
  }

  if (ctx.session.waitingForCDNumber) {
    const cdNumber = ctx.message.text;

    // Validar que el número tenga 9 dígitos
    if (/^\d{9}$/.test(cdNumber)) {
      try {
        // Verificar si el tracking ya existe en la base de datos
        const existingTracking = await Tracking.findOne({
          userId: ctx.from.id,
          trackingCode: cdNumber,
          trackingType: "carta_documento",
        });

        if (existingTracking) {
          // Si el tracking ya existe, no hacer scraping y enviar un mensaje
          await editMessageWithButtons(
            ctx,
            `El número de CD (${cdNumber}) ya se encuentra agregado.`,
            [
              [{ text: "Agregar Otro", callback_data: "add_new_telegrama" }],
              [
                {
                  text: "Ver Seguimientos",
                  callback_data: "view_all_telegramas",
                },
              ],
              [
                {
                  text: "Volver al Menú Principal",
                  callback_data: "back_to_main",
                },
              ],
            ]
          );
        } else {
          // Si el tracking no existe, proceder con el scraping
          await editMessageWithButtons(
            ctx,
            "Verificando la existencia del tracking, esto puede tardar unos minutos...",
            [
              [
                {
                  text: "Volver al Menú Principal",
                  callback_data: "back_to_main",
                },
              ],
            ]
          );

          const scrapingResult = await scrapeCA(
            cdNumber,
            ctx.from.id,
            "",
            "carta_documento"
          );

          if (scrapingResult.success) {
            logger.info(
              `Tracking guardado por scraping para el usuario ${ctx.from.id} con código ${cdNumber}.`
            );

            await editMessageWithButtons(
              ctx,
              `Número de CD (${cdNumber}) recibido correctamente.`,
              [
                [{ text: "Agregar Otro", callback_data: "add_new_telegrama" }],
                [
                  {
                    text: "Ver Seguimientos",
                    callback_data: "view_all_telegramas",
                  },
                ],
                [
                  {
                    text: "Volver al Menú Principal",
                    callback_data: "back_to_main",
                  },
                ],
              ]
            );
          } else {
            logger.info(`No se encontraron resultados para el número de CD (${cdNumber}).`);

            await editMessageWithButtons(
              ctx,
              `No se encontraron resultados para el número de CD (${cdNumber}).`,
              [
                [{ text: "Agregar Otro", callback_data: "add_new_telegrama" }],
                [
                  {
                    text: "Ver Seguimientos",
                    callback_data: "view_all_telegramas",
                  },
                ],
                [
                  {
                    text: "Volver al Menú Principal",
                    callback_data: "back_to_main",
                  },
                ],
              ]
            );
          }
        }

        // Eliminar el mensaje que contiene el número de 9 dígitos ingresado por el usuario
        setTimeout(() => {
          ctx.deleteMessage(ctx.message.message_id).catch((err) => {
            logger.error("Error al eliminar el mensaje del usuario:", err);
          });
        }, 3000); // 3000 milisegundos = 3 segundos (puedes ajustar este tiempo)
      } catch (err) {
        logger.info("Error web scraping: ", err);
        await editMessageWithButtons(
          ctx,
          "No se pudo verificar el tracking. Asegúrate de que el código es correcto e inténtalo de nuevo.",
          [
            [{ text: "Agregar Otro", callback_data: "add_new_telegrama" }],
            [
              {
                text: "Ver Seguimientos",
                callback_data: "view_all_telegramas",
              },
            ],
            [
              {
                text: "Volver al Menú Principal",
                callback_data: "back_to_main",
              },
            ],
          ]
        );
      }

      // Resetea el estado
      ctx.session.waitingForCDNumber = false;
    } else {
      // Si el número no es válido, solicita nuevamente, editando el mensaje original
      await editMessageWithButtons(
        ctx,
        "El número ingresado no es válido. Asegúrate de que tenga 9 dígitos. Por favor, inténtalo de nuevo:",
        [[{ text: "Volver", callback_data: "tracking_telegramas" }]]
      );
      setTimeout(() => {
        ctx.deleteMessage(ctx.message.message_id).catch((err) => {
          logger.error("Error al eliminar el mensaje del usuario:", err);
        });
      }, 3000);
    }
  }
});

// Acción para el botón de suscripción
bot.action("suscribirme", (ctx) => {
  require("../controllers/subscriptionBotController").handleBotSubscription(
    ctx
  );
});

bot.action("start_access", (ctx) => {
  require("../controllers/subscriptionBotController").handleBotAccess(ctx);
});

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

bot.action("delete_tracking_menu", async (ctx) => {
  await require("../controllers/subscriptionBotController").handleDeleteTrackingMenu(
    ctx
  );
});

bot.action(/^delete_tracking_\w+$/, async (ctx) => {
  await require("../controllers/subscriptionBotController").handleDeleteTracking(
    ctx
  );
});

bot.action("view_all_telegramas", async (ctx) => {
  await require("../controllers/subscriptionBotController").handleViewAllTelegramas(
    ctx
  );
});

bot.action(/^view_tracking_movements_\w+$/, async (ctx) => {
  await require("../controllers/subscriptionBotController").handleViewTrackingMovements(
    ctx
  );
});

bot.action(
  "back_to_main",
  require("../controllers/subscriptionBotController").handleBackToMain
);

bot.action("add_new_telegrama", async (ctx) => {
  await require("../controllers/subscriptionBotController").handleAddNewTelegrama(
    ctx
  ); // Llama a la función que muestra el nuevo menú
});

bot.action("tracking_telegramas", async (ctx) => {
  await require("../controllers/subscriptionBotController").handleTrackingTelegramas(
    ctx
  ); // Vuelve al menú anterior
});

bot.action("add_carta_documento", async (ctx) => {
  await require("../controllers/subscriptionBotController").handleAddCartaDocumento(
    ctx
  ); // Solicita el número de CD
});
// También asegúrate de manejar los callback para 'add_carta_documento' y 'add_telegrama'
// para que realicen la acción deseada, como mostrar un formulario o iniciar un seguimiento.

// Acción para mostrar el menú de archivado
bot.action("archive_tracking_menu", async (ctx) => {
  await require("../controllers/subscriptionBotController").handleArchiveTrackingMenu(ctx);
});

// Acción para archivar un seguimiento específico
bot.action(/^archive_tracking_\w+$/, async (ctx) => {
  await require("../controllers/subscriptionBotController").handleArchiveTracking(ctx);
});


bot.catch((err, ctx) => {
  logger.error(`Error en el bot para ${ctx.updateType}:`, err.message);
  logger.error(`Stack Trace: ${err.stack}`);
  if (ctx) {
    logger.error(`Contexto del error: ${JSON.stringify(ctx)}`);
  }
});

// Exportar el bot para ser utilizado en otras partes del proyecto
module.exports = bot;
