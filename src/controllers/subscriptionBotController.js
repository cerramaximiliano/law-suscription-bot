const bot = require("../bot");
const Subscription = require("../models/subscriptionModel");
const moment = require("moment");

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
        `Hola ${firstName}, para suscribirte, visita el siguiente enlace: ${subscriptionUrl}`
      );
      setTimeout(() => {
        ctx.telegram
          .deleteMessage(chatId, sentMessage.message_id)
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

  try {
    const subscription = await Subscription.findOne({ userId: userId });

    if (subscription && subscription.status === "active") {
      await ctx.editMessageText("Selecciona una opción:", {
        chat_id: ctx.chat.id,
        message_id: ctx.update.callback_query.message.message_id,  // Usar el ID del mensaje
        reply_markup: {
          inline_keyboard: [
            [{ text: "Suscripción", callback_data: "subscription_info" }],
            [{ text: "Servicios", callback_data: "tracking_options" }],
          ],
        },
      });
    } else {
      await ctx.editMessageText(
        "No tienes una suscripción activa. Usa este enlace para suscribirte: [enlace de suscripción]",
        {
          chat_id: ctx.chat.id,
          message_id: ctx.update.callback_query.message.message_id,  // Usar el ID del mensaje
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    }
  } catch (error) {
    console.error("Error al verificar la suscripción:", error);
    await ctx.editMessageText(
      "Hubo un problema al verificar tu suscripción. Por favor, intenta nuevamente más tarde.",
      {
        chat_id: ctx.chat.id,
        message_id: ctx.update.callback_query.message.message_id,  // Usar el ID del mensaje
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "back_to_main" }],
          ],
        },
      }
    );
  }
};



exports.handleSubscriptionInfo = async (ctx) => {
  const userId = ctx.from.id;

  try {
    const subscription = await Subscription.findOne({ userId: userId });

    if (subscription) {
      // Editar el mensaje existente para mostrar la información de la suscripción
      await ctx.editMessageText(
        `Datos de tu suscripción:\n\nEstado: ${subscription.status}\nFecha de suscripción: ${ moment(subscription.subscriptionDate).format("DD/MM/YYYY") }`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Cancelar Suscripción", callback_data: "cancel_subscription" }],
              [{ text: "Cambiar Método de Pago", callback_data: "change_payment_method" }],
              [{ text: "Volver", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    } else {
      await ctx.editMessageText("No se encontraron datos de tu suscripción.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "back_to_main" }],
          ],
        },
      });
    }
  } catch (error) {
    console.error("Error al obtener los datos de suscripción:", error);
    await ctx.reply("Hubo un problema al obtener los datos de tu suscripción.");
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

      const sentMessage = await ctx.reply("Tu suscripción ha sido cancelada. Gracias por usar nuestros servicios.");    

    } else {
      await ctx.reply("No tienes una suscripción activa para cancelar.");
    }
  } catch (error) {
    console.error("Error al cancelar la suscripción:", error);
    await ctx.reply("Hubo un problema al cancelar tu suscripción. Por favor, inténtalo nuevamente más tarde.");
  }
};


exports.handleChangePaymentMethod = async (ctx) => {
  const userId = ctx.from.id;

  try {
    // Aquí puedes redirigir al usuario a una página para cambiar el método de pago o manejar el proceso de actualización directamente.
    await ctx.reply("Por favor, sigue este enlace para cambiar tu método de pago: [Enlace a Stripe]");
  } catch (error) {
    console.error("Error al cambiar el método de pago:", error);
    await ctx.reply("Hubo un problema al cambiar tu método de pago. Por favor, inténtalo nuevamente más tarde.");
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
