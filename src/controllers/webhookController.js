const Stripe = require("stripe");
const { stripeSecretKey } = require("../../config/env");
const stripe = Stripe(stripeSecretKey);
const Subscription = require("../models/subscriptionModel");
const { getCustomerById } = require("./subscriptionController");
const bot = require("../bot");

exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  console.log("handle webhook:", event.type);
  // Manejar los diferentes tipos de eventos de Stripe
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event);
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).send("Webhook received");
};

// Manejar un pago exitoso
const handlePaymentSucceeded = async (event) => {
  const subscriptionId = event.data.object.subscription;
  const customerId = event.data.object.customer;

  const customer = await getCustomerById(customerId);
  let userId = null;
  if (customer.metadata) {
    userId = customer.metadata.telegram_user_id;
  }

  try {
    const subscription = await Subscription.findOne({ userId: userId });
    const billingReason = event.data.object.billing_reason;
    if (subscription && userId) {
      if ( billingReason === "subscription_cycle"){
        subscription.status = "active";
        await subscription.save();
        console.log(
          `Subscription ${subscriptionId} for ${userId} renewed successfully.`
        );
        bot.telegram.sendMessage(
          userId,
          `Tu suscripción ha sido renovada exitosamente. ¡Gracias por continuar con nosotros!`
        );
      }
    } else {
      console.log(`Subscription for customer ${userId} not found.`);
    }
  } catch (err) {
    console.error("Error updating subscription:", err);
  }
};

// Manejar un pago fallido
const handlePaymentFailed = async (event) => {
  const subscriptionId = event.data.object.subscription;
  const customerId = event.data.object.customer;

  const customer = await getCustomerById(customerId);
  const userId = customer.metadata.telegram_user_id;

  try {
    const subscription = await Subscription.findOne({ userId: userId });

    if (subscription) {
      subscription.status = "past_due";
      await subscription.save();
      console.log(`Subscription ${subscriptionId} payment failed.`);
    }
  } catch (err) {
    console.error("Error updating subscription:", err);
  }
};

// Manejar una suscripción actualizada
const handleSubscriptionUpdated = async (event) => {
  const subscriptionId = event.data.object.id;
  const customerId = event.data.object.customer;
  const newStatus = event.data.object.status; // Obtener el nuevo estado de la suscripción

  const customer = await getCustomerById(customerId);
  const userId = customer.metadata.telegram_user_id;

  try {
    const subscription = await Subscription.findOne({ userId: userId });

    if (subscription) {
      subscription.status = newStatus;
      await subscription.save();
      console.log(
        `Subscription ${subscriptionId} for user ${userId} updated to status ${newStatus}.`
      );
    }
  } catch (err) {
    console.error("Error updating subscription:", err);
  }
};

// Manejar una suscripción eliminada
const handleSubscriptionDeleted = async (event) => {
  const subscriptionId = event.data.object.id;
  const customerId = event.data.object.customer;

  const customer = await getCustomerById(customerId);
  let userId = null;
  if (customer.metadata) {
    userId = customer.metadata.telegram_user_id;
  }
  console.log(userId);
  try {
    const subscription = await Subscription.findOne({ userId: userId });
    console.log(subscription);
    if (subscription) {
      subscription.status = "canceled";
      await subscription.save();
      console.log(`Subscription ${subscriptionId} canceled.`);
    }
  } catch (err) {
    console.error("Error updating subscription:", err);
  }
};

const checkSubscriptionStatus = async (userId) => {
  try {
    const subscription = await Subscription.findOne({ userId });

    if (subscription) {
      if (subscription.status === "active") {
        console.log("La suscripción está activa.");
      } else {
        console.log(
          `La suscripción no está activa. Estado actual: ${subscription.status}`
        );
      }
    } else {
      console.log("No se encontró la suscripción para el usuario.");
    }
  } catch (err) {
    console.error("Error al verificar el estado de la suscripción:", err);
  }
};

const handleCheckoutSessionCompleted = async (event) => {
  const session = event.data.object;

  // Obtener los datos necesarios del cliente y la suscripción
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  const customer = await getCustomerById(customerId);
  let userId = null;
  if (customer.metadata) {
    userId = customer.metadata.telegram_user_id;
  }

  try {
    // Actualizar el estado de la suscripción existente en tu base de datos
    let subscription = await Subscription.findOne({ userId: userId });

    if (subscription) {
      subscription.status = "active"; // Actualizar el estado según el evento
      await subscription.save();
      console.log(
        `Subscription ${subscriptionId} for ${subscription.userId} updated to active.`
      );
    } else {
      console.log(`No subscription found for ${subscriptionId}.`);
    }
  } catch (err) {
    console.error("Error handling checkout.session.completed:", err);
  }
};
