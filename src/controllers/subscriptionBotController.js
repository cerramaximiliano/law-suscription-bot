const bot = require("../bot");
const Subscription = require("../models/subscriptionModel");
const moment = require("moment");
const { stripeSecretKey } = require("../../config/env");
const Stripe = require("stripe");
const Tracking = require("../models/trackingModel");
const stripe = Stripe(stripeSecretKey);
const { getTrackingTelegramas } = require("../controllers/trackingController");
const { logger } = require("../config/logger");
const { truncateText } = require("../utils/format");
const { saveMessageIdAndDate } = require("./subscriptionController");
const URL_BASE = process.env.BASE_URL;

// En esta función solo se envían mensajes en el GRUPO - No guardo el message id
exports.handleBotSubscription = async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  const BASE_URL = process.env.BASE_URL;

  const subscriptionUrl = `${BASE_URL}/subscription?userId=${userId}&name=${encodeURIComponent(
    firstName
  )}&chatid=${chatId}`;

  try {
    const subscription = await Subscription.findOne({ userId: userId });

    if (subscription && subscription.status === "active") {
      // Si la suscripción está activa, enviar un mensaje informando al usuario
      const sentMessage = await ctx.reply(
        "Ya tienes una suscripción activa. ¡Gracias por ser parte de nuestro servicio!"
      );
      setTimeout(() => {
        ctx.telegram
          .deleteMessage(chatId, sentMessage.message_id)
          .catch(console.error);
      }, 10000);
    } else {
      // Enviar mensaje privado con el enlace de suscripción
      const sentMessage = await ctx.telegram.sendMessage(
        userId,
        `Hola ${firstName}, para suscribirte, haz clic en el botón de abajo:`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Suscribirme",
                  url: subscriptionUrl, // El enlace de suscripción se pasa como URL en el botón
                },
              ],
            ],
          },
        }
      );
      // Enviar mensaje en el grupo informando al usuario que revise el mensaje privado
      const groupMessage = await ctx.reply(
        "Te he enviado un mensaje por privado. Por favor, revisa la conversación para poder continuar."
      );

      // Eliminar el mensaje en el grupo después de 10 segundos
      setTimeout(() => {
        ctx.telegram
          .deleteMessage(chatId, groupMessage.message_id)
          .catch(console.error);
      }, 10000);
    }
  } catch (error) {
    logger.error("Error al enviar mensaje privado:", error);
    await ctx.reply(
      "No pude enviarte un mensaje privado. Asegúrate de que el bot pueda enviarte mensajes directos."
    );
  }
};

