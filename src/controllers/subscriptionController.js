const Stripe = require('stripe');
const { stripeSecretKey } = require('../../config/env');
const stripe = Stripe(stripeSecretKey);

exports.createSubscription = async (req, res) => {
  console.log("Subscription route")
  const { userId, name } = req.query;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Suscripción a tu servicio',
          },
          unit_amount: 1000, // Precio en centavos
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `https://tudominio.com/success?session_id={CHECKOUT_SESSION_ID}&userId=${userId}`,
      cancel_url: `https://tudominio.com/cancel`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('Error al crear sesión de Stripe:', error);
    res.status(500).send('Hubo un problema al procesar tu pago.');
  }
};

exports.handleSuccess = async (req, res) => {
  const { session_id, userId } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Aquí puedes guardar la suscripción en tu base de datos

    res.send('¡Gracias por tu suscripción! Ahora puedes acceder a los servicios.');
  } catch (error) {
    console.error('Error al procesar la sesión de Stripe:', error);
    res.status(500).send('Hubo un problema al completar tu suscripción.');
  }
};
