exports.handleBotSubscription = async (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
  
    // Verificar si el mensaje proviene del topic "Suscripciones"
    if (ctx.message.message_thread_id === 275) {
      // Generar el enlace de suscripción
      const subscriptionUrl = `https://tudominio.com/suscripcion?userId=${userId}&name=${encodeURIComponent(firstName)}`;
  
      try {
        // Enviar mensaje privado con el enlace de suscripción
        await ctx.telegram.sendMessage(userId, `Hola ${firstName}, para suscribirte, visita el siguiente enlace: ${subscriptionUrl}`);
        
        // Enviar mensaje al topic notificando que se envió el mensaje privado
        const sentMessage = await ctx.reply('Te hemos enviado un mensaje privado con el enlace de suscripción.', {
          message_thread_id: 275,
        });
  
        // Configurar autodestrucción del mensaje en 10 segundos
        setTimeout(() => {
          ctx.telegram.deleteMessage(chatId, sentMessage.message_id).catch(console.error);
        }, 10000);
  
      } catch (error) {
        console.error("Error al enviar mensaje privado:", error);
        const errorMessage = await ctx.reply("No pude enviarte un mensaje privado. Asegúrate de que el bot pueda enviarte mensajes directos.", {
          message_thread_id: 275,
        });
  
        // Configurar autodestrucción del mensaje de error en 10 segundos
        setTimeout(() => {
          ctx.telegram.deleteMessage(chatId, errorMessage.message_id).catch(console.error);
        }, 10000);
      }
    }
  };
  