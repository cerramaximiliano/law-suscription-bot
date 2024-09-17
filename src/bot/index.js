const { Telegraf, session } = require("telegraf");
const { botToken } = require("../../config/env");
const bot = new Telegraf(botToken);
require("./middlewares")(bot);
const trackingMiddleware = require("./middlewares");
const Tracking = require("../models/trackingModel");
const {logger} = require("../config/logger");
const Subscription = require("../models/subscriptionModel");
const { saveMessageIdAndDate } = require("../controllers/subscriptionController");
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
    if (
      error.response &&
      error.response.error_code === 400 &&
      error.response.description.includes("message is not modified")
    ) {
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
bot.use((ctx, next) => {
  if (!ctx.session) {
    ctx.session = {}; // Inicializa la sesión si no está definida
  }
  return next();
});

// Comando /start
bot.start(async (ctx) => {
  const BASE_URL = process.env.BASE_URL;
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  const subscriptionUrl = `${BASE_URL}/suscripcion?userId=${userId}&name=${encodeURIComponent(
    firstName
  )}&chatid=${chatId}`;

  const subscription = await Subscription.findOne({ userId: userId });

  if (ctx.chat.type === "private") {
    // Mensaje cuando el bot es iniciado en una conversación privada
    if (subscription) {
      require("../controllers/subscriptionBotController").handleBotAccess(ctx);
    } else {
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
    }
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
  const userId = ctx.from.id;
  if (!ctx.session) {
    ctx.session = {}; // Inicializa la sesión si no está definida
  }

  // Manejo de número de CD
  if (ctx.session.waitingForCDNumber) {
    const input = ctx.message.text;

    // Validar que el número tenga 9 dígitos seguidos opcionalmente de un texto separado por espacio
    const match = input.match(/^(\d{9})(?:\s+(.+))?$/);

    if (match) {
      const cdNumber = match[1]; // El número de 9 dígitos
      const alias = match[2] ? match[2].trim() : null; // El texto adicional opcional
      logger.info(`Input: cd number ${cdNumber}, alias ${alias}`);
      try {
        // Verificar si el tracking ya existe en la base de datos
        const existingTracking = await Tracking.findOne({
          userId: ctx.from.id,
          trackingCode: cdNumber,
          trackingType: "carta_documento",
        });

        if (existingTracking) {
          // Si el tracking ya existe, no hacer scraping y enviar un mensaje
          const sentMessage = await editMessageWithButtons(
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
          await saveMessageIdAndDate(userId, sentMessage.message_id);
        } else {
          // Si el tracking no existe, proceder con el scraping
          const sentMessage = await editMessageWithButtons(
            ctx,
            "Nuevo seguimiento agregado exitosamente. En unos minutos se verificará la validez del mismo.",
            [
              [
                {
                  text: "Volver al Menú Principal",
                  callback_data: "back_to_main",
                },
              ],
            ]
          );
          await saveMessageIdAndDate(userId, sentMessage.message_id);
          const saveUnverifiedTracking = await Tracking.create({
            userId: ctx.from.id,
            trackingCode: cdNumber,
            trackingType: "carta_documento",
            isVerified: false,
            isValid: false,
            alias: alias,
          });

        }

        // Eliminar el mensaje que contiene el número de 9 dígitos ingresado por el usuario
        setTimeout(() => {
          ctx.deleteMessage(ctx.message.message_id).catch((err) => {
            logger.error("Error al eliminar el mensaje del usuario:", err);
          });
        }, 3000); // 3000 milisegundos = 3 segundos (puedes ajustar este tiempo)
      } catch (err) {
        logger.info("Error web scraping: ", err);
        const sentMessage = await editMessageWithButtons(
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
        await saveMessageIdAndDate(userId, sentMessage.message_id);
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

  // Manejo de alias
  else if (ctx.session.waitingForAlias) {
    const alias = ctx.message.text;
    const trackingId = ctx.session.trackingIdForAlias;

    try {
      // Actualizar el documento del tracking con el alias proporcionado
      const tracking = await Tracking.findByIdAndUpdate(trackingId, {
        alias: alias,
      });
      const trackingCode = tracking.trackingCode;
      // Eliminar el mensaje ingresado por el usuario (que contiene el alias)
      setTimeout(() => {
        ctx.deleteMessage(ctx.message.message_id).catch((err) => {
          console.error(
            "Error al eliminar el mensaje ingresado por el usuario:",
            err
          );
        });
      }, 5000); // 5000 milisegundos = 5 segundos

      // Verificar que messageIdToEdit tenga un valor válido
      if (ctx.session.messageIdToEdit) {
        const sentMessage = await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.messageIdToEdit, // El mensaje que queremos editar
          undefined,
          `Alias "${alias}" agregado exitosamente para la CD ${trackingCode}.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Volver",
                    callback_data: `view_tracking_movements_${trackingId}`,
                  },
                ],
              ],
            },
          }
        );
        await saveMessageIdAndDate(userId, sentMessage.message_id);
      } else {
        // Si no hay messageIdToEdit, responde con un nuevo mensaje
        const sentMessage = await ctx.reply(
          `Alias "${alias}" agregado exitosamente para la CD ${trackingId}.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Volver",
                    callback_data: `view_tracking_movements_${trackingId}`,
                  },
                ],
              ],
            },
          }
        );
        await saveMessageIdAndDate(userId, sentMessage.message_id);
      }

      // Restablecer el estado de la sesión
      ctx.session.waitingForAlias = false;
      ctx.session.trackingIdForAlias = null;
    } catch (error) {
      logger.error("Error al guardar el alias:", error);
      await ctx.reply(
        "Hubo un problema al guardar el alias. Intenta nuevamente."
      );
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
  await require("../controllers/subscriptionBotController").handleArchiveTrackingMenu(
    ctx
  );
});

// Acción para archivar un seguimiento específico
bot.action(/^archive_tracking_\w+$/, async (ctx) => {
  await require("../controllers/subscriptionBotController").handleArchiveTracking(
    ctx
  );
});

bot.action(/^send_screenshot_\w+$/, async (ctx) => {
  const trackingId = ctx.match.input.split("_").pop();

  try {
    const tracking = await Tracking.findById(trackingId);
    if (tracking && tracking.screenshots.length > 0) {
      const filePath = tracking.screenshots[0].path;
      await ctx.replyWithPhoto({ source: filePath });
    } else {
      const errorMessage = await ctx.reply(
        "No se encontró la captura de pantalla."
      );

      // Eliminar el mensaje de error después de 5 segundos
      setTimeout(() => {
        ctx.deleteMessage(errorMessage.message_id).catch((err) => {
          console.error("Error al eliminar el mensaje de error:", err);
        });
      }, 5000); // 5000 milisegundos = 5 segundos
    }
  } catch (error) {
    logger.error("Error al enviar la imagen:", error);

    const errorMessage = await ctx.reply(
      "Hubo un problema al enviar la imagen. Por favor, intenta nuevamente más tarde."
    );

    // Eliminar el mensaje de error después de 5 segundos
    setTimeout(() => {
      ctx.deleteMessage(errorMessage.message_id).catch((err) => {
        logger.error("Error al eliminar el mensaje de error:", err);
      });
    }, 5000); // 5000 milisegundos = 5 segundos
  }
});

bot.action(/^add_alias_\w+$/, async (ctx) => {
  await require("../controllers/subscriptionBotController").handleAddAlias(ctx);
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
