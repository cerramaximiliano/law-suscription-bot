const Stripe = require("stripe");
const { stripeSecretKey } = require("../../config/env");
const Subscription = require("../models/subscriptionModel");
const bot = require("../bot");
const stripe = Stripe(stripeSecretKey);
const BASE_URL = process.env.BASE_URL;


exports.getCustomerById = async (customerId) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    //console.log('Customer found:', customer);
    return customer;
  } catch (error) {
    console.error('Error retrieving customer:', error);
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
      (customer) => customer.metadata && customer.metadata.telegram_user_id === userId
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

  try {
    // Buscar o crear el cliente en Stripe utilizando el userId de Telegram
    const customer = await findOrCreateCustomerByTelegramId(userId, name);

    // Crear la sesión de suscripción
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Suscripción Pack Starter Info Law",
            },
            recurring: {
              interval: "month", // O 'year' para anual
            },
            unit_amount: 599, // Precio en centavos
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
    res.status(500).send("Hubo un problema al procesar tu pago.");
  }
};


exports.handleSuccess = async (req, res) => {
  const { session_id, userId, chatid } = req.query;
  console.log("handle success");

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Aquí puedes guardar la suscripción en tu base de datos
    let subscription = await Subscription.findOne({ userId: userId });
    if (!subscription) {
      subscription = new Subscription({
        userId: userId,
        chatId: chatid, // Guardamos el chatId que obtenemos de la consulta
        subscriptionDate: new Date(),
        status: "active", // Se puede cambiar dependiendo de la lógica
      });
    }

    await subscription.save();

    bot.telegram.sendMessage(
      userId,
      `¡Gracias por suscribirte! Tu suscripción ha sido activada con éxito.`
    );

    res.send(
      "¡Gracias por tu suscripción! Ahora puedes acceder a los servicios."
    );
  } catch (error) {
    console.error("Error al procesar la sesión de Stripe:", error);
    res.status(500).send("Hubo un problema al completar tu suscripción.");
  }
};


