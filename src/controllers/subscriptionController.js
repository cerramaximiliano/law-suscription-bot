const Stripe = require("stripe");
const { stripeSecretKey } = require("../../config/env");
const Subscription = require("../models/subscriptionModel");
const bot = require("../bot");
const stripe = Stripe(stripeSecretKey);
const BASE_URL = process.env.BASE_URL;
const path = require("path");
const { logger } = require("../config/logger");
const moment = require("moment");

exports.getCustomerById = async (customerId) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    //console.log('Customer found:', customer);
    return customer;
  } catch (error) {
    console.error("Error retrieving customer:", error);
  }
};

const findOrCreateCustomerByTelegramId = async (userId, name) => {
  try {
    // Buscar clientes en Stripe
    const customers = await stripe.customers.list({
      limit: 100, // Ajusta el límite si es necesario
    });

    // Filtrar clientes por el userId en metadata
    const existingCustomer = customers.data.find(
      (customer) =>
        customer.metadata && customer.metadata.telegram_user_id === userId
    );

    if (existingCustomer) {
      // Cliente existente encontrado
      return existingCustomer;
    } else {
      // Crear un nuevo cliente si no se encontró uno existente
      const newCustomer = await stripe.customers.create({
        name: name,
        metadata: { telegram_user_id: userId }, // Guardar el userId de Telegram en metadata
      });
      return newCustomer;
    }
  } catch (error) {
    console.error("Error al buscar o crear cliente en Stripe:", error);
    throw error;
  }
};

exports.createSubscription = async (req, res) => {
  const { userId, name, chatid } = req.query;
  if (!userId || !name || !chatid) {
    res.sendFile(
      path.join(__dirname, "../../public/views", "wrong-subscription.html")
    );
    return;
  }
  try {
    // Buscar o crear el cliente en Stripe utilizando el userId de Telegram
    const customer = await findOrCreateCustomerByTelegramId(userId, name);

    // Crear la sesión de suscripción con un ciclo diario
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Suscripción Pack Starter Info Law (1 Día)",
            },
            recurring: {
              interval: "day", // Intervalo diario
            },
            unit_amount: 100, // Precio en centavos (por ejemplo, $1.00 USD)
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer: customer.id, // Usar el ID del cliente existente o recién creado
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&userId=${userId}&chatid=${chatid}`,
      cancel_url: `${BASE_URL}/cancel`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error("Error al crear sesión de Stripe:", error);
    res.sendFile(
      path.join(__dirname, "../../public", "error-law-assistant.html")
    );
  }
};

exports.handleSuccess = async (req, res) => {
  const { session_id, userId, chatid } = req.query;
  console.log("handle success");
  try {
    // Recuperar la sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const stripeCustomerId = session.customer; // Obtener el stripeCustomerId de la sesión

    // Buscar o crear la suscripción en tu base de datos
    let subscription = await Subscription.findOne({ userId: userId });
    if (!subscription) {
      subscription = new Subscription({
        userId: userId,
        chatId: chatid, // Guardamos el chatId que obtenemos de la consulta
        stripeCustomerId: stripeCustomerId, // Guardar el stripeCustomerId en la base de datos
        subscriptionDate: new Date(),
        status: "active", // Se puede cambiar dependiendo de la lógica
      });
    } else {
      // Si la suscripción ya existe, actualiza el stripeCustomerId si no está presente
      if (!subscription.stripeCustomerId) {
        subscription.stripeCustomerId = stripeCustomerId;
      }
    }

    // Guardar la suscripción en la base de datos
    await subscription.save();

    // Enviar mensaje privado con el botón para comenzar
    await bot.telegram.sendMessage(
      userId,
      `¡Gracias por suscribirte! Tu suscripción ha sido activada con éxito. Haz clic en el botón de abajo para acceder a las opciones.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Comenzar", callback_data: "start_access" }],
          ],
        },
      }
    );

    res.sendFile(
      path.join(__dirname, "../../public", "success-law-assistant.html")
    );
  } catch (error) {
    console.error("Error al procesar la sesión de Stripe:", error);
    res.sendFile(path.join(__dirname, "../../public", "error-session.html"));
  }
};

// Función general para actualizar el messageId y la fecha en el documento Tracking
exports.saveMessageIdAndDate = async (userId, messageId) => {
  try {
    // Actualizar el documento del tracking con el messageId y la fecha
    const subscription = await Subscription.findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          lastMessageId: messageId,
          lastMessageDate: moment().toDate(), // Fecha actual
        },
      },
      { new: true } // Retorna el documento actualizado
    );

    if (subscription) {
      logger.info(
        `Suscripción actualizada con messageId: ${messageId} y fecha para user ${userId}`
      );
    } else {
      logger.warn(`No se encontró una suscripción para actualizar ${userId}`);
    }
  } catch (error) {
    logger.error(
      `Error al actualizar el messageId y fecha para user ${userId}:`,
      error
    );
  }
};
