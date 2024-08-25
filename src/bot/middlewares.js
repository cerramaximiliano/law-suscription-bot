module.exports = (bot) => {
    bot.use(async (ctx, next) => {
      console.log(`Recibido mensaje de ${ctx.from.username}: ${ctx.message.text}`);
      await next();
    });
  
    // Throttling
    const rateLimit = require('telegraf-ratelimit');
    const limitConfig = {
      window: 1000,
      limit: 1,
      onLimitExceeded: (ctx) => ctx.reply('Estás enviando mensajes muy rápido, por favor espera un momento.'),
    };
    bot.use(rateLimit(limitConfig));
  };
  