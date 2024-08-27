const bot = require("../bot");
const Subscription = require("../models/subscriptionModel");
const moment = require("moment");
const { stripeSecretKey } = require("../../config/env");
const Stripe = require("stripe");
const Tracking = require("../models/trackingModel");
const stripe = Stripe(stripeSecretKey);

const URL_BASE = process.env.BASE_URL;

exports.handleBotSubscription = async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;

  const BASE_URL = process.env.BASE_URL;

  const subscriptionUrl = `${BASE_URL}/suscripcion?userId=${userId}&name=${encodeURIComponent(
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
    console.error("Error al enviar mensaje privado:", error);
    await ctx.reply(
      "No pude enviarte un mensaje privado. Asegúrate de que el bot pueda enviarte mensajes directos."
    );
  }
};

exports.handleBotAccess = async (ctx) => {
  const userId = ctx.from.id;
  console.log(`User ID: ${userId}`); // Log para verificar el userId

  try {
    const subscription = await Subscription.findOne({ userId: userId });
    console.log(`Subscription found: ${subscription}`); // Log para verificar la suscripción

    if (subscription && subscription.status === "active") {
      console.log("Subscription is active");

      if (ctx.update.callback_query && ctx.update.callback_query.message) {
        console.log("Editing message to show options");
        await ctx.editMessageText("Selecciona una opción:", {
          chat_id: ctx.chat.id,
          message_id: ctx.update.callback_query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Suscripción", callback_data: "subscription_info" }],
              [{ text: "Servicios", callback_data: "tracking_options" }],
            ],
          },
        });
      } else {
        console.log("No callback_query or message found");
        await ctx.reply("No se pudo actualizar el mensaje.");
      }
    } else {
      console.log("No active subscription found");
      const chatId = ctx.chat.id;
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name;

      const BASE_URL = process.env.BASE_URL;

      const subscriptionUrl = `${BASE_URL}/suscripcion?userId=${userId}&name=${encodeURIComponent(
        firstName
      )}&chatid=${chatId}`;

      if (ctx.update.callback_query && ctx.update.callback_query.message) {
        await ctx.editMessageText(
          "No tienes una suscripción activa. presiona el botón para suscribirte:",
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
      } else {
        console.log("No callback_query or message found");
        await ctx.reply("No se pudo actualizar el mensaje.");
      }
    }
  } catch (error) {
    console.error("Error al verificar la suscripción:", error);

    if (ctx.update.callback_query && ctx.update.callback_query.message) {
      await ctx.editMessageText(
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
    } else {
      await ctx.reply("No se pudo actualizar el mensaje.");
    }
  }
};

exports.handleSubscriptionInfo = async (ctx) => {
  const userId = ctx.from.id;

  try {
    // Buscar la suscripción en tu base de datos
    const subscription = await Subscription.findOne({ userId: userId });

    if (!subscription) {
      console.log("No se encontró la suscripción en la base de datos.");
      await ctx.editMessageText("No se encontraron datos de tu suscripción.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "back_to_main" }],
          ],
        },
      });
      return;
    }

    console.log("Database status subscription", subscription.status);

    // Obtener detalles de la suscripción desde Stripe
    const stripeSubscription = await stripe.subscriptions.list({
      customer: subscription.stripeCustomerId,
      limit: 1,
    });

    if (!stripeSubscription || stripeSubscription.data.length === 0) {
      console.log("No se encontraron datos de suscripción en Stripe.");
      await ctx.editMessageText(
        "No se encontraron datos de suscripción en Stripe.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      return;
    }

    const subscriptionDetails = stripeSubscription.data[0];
    if (!subscriptionDetails || !subscriptionDetails.status) {
      console.log("No se pudo obtener el estado de la suscripción.");
      await ctx.editMessageText(
        "Hubo un problema al obtener los datos de tu suscripción.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      return;
    }

    console.log("Stripe status subscription", subscriptionDetails.status);

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
      console.log("No upcoming invoice found or error retrieving it:", err);
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
    await ctx.editMessageText(
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
  } catch (error) {
    console.error("Error al obtener los datos de suscripción:", error);
    const sentMessage = await ctx.reply(
      "Hubo un problema al obtener los datos de tu suscripción."
    );

    // Elimina el mensaje después de 5 segundos
    setTimeout(() => {
      ctx.deleteMessage(sentMessage.message_id).catch((err) => {
        console.error("Error al eliminar el mensaje:", err);
      });
    }, 5000); // 5000 milisegundos = 5 segundos
  }
};

exports.handleTrackingOptions = async (ctx) => {
  try {
    const newText = "Selecciona una opción de tracking:";
    const currentText = ctx.update.callback_query.message.text;

    // Verificar si el contenido del mensaje ha cambiado
    if (newText !== currentText) {
      await ctx.editMessageText(newText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Tracking de Causas", callback_data: "tracking_causas" }],
            [
              {
                text: "Tracking de Telegramas/Cartas",
                callback_data: "tracking_telegramas",
              },
            ],
            [{ text: "Volver", callback_data: "back_to_main" }],
          ],
        },
      });
    }
  } catch (error) {
    if (
      error.code === 400 &&
      error.description.includes("message is not modified")
    ) {
      console.log(
        "El mensaje ya tiene el contenido actualizado. No es necesario editarlo."
      );
    } else {
      console.error("Error al manejar las opciones de tracking:", error);
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

  await ctx.editMessageText(`Tus causas seguidas:\n\n${elementosMsg}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Agregar Nueva Causa", callback_data: "add_new_causa" }],
        [{ text: "Ver Todas las Causas", callback_data: "view_all_causas" }],
        [{ text: "Volver", callback_data: "tracking_options" }],
      ],
    },
  });
};