exports.handleBotAccess = async (ctx) => {
  const userId = ctx.from.id;
  logger.info(`User ID: ${userId}`); // Log para verificar el userId

  try {
    const subscription = await Subscription.findOne({ userId: userId });
    logger.info(`Subscription found: ${subscription}`); // Log para verificar la suscripción

    if (subscription && subscription.status === "active") {
      logger.info("Subscription is active");

      // Si es una llamada desde un callback_query
      if (ctx.update.callback_query && ctx.update.callback_query.message) {
        const sentMessage = await ctx.editMessageText(
          "Selecciona una opción:",
          {
            chat_id: ctx.chat.id,
            message_id: ctx.update.callback_query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: "Suscripción", callback_data: "subscription_info" }],
                [{ text: "Servicios", callback_data: "tracking_options" }],
              ],
            },
          }
        );
        // Guardar el messageId y la fecha en el documento Tracking
        await saveMessageIdAndDate(userId, sentMessage.message_id);
      } else {
        // Si es una llamada desde /start o un mensaje regular
        const sentMessage = await ctx.reply("Selecciona una opción:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Suscripción", callback_data: "subscription_info" }],
              [{ text: "Servicios", callback_data: "tracking_options" }],
            ],
          },
        });
        await saveMessageIdAndDate(userId, sentMessage.message_id);
      }
    } else {
      logger.info("No active subscription found");
      const chatId = ctx.chat.id;
      const firstName = ctx.from.first_name;

      const BASE_URL = process.env.BASE_URL;
      const subscriptionUrl = `${BASE_URL}/subscription?userId=${userId}&name=${encodeURIComponent(
        firstName
      )}&chatid=${chatId}`;

      if (ctx.update.callback_query && ctx.update.callback_query.message) {
        const sentMessage = await ctx.editMessageText(
          "No tienes una suscripción activa. Presiona el botón para suscribirte:",
          {
            chat_id: ctx.chat.id,
            message_id: ctx.update.callback_query.message.message_id,
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
        await saveMessageIdAndDate(userId, sentMessage.message_id);
      } else {
        const sentMessage = await ctx.reply(
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
        await saveMessageIdAndDate(userId, sentMessage.message_id);
      }
    }
  } catch (error) {
    logger.error("Error al verificar la suscripción:", error);

    if (ctx.update.callback_query && ctx.update.callback_query.message) {
      const sentMessage = await ctx.editMessageText(
        "Hubo un problema al verificar tu suscripción. Por favor, intenta nuevamente más tarde.",
        {
          chat_id: ctx.chat.id,
          message_id: ctx.update.callback_query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    } else {
      const sentMessage = await ctx.reply(
        "Hubo un problema al verificar tu suscripción. Por favor, intenta nuevamente más tarde."
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    }
  }
};

exports.handleSubscriptionInfo = async (ctx) => {
  const userId = ctx.from.id;

  try {
    // Buscar la suscripción en tu base de datos
    const subscription = await Subscription.findOne({ userId: userId });
    const chatId = ctx.chat.id;
    const firstName = ctx.from.first_name;

    const BASE_URL = process.env.BASE_URL;

    const subscriptionUrl = `${BASE_URL}/subscription?userId=${userId}&name=${encodeURIComponent(
      firstName
    )}&chatid=${chatId}`;

    if (!subscription) {
      const sentMessage = await ctx.editMessageText(
        "No tienes una suscripción activa. Presiona el botón para suscribirte.",
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
      await saveMessageIdAndDate(userId, sentMessage.message_id);
      return;
    }

    logger.info(
      "Database status subscription",
      subscription.status,
      "for user",
      subscription.stripeCustomerId
    );

    // Obtener detalles de la suscripción desde Stripe
    const stripeSubscription = await stripe.subscriptions.list({
      customer: subscription.stripeCustomerId,
      limit: 1,
    });
    logger.info(stripeSubscription);
    if (!stripeSubscription || stripeSubscription.data.length === 0) {
      logger.info("No se encontraron datos de suscripción en Stripe.");
      const sentMessage = await ctx.editMessageText(
        "No tienes una suscripción activa. Presiona el botón para suscribirte.",
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
      await saveMessageIdAndDate(userId, sentMessage.message_id);
      return;
    }

    const subscriptionDetails = stripeSubscription.data[0];
    if (!subscriptionDetails || !subscriptionDetails.status) {
      logger.info("No se pudo obtener el estado de la suscripción.");
      const sentMessage = await ctx.editMessageText(
        "Hubo un problema al obtener los datos de tu suscripción.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
      return;
    }

    logger.info("Stripe status subscription", subscriptionDetails.status);

    // Intentar obtener la próxima fecha de facturación
    let nextInvoiceDate = null;
    try {
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: subscription.stripeCustomerId,
      });
      nextInvoiceDate = moment
        .unix(upcomingInvoice.next_payment_attempt)
        .format("DD/MM/YYYY");
    } catch (err) {
      logger.error("No upcoming invoice found or error retrieving it:", err);
    }

    // Formatear las fechas y detalles que quieras mostrar
    const startDate = moment
      .unix(subscriptionDetails.start_date)
      .format("DD/MM/YYYY");
    const currentPeriodEnd = moment
      .unix(subscriptionDetails.current_period_end)
      .format("DD/MM/YYYY");
    const status = subscriptionDetails.status;

    // Mensaje adicional si la suscripción está cancelada pero activa hasta el final del ciclo
    let cancellationMessage = "";
    if (subscriptionDetails.cancel_at_period_end) {
      cancellationMessage =
        "\nNota: Tu suscripción ha sido cancelada y finalizará el " +
        currentPeriodEnd +
        ".";
    }

    // Preparar el mensaje con la próxima fecha de facturación (si existe)
    let invoiceMessage = nextInvoiceDate
      ? `\nPróxima fecha de facturación: ${nextInvoiceDate}`
      : `\nPróxima fecha de facturación: No disponible`;

    // Editar el mensaje existente para mostrar la información de la suscripción
    const sentMessage = await ctx.editMessageText(
      `Datos de tu suscripción:\n\nEstado: ${status}\nFecha de suscripción: ${startDate}\nFin del período actual: ${currentPeriodEnd}${invoiceMessage}${cancellationMessage}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Administrar Suscripción",
                callback_data: "change_payment_method",
              },
            ],
            [{ text: "Volver", callback_data: "back_to_main" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al obtener los datos de suscripción:", error);
    const sentMessage = await ctx.reply(
      "Hubo un problema al obtener los datos de tu suscripción."
    );

    // Elimina el mensaje después de 5 segundos
    setTimeout(() => {
      ctx.deleteMessage(sentMessage.message_id).catch((err) => {
        logger.error("Error al eliminar el mensaje:", err);
      });
    }, 5000); // 5000 milisegundos = 5 segundos
  }
};

exports.handleTrackingOptions = async (ctx) => {
  const userId = ctx.from.id;
  try {
    const newText = "Selecciona una opción:";
    const currentText = ctx.update.callback_query.message.text;

    // Verificar si el contenido del mensaje ha cambiado
    if (newText !== currentText) {
      const sentMessage = await ctx.editMessageText(newText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Seguimiento de Causas",
                callback_data: "tracking_causas",
              },
            ],
            [
              {
                text: "Tracking de Telegramas/Cartas",
                callback_data: "tracking_telegramas",
              },
            ],
            [{ text: "Cálculos Legales", callback_data: "calculos_legales" }][
              { text: "Volver", callback_data: "back_to_main" }
            ],
          ],
        },
      });
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    }
  } catch (error) {
    if (
      error.code === 400 &&
      error.description.includes("message is not modified")
    ) {
      logger.error(
        "El mensaje ya tiene el contenido actualizado. No es necesario editarlo."
      );
    } else {
      logger.error("Error al manejar las opciones de tracking:", error);
    }
  }
};

exports.handleTrackingCausas = async (ctx) => {
  const userId = ctx.from.id;
  const trackingCausas = await getTrackingCausas(userId); // Implementar la función para obtener los datos

  const elementosMsg =
    trackingCausas.length > 0
      ? trackingCausas
          .map((item) => `Número de causa: ${item.numero}`)
          .join("\n")
      : "Sin elementos";

  const sentMessage = await ctx.editMessageText(
    `Tus causas seguidas:\n\n${elementosMsg}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Agregar Nueva Causa", callback_data: "add_new_causa" }],
          [{ text: "Ver Todas las Causas", callback_data: "view_all_causas" }],
          [{ text: "Volver", callback_data: "tracking_options" }],
        ],
      },
    }
  );
  await saveMessageIdAndDate(userId, sentMessage.message_id);
};

// Este método maneja el click en "Agregar Nuevo Telegrama/Carta"
exports.handleAddNewTelegrama = async (ctx) => {
  const userId = ctx.from.id;

  try {
    // Contar los registros activos (isCompleted: false) del usuario
    const activeTrackingsCount = await Tracking.countDocuments({
      userId: userId,
      isArchive: false,
      isErase: false,
    });

    // Verificar si se ha alcanzado el límite de 10 registros activos
    if (activeTrackingsCount >= 10) {
      const sentMessage = await ctx.editMessageText(
        "Has alcanzado el límite de 10 seguimientos activos. Elimina o archiva un seguimiento  para agregar uno nuevo.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "tracking_telegramas" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    } else {
      // Mostrar el menú para agregar un nuevo telegrama/carta si no se ha alcanzado el límite
      const sentMessage = await ctx.editMessageText(
        "Elige la opción deseada:",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Carta Documento Correo Argentino",
                  callback_data: "add_carta_documento",
                },
              ],
              [
                {
                  text: "Telegrama Correo Argentino",
                  callback_data: "add_telegrama",
                },
              ],
              [{ text: "Volver", callback_data: "tracking_telegramas" }], // Vuelve al menú anterior
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    }
  } catch (error) {
    logger.error(
      "Error al verificar el número de seguimientos activos:",
      error
    );
    await ctx.reply(
      "Hubo un problema al verificar tus seguimientos activos. Por favor, intenta nuevamente."
    );
  }
};

exports.handleDeleteTrackingMenu = async (ctx) => {
  const userId = ctx.from.id;
  const trackingTelegramas = await getTrackingTelegramas(userId, {
    isArchive: false,
    isErase: false,
  }); // Obtener los datos

  // Verificar si hay elementos para eliminar
  if (trackingTelegramas.length === 0) {
    const sentMessage = await ctx.editMessageText(
      "No tienes seguimientos activos para eliminar.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);

    return;
  }

  // Crear botones para cada elemento de seguimiento con trackingCode y alias
  const buttons = trackingTelegramas.map((item) => {
    // Construir el texto con trackingCode y alias si existe
    let displayText = `CD${item.trackingCode}`;
    if (item.alias) {
      displayText += ` - ${truncateText(item.alias)}`; // Agregar alias truncado si es necesario
    }

    return [
      {
        text: displayText, // Mostrar el trackingCode junto con el alias
        callback_data: `delete_tracking_${item._id}`, // Usamos el ID del elemento para identificarlo
      },
    ];
  });

  // Agregar el botón de "Volver"
  buttons.push([{ text: "Volver", callback_data: "tracking_telegramas" }]);

  const sentMessage = await ctx.editMessageText(
    "Elige el seguimiento que deseas eliminar:",
    {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  );
  await saveMessageIdAndDate(userId, sentMessage.message_id);
};

exports.handleDeleteTracking = async (ctx) => {
  const trackingId = ctx.update.callback_query.data.split("_").pop(); // Obtener el ID del seguimiento desde el callback_data
  const userId = ctx.from.id; // Obtener el ID del usuario
  try {
    // Encontrar y actualizar el seguimiento, marcando isErase como true
    const tracking = await Tracking.findById(trackingId);
    if (tracking) {
      tracking.isErase = true;
      await tracking.save();

      const sentMessage = await ctx.editMessageText(
        `El seguimiento CD${tracking.trackingCode} ha sido marcado como completado.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "tracking_telegramas" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    } else {
      const sentMessage = await ctx.editMessageText(
        "No se encontró el seguimiento. Por favor, intenta nuevamente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "tracking_telegramas" }],
            ],
          },
        }
      );
    }
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al marcar el seguimiento como completado:", error);
    const sentMessage = await ctx.editMessageText(
      "Hubo un problema al intentar eliminar el seguimiento. Por favor, intenta nuevamente.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  }
};

exports.handleAddTracking = async (ctx, trackingType) => {
  const userId = ctx.from.id; // Obtener el ID del usuario
  try {
    if (!ctx.session) {
      ctx.session = {}; // Inicializa la sesión si no está definida
    }

    // Envía un mensaje solicitando el número de CD de 9 dígitos y guarda el ID del mensaje
    const sentMessage = await ctx.editMessageText(
      "Escriba el *número de CD* de 9 dígitos, luego agregue un espacio y un *alias* si lo desea:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Volver", callback_data: "tracking_telegramas" }, // Callback para volver al menú anterior
            ],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);

    // Guarda el tipo de tracking (carta_documento o telegrama) y el ID del mensaje para editarlo después de la validación
    ctx.session.messageIdToEdit = sentMessage.message_id;
    ctx.session.waitingForCDNumber = true;
    ctx.session.trackingType = trackingType; // Guardar el tipo de tracking en la sesión
  } catch (error) {
    logger.error("Error al solicitar el número de CD/Telegrama:", error);
    await ctx.reply(
      "Hubo un problema al solicitar el número. Intenta nuevamente."
    );
  }
};

exports.handleAddCartaDocumento = async (ctx) => {
  await exports.handleAddTracking(ctx, "carta_documento");
};

exports.handleAddTelegrama = async (ctx) => {
  await exports.handleAddTracking(ctx, "telegrama");
};

/* exports.handleAddCartaDocumento = async (ctx) => {
  const userId = ctx.from.id; // Obtener el ID del usuario
  try {
    if (!ctx.session) {
      ctx.session = {}; // Inicializa la sesión si no está definida
    }

    // Envía un mensaje solicitando el número de CD de 9 dígitos y guarda el ID del mensaje
    const sentMessage = await ctx.editMessageText(
      "Escriba el *número de CD* de 9 dígitos, luego agregue un espacio y un *alias* si lo desea:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Volver", callback_data: "tracking_telegramas" }, // Callback para volver al menú anterior
            ],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);

    // Guarda el ID del mensaje para editarlo después de la validación
    ctx.session.messageIdToEdit = sentMessage.message_id;

    // Configura el bot para esperar la entrada del usuario
    ctx.session.waitingForCDNumber = true;
  } catch (error) {
    logger.error("Error al solicitar el número de CD:", error);
    ctx.reply(
      "Hubo un problema al solicitar el número de CD. Intenta nuevamente."
    );
  }
}; */

exports.handleBackToMain = async (ctx) => {
  const userId = ctx.from.id; // Obtener el ID del usuario
  try {
    const newText = "Selecciona una opción:";
    const currentText = ctx.update.callback_query.message.text;

    // Verificar si el contenido del mensaje ha cambiado
    if (newText !== currentText) {
      const sentMessage = await ctx.editMessageText(newText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Suscripción",
                callback_data: "subscription_info",
              },
            ],
            [{ text: "Servicios", callback_data: "tracking_options" }],
            [{ text: "Sitio Web", url: URL_BASE }],
          ],
        },
      });
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    }
  } catch (error) {
    if (
      error.code === 400 &&
      error.description.includes("message is not modified")
    ) {
      logger.info(
        "El mensaje ya tiene el contenido actualizado. No es necesario editarlo."
      );
    } else {
      logger.error("Error al manejar el retorno al menú principal:", error);
    }
  }
};

exports.handleCancelSubscription = async (ctx) => {
  const userId = ctx.from.id;

  try {
    const subscription = await Subscription.findOne({ userId: userId });

    if (subscription && subscription.status === "active") {
      subscription.status = "canceled";
      await subscription.save();

      const sentMessage = await ctx.reply(
        "Tu suscripción ha sido cancelada. Gracias por usar nuestros servicios."
      );
    } else {
      await ctx.reply("No tienes una suscripción activa para cancelar.");
    }
  } catch (error) {
    logger.error("Error al cancelar la suscripción:", error);
    await ctx.reply(
      "Hubo un problema al cancelar tu suscripción. Por favor, inténtalo nuevamente más tarde."
    );
  }
};

exports.handleChangePaymentMethod = async (ctx) => {
  const userId = ctx.from.id;

  try {
    // Obtener la suscripción del usuario desde la base de datos
    const subscription = await Subscription.findOne({ userId: userId });

    if (!subscription || !subscription.stripeCustomerId) {
      await ctx.reply(
        "No se pudo encontrar una suscripción activa. Por favor, verifica tu estado de suscripción."
      );
      return;
    }

    // Crear una sesión del portal de facturación de Stripe
    const billingPortalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: process.env.BASE_URL, // URL a la que se redirige al usuario después de cambiar el método de pago
    });

    // Enviar el enlace al portal de facturación al usuario
    const sentMessage = await ctx.editMessageText(
      `Por favor, sigue este enlace para administrar tu suscripción:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Administrar suscripción",
                url: billingPortalSession.url, // Enlace al portal de facturación
              },
            ],
            [
              {
                text: "Volver",
                callback_data: "subscription_info", // Callback para ir atrás
              },
            ],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al cambiar el método de pago:", error);
    await ctx.reply(
      "Hubo un problema al cambiar tu método de pago. Por favor, inténtalo nuevamente más tarde."
    );
  }
};

exports.handleNewTracking = async (ctx) => {
  const userId = ctx.from.id;
  const { trackingCode, trackingType, notificationId } = ctx.request.body; // Supongamos que estos datos vienen en la solicitud

  try {
    // Contar los seguimientos activos del usuario
    const activeTrackings = await Tracking.countDocuments({
      userId: userId,
      isErase: false,
      isArchive: false,
    });

    // Verificar si el usuario ha alcanzado el límite de 10 seguimientos activos
    if (activeTrackings >= 10) {
      return ctx.reply(
        "Has alcanzado el límite de 10 seguimientos activos. Elimina o archiva un seguimiento existente para agregar uno nuevo."
      );
    }

    // Crear un nuevo seguimiento
    const newTracking = new Tracking({
      userId: userId,
      notificationId: notificationId,
      trackingCode: trackingCode,
      trackingType: trackingType,
    });

    // Guardar el seguimiento en la base de datos
    await newTracking.save();

    // Responder al usuario
    ctx.reply(
      "Nuevo seguimiento agregado exitosamente. En unos minutos se verificará la validez del mismo."
    );
  } catch (error) {
    logger.error("Error al agregar el seguimiento:", error);
    ctx.reply("Hubo un problema al agregar el seguimiento.");
  }
};

// Ejemplo de cómo manejar la eliminación de un seguimiento
exports.handleDeleteTracking = async (ctx) => {
  const userId = ctx.from.id; // Obtener el userId para guardar el mensaje en el documento Tracking

  try {
    // Extraer el trackingId del callback_data
    const trackingId = ctx.update.callback_query.data.split("_").pop(); // Extraer el ID del seguimiento desde el callback_data

    // Buscar y eliminar el seguimiento
    await Tracking.findByIdAndDelete(trackingId);

    // Editar el mensaje para confirmar la eliminación
    const sentMessage = await ctx.editMessageText(
      "Seguimiento eliminado exitosamente.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al eliminar el seguimiento:", error);

    // Editar el mensaje para informar del problema
    const sentMessage = await ctx.editMessageText(
      "Hubo un problema al eliminar el seguimiento.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  }
};

exports.handleViewAllTelegramas = async (ctx) => {
  const userId = ctx.from.id;

  try {
    // Buscar todos los telegramas/cartas del usuario que no estén completados
    const trackingTelegramas = await Tracking.find({
      userId: userId,
      isArchive: false,
      isErase: false,
    });

    if (trackingTelegramas.length === 0) {
      const sentMessage = await ctx.editMessageText(
        "No tienes telegramas/cartas activas.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "tracking_telegramas" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
      return;
    }

    // Crear botones para cada telegrama/carta
    const buttons = trackingTelegramas.map((item) => {
      // Construir el texto del botón: CD + trackingCode y alias si existe
      let buttonText = `CD${item.trackingCode}`;
      if (item.alias) {
        buttonText += ` - ${truncateText(item.alias)}`; // Agregar alias y truncar si es necesario
      }

      return [
        {
          text: buttonText,
          callback_data: `view_tracking_movements_${item._id}`, // Usamos el ID del elemento para identificarlo
        },
      ];
    });

    // Agregar el botón de "Volver"
    buttons.push([{ text: "Volver", callback_data: "tracking_telegramas" }]);

    // Editar el mensaje para mostrar todos los telegramas/cartas
    const sentMessage = await ctx.editMessageText(
      "Selecciona un telegrama/carta para ver sus movimientos:",
      {
        reply_markup: {
          inline_keyboard: buttons,
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al obtener los telegramas/cartas:", error);
    const sentMessage = await ctx.editMessageText(
      "Hubo un problema al obtener los telegramas/cartas.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  }
};

exports.handleViewTrackingMovements = async (ctx) => {
  const userId = ctx.from.id;
  try {
    const trackingId = ctx.update.callback_query.data.split("_").pop();
    const tracking = await Tracking.findById(trackingId);

    //const trackingCode = tracking.trackingCode
    if (!tracking) {
      const sentMessage = await ctx.editMessageText(
        "No se encontró el seguimiento. Por favor, intenta nuevamente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "view_all_telegramas" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
      return;
    }

    const movements = tracking.movements;
    let message = `*CD ${
      tracking.trackingCode
    }*\nÚltima actualización: ${moment(tracking.lastUpdated).format(
      "YYYY-MM-DD HH:mm"
    )}\n\n`;
    if (movements.length === 0) {
      message += "No hay movimientos.";
    } else {
      message += movements
        .map(
          (movement) =>
            `Fecha: ${moment(movement.date).format("DD/MM/YYYY")}\nPlanta: ${
              movement.planta
            }\nHistoria: ${movement.historia}\nEstado: ${movement.estado}`
        )
        .join("\n\n");
    }

    // Editar el mensaje para mostrar los movimientos y agregar los botones
    const sentMessage = await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Agregar alias", callback_data: `add_alias_${trackingId}` }],
          [
            {
              text: "Enviar Captura de Pantalla",
              callback_data: `send_screenshot_${trackingId}`,
            },
          ],
          [{ text: "Volver", callback_data: "view_all_telegramas" }],
        ],
      },
    });
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al obtener los movimientos del seguimiento:", error);
    const sentMessage = await ctx.editMessageText(
      "Hubo un problema al obtener los movimientos del seguimiento.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "view_all_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  }
};

exports.handleAddAlias = async (ctx) => {
  const trackingId = ctx.update.callback_query.data.split("_").pop();
  const userId = ctx.from.id;
  try {
    // Buscar el documento de seguimiento
    const tracking = await Tracking.findById(trackingId);
    const trackingCode = tracking.trackingCode;

    // Envía el mensaje solicitando el alias y guarda el ID del mensaje
    const sentMessage = await ctx.editMessageText(
      `Escriba un alias para CD ${trackingCode}:`,
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
    // Guarda el ID del mensaje para editarlo más tarde
    ctx.session.messageIdToEdit = sentMessage.message_id;

    // Configura el bot para esperar el alias
    ctx.session.waitingForAlias = true;
    ctx.session.trackingIdForAlias = trackingId;
  } catch (error) {
    logger.error("Error al solicitar el alias:", error);
    await ctx.reply(
      "Hubo un problema al solicitar el alias. Intenta nuevamente."
    );
  }
};

// Ejemplo de cómo completar un seguimiento
exports.handleCompleteTracking = async (ctx) => {
  const trackingId = ctx.request.body.trackingId; // Supongamos que el ID viene en la solicitud
  const userId = ctx.from.id;
  try {
    const tracking = await Tracking.findById(trackingId);
    if (tracking) {
      await tracking.completeTracking();
      ctx.reply("Seguimiento marcado como completado.");
    } else {
      ctx.reply("No se encontró el seguimiento.");
    }
  } catch (error) {
    console.error("Error al completar el seguimiento:", error);
    ctx.reply("Hubo un problema al completar el seguimiento.");
  }
};

exports.handleArchiveTrackingMenu = async (ctx) => {
  const userId = ctx.from.id;
  const trackingTelegramas = await getTrackingTelegramas(userId, {
    isArchive: false,
    isErase: false,
  }); // Obtener los datos

  // Verificar si hay elementos para archivar
  if (trackingTelegramas.length === 0) {
    const sentMessage = await ctx.editMessageText(
      "No tienes seguimientos activos para archivar.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
    return;
  }

  // Crear botones para cada elemento de seguimiento con trackingCode y alias
  const buttons = trackingTelegramas.map((item) => {
    // Construir el texto con trackingCode y alias si existe
    let displayText = `CD${item.trackingCode}`;
    if (item.alias) {
      displayText += ` - ${truncateText(item.alias)}`; // Agregar alias truncado si es necesario
    }

    return [
      {
        text: displayText, // Mostrar el trackingCode junto con el alias
        callback_data: `archive_tracking_${item._id}`, // Usamos el ID del elemento para identificarlo
      },
    ];
  });

  // Agregar el botón de "Volver"
  buttons.push([{ text: "Volver", callback_data: "tracking_telegramas" }]);

  const sentMessage = await ctx.editMessageText(
    "Elige el seguimiento que deseas archivar:",
    {
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  );
  await saveMessageIdAndDate(userId, sentMessage.message_id);
};

exports.handleArchiveTracking = async (ctx) => {
  const trackingId = ctx.update.callback_query.data.split("_").pop(); // Obtener el ID del seguimiento desde el callback_data
  const userId = ctx.from.id;
  try {
    // Encontrar y actualizar el seguimiento, marcando isCompleted como true
    const tracking = await Tracking.findById(trackingId);
    if (tracking) {
      tracking.isArchive = true;
      await tracking.save();
      const sentMessage = await ctx.editMessageText(
        `El seguimiento CD${tracking.trackingCode} ha sido archivado.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "tracking_telegramas" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    } else {
      const sentMessage = await ctx.editMessageText(
        "No se encontró el seguimiento. Por favor, intenta nuevamente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "tracking_telegramas" }],
            ],
          },
        }
      );
      await saveMessageIdAndDate(userId, sentMessage.message_id);
    }
  } catch (error) {
    logger.error("Error al archivar el seguimiento:", error);
    const sentMessage = await ctx.editMessageText(
      "Hubo un problema al intentar archivar el seguimiento. Por favor, intenta nuevamente.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "tracking_telegramas" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  }
};

exports.handleTrackingTelegramas = async (ctx) => {
  const userId = ctx.from.id;
  const trackingTelegramas = await getTrackingTelegramas(userId, {
    isArchive: false,
    isErase: false,
  }); // Implementar la función para obtener los datos

  const maxAliasLength = 15; // Longitud máxima permitida para el alias

  const elementosMsg =
    trackingTelegramas.length > 0
      ? trackingTelegramas
          .map((item) => {
            let emoji;
            if (item.isVerified === false) {
              emoji = "🕒"; // Si 'isVerified' es false, usa el emoji de cronómetro.
            } else if (item.isVerified === true && item.isValid === false) {
              emoji = "❌"; // Si 'isVerified' es true pero 'isValid' es false, usa el emoji de error.
            } else {
              emoji = "✅"; // Si 'isVerified' es true e 'isValid' es true, usa el emoji de check.
            }

            // Truncar alias si excede la longitud máxima
            const alias = item.alias
              ? item.alias.length > maxAliasLength
                ? item.alias.substring(0, maxAliasLength) + "..."
                : item.alias
              : "";

            return `${emoji} CD${item.trackingCode}${
              alias ? ` (${alias})` : ""
            }`;
          })
          .join("\n")
      : "Sin elementos";

  // Leyenda explicativa de los emojis
  const leyendaEmojis = `\n\n✅ Válido Activo\n❌ Inválido\n🕒 Validación pendiente`;

  const sentMessage = await ctx.editMessageText(
    `Tus telegramas/cartas seguidas:\n\n${elementosMsg}${leyendaEmojis}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Agregar Nuevo Telegrama/Carta",
              callback_data: "add_new_telegrama", // Maneja el evento en handleAddNewTelegrama
            },
          ],
          [
            {
              text: "Archivar Seguimiento",
              callback_data: "archive_tracking_menu", // Dirige al menú de archivado
            },
          ],
          [
            {
              text: "Eliminar Seguimiento",
              callback_data: "delete_tracking_menu", // Dirige al menú de eliminación
            },
          ],
          [
            {
              text: "Ver Todos los Telegramas/Cartas",
              callback_data: "view_all_telegramas",
            },
          ],
          [{ text: "Volver", callback_data: "tracking_options" }],
        ],
      },
    }
  );
  await saveMessageIdAndDate(userId, sentMessage.message_id);
};

// Funciones auxiliares (implementar estas funciones para obtener y manejar los datos)
async function getTrackingCausas(userId) {
  // Implementar lógica para obtener las causas del usuario desde la base de datos
  return []; // Retornar un array de objetos de causas
}