exports.handleTrackingTelegramas = async (ctx) => {
  const userId = ctx.from.id;
  const trackingTelegramas = await getTrackingTelegramas(userId); // Implementar la función para obtener los datos

  const elementosMsg =
    trackingTelegramas.length > 0
      ? trackingTelegramas
          .map((item) => `Número de telegrama/carta: ${item.numero}`)
          .join("\n")
      : "Sin elementos";

  await ctx.editMessageText(
    `Tus telegramas/cartas seguidas:\n\n${elementosMsg}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Agregar Nuevo Telegrama/Carta",
              callback_data: "add_new_telegrama",
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
};

// Este método maneja el click en "Agregar Nuevo Telegrama/Carta"
exports.handleAddNewTelegrama = async (ctx) => {
  try {
    await ctx.editMessageText("Elige la opción deseada:", {
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
          [
            { text: "Volver", callback_data: "tracking_telegramas" }, // Vuelve al menú anterior
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Error al mostrar el menú de opciones:", error);
    ctx.reply(
      "Hubo un problema al mostrar las opciones. Por favor, intenta nuevamente."
    );
  }
};

exports.handleTrackingTelegramas = async (ctx) => {
  const userId = ctx.from.id;
  const trackingTelegramas = await getTrackingTelegramas(userId); // Implementar la función para obtener los datos

  const elementosMsg =
    trackingTelegramas.length > 0
      ? trackingTelegramas
          .map((item) => `Número de telegrama/carta: ${item.numero}`)
          .join("\n")
      : "Sin elementos";

  await ctx.editMessageText(
    `Tus telegramas/cartas seguidas:\n\n${elementosMsg}`,
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
              text: "Ver Todos los Telegramas/Cartas",
              callback_data: "view_all_telegramas",
            },
          ],
          [{ text: "Volver", callback_data: "tracking_options" }],
        ],
      },
    }
  );
};

exports.handleAddCartaDocumento = async (ctx) => {
  try {
    if (!ctx.session) {
      ctx.session = {}; // Inicializa la sesión si no está definida
    }

    // Envía un mensaje solicitando el número de CD de 9 dígitos y guarda el ID del mensaje
    const sentMessage = await ctx.editMessageText(
      "Escriba el número de CD de 9 dígitos:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Volver", callback_data: "tracking_telegramas" }, // Callback para volver al menú anterior
            ],
          ],
        },
      }
    );

    // Guarda el ID del mensaje para editarlo después de la validación
    ctx.session.messageIdToEdit = sentMessage.message_id;

    // Configura el bot para esperar la entrada del usuario
    ctx.session.waitingForCDNumber = true;
  } catch (error) {
    console.error("Error al solicitar el número de CD:", error);
    ctx.reply(
      "Hubo un problema al solicitar el número de CD. Intenta nuevamente."
    );
  }
};

exports.handleBackToMain = async (ctx) => {
  try {
    const newText = "Selecciona una opción:";
    const currentText = ctx.update.callback_query.message.text;

    // Verificar si el contenido del mensaje ha cambiado
    if (newText !== currentText) {
      await ctx.editMessageText(newText, {
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
    }
  } catch (error) {
    if (
      error.code === 400 &&
      error.description.includes("message is not modified")
    ) {
      console.log(
        "El mensaje ya tiene el contenido actualizado. No es necesario editarlo."
      );
    } else {
      console.error("Error al manejar el retorno al menú principal:", error);
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
    console.error("Error al cancelar la suscripción:", error);
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
    await ctx.editMessageText(
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
  } catch (error) {
    console.error("Error al cambiar el método de pago:", error);
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
      isCompleted: false,
    });

    // Verificar si el usuario ha alcanzado el límite de 10 seguimientos activos
    if (activeTrackings >= 10) {
      return ctx.reply(
        "Has alcanzado el límite de 10 seguimientos activos. Elimina un seguimiento existente para agregar uno nuevo."
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
    ctx.reply("Nuevo seguimiento agregado exitosamente.");
  } catch (error) {
    console.error("Error al agregar el seguimiento:", error);
    ctx.reply("Hubo un problema al agregar el seguimiento.");
  }
};

// Ejemplo de cómo manejar la eliminación de un seguimiento
exports.handleDeleteTracking = async (ctx) => {
  const trackingId = ctx.request.body.trackingId; // Supongamos que el ID viene en la solicitud

  try {
    await Tracking.findByIdAndDelete(trackingId);
    ctx.reply("Seguimiento eliminado exitosamente.");
  } catch (error) {
    console.error("Error al eliminar el seguimiento:", error);
    ctx.reply("Hubo un problema al eliminar el seguimiento.");
  }
};

// Ejemplo de cómo completar un seguimiento
exports.handleCompleteTracking = async (ctx) => {
  const trackingId = ctx.request.body.trackingId; // Supongamos que el ID viene en la solicitud

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

// Funciones auxiliares (implementar estas funciones para obtener y manejar los datos)
async function getTrackingCausas(userId) {
  // Implementar lógica para obtener las causas del usuario desde la base de datos
  return []; // Retornar un array de objetos de causas
}

async function getTrackingTelegramas(userId) {
  // Implementar lógica para obtener los telegramas/cartas del usuario desde la base de datos
  return []; // Retornar un array de objetos de telegramas/cartas
}
