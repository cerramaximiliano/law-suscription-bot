const bot = require("../../bot");
const Subscription = require("../../models/subscriptionModel");
const Indemnizacion = require("../../models/indeminzacionModel");
const Tracking = require("../../models/trackingModel");
const moment = require("moment");
const { stripeSecretKey } = require("../../../config/env");
const Stripe = require("stripe");
const stripe = Stripe(stripeSecretKey);
const { getTrackingTelegramas } = require("../trackingController");
const { logger } = require("../../config/logger");
const { saveMessageIdAndDate } = require("../subscriptionController");
const { truncateText } = require("../../utils/format");

/* ---------------------------- Menú CALCULOS LEGALES ------------------------------ */
exports.handleCalculosLegales = async (ctx) => {
  const userId = ctx.from.id;
  try {
    const sentMessage = await ctx.editMessageText(
      "Seleccione la opción de cálculo deseada:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Cálculo Despido", callback_data: "calculo_despido" }],
            [
              {
                text: "Cálculo Liquidación Final",
                callback_data: "calculo_liquidacion",
              },
            ],
            [
              {
                text: "Cálculo de Intereses",
                callback_data: "calculo_intereses",
              },
            ],
            [{ text: "Volver", callback_data: "tracking_options" }],
          ],
        },
      }
    );
    await saveMessageIdAndDate(userId, sentMessage.message_id);
  } catch (error) {
    logger.error("Error al mostrar opciones de cálculos legales:", error);
  }
};

exports.handleCalculoDespido = async (ctx) => {
  const userId = ctx.from.id;
  try {
    if (!ctx.session) {
      ctx.session = {};
    }

    ctx.session.calculoDespidoState = {
      step: 1,
      data: {},
    };

    const sentMessage = await ctx.editMessageText(
      "Por favor, ingrese el sueldo bruto mensual del empleado:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Cancelar", callback_data: "calculos_legales" }],
          ],
        },
      }
    );

    ctx.session.calculoDespidoState.messageId = sentMessage.message_id;
    await saveMessageIdAndDate(userId, sentMessage.message_id);
    ctx.session.waitingFor = "sueldoBrutoDespido";
  } catch (error) {
    logger.error("Error en cálculo de despido:", error);
  }
};

// Manejador para procesar las respuestas de texto
exports.handleCalculosText = async (ctx) => {
  if (!ctx.session || !ctx.session.waitingFor) {
    return;
  }

  const messageText = ctx.message.text;
  logger.info(`Processing ${ctx.session.waitingFor} with text: ${messageText}`);

  try {
    switch (ctx.session.waitingFor) {
      case "sueldoBrutoDespido":
        await handleSueldoBrutoDespido(ctx, messageText);
        break;
      case "fechaIngresoDespido":
        await handleFechaIngresoDespido(ctx, messageText);
        break;
      case "fechaEgresoDespido":
        await handleFechaEgresoDespido(ctx, messageText);
        break;
    }

    try {
      await ctx.deleteMessage(ctx.message.message_id);
    } catch (error) {
      logger.error("Error deleting user message:", error);
    }
  } catch (error) {
    logger.error("Error procesando respuesta de cálculo:", error);
  }
};

function isValidDateFormat(dateStr) {
  if (!dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) return false;

  const [day, month, year] = dateStr.split("-").map((num) => parseInt(num, 10));
  const date = new Date(year, month - 1, day);

  return (
    date.getDate() === day &&
    date.getMonth() === month - 1 &&
    date.getFullYear() === year
  );
}

async function handleSueldoBrutoDespido(ctx, sueldoBruto) {
  const messageId = ctx.session.calculoDespidoState.messageId;

  const sueldo = parseFloat(sueldoBruto.replace(/[^\d.]/g, ""));
  if (isNaN(sueldo) || sueldo <= 0) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      null,
      "Por favor, ingrese un valor numérico válido mayor a 0 para el sueldo bruto:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Cancelar", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
    return;
  }

  ctx.session.calculoDespidoState.data.sueldoBruto = sueldo;
  ctx.session.calculoDespidoState.step = 2;

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    messageId,
    null,
    "Por favor, ingrese la fecha de ingreso del empleado (formato DD-MM-YYYY):",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Cancelar", callback_data: "calculos_legales" }],
        ],
      },
    }
  );

  ctx.session.waitingFor = "fechaIngresoDespido";
}

async function handleFechaIngresoDespido(ctx, fechaIngreso) {
  const messageId = ctx.session.calculoDespidoState.messageId;

  if (!isValidDateFormat(fechaIngreso)) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      null,
      "Formato de fecha inválido. Por favor, ingrese la fecha en formato DD-MM-YYYY:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Cancelar", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
    return;
  }

  ctx.session.calculoDespidoState.data.fechaIngreso = fechaIngreso;
  ctx.session.calculoDespidoState.step = 3;

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    messageId,
    null,
    "Por favor, ingrese la fecha de egreso del empleado (formato DD-MM-YYYY):",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Cancelar", callback_data: "calculos_legales" }],
        ],
      },
    }
  );

  ctx.session.waitingFor = "fechaEgresoDespido";
}

async function handleFechaEgresoDespido(ctx, fechaEgreso) {
  const messageId = ctx.session.calculoDespidoState.messageId;
  const userId = ctx.from.id;

  if (!isValidDateFormat(fechaEgreso)) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      null,
      "Formato de fecha inválido. Por favor, ingrese la fecha en formato DD-MM-YYYY:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Cancelar", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
    return;
  }

  const fechaIngresoMoment = moment(
    ctx.session.calculoDespidoState.data.fechaIngreso,
    "DD-MM-YYYY"
  );
  const fechaEgresoMoment = moment(fechaEgreso, "DD-MM-YYYY");

  if (fechaEgresoMoment.isSameOrBefore(fechaIngresoMoment)) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      null,
      "Error: La fecha de egreso debe ser posterior a la fecha de ingreso. Por favor, ingrese una fecha válida:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Cancelar", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
    return;
  }

  const antiguedadAnios = fechaEgresoMoment.diff(
    fechaIngresoMoment,
    "years",
    true
  );

  try {
    const nuevaIndemnizacion = await Indemnizacion.create({
      userId,
      sueldoBruto: ctx.session.calculoDespidoState.data.sueldoBruto,
      fechaIngreso: fechaIngresoMoment.toDate(),
      fechaEgreso: fechaEgresoMoment.toDate(),
      antiguedadAnios,
      estado: "pendiente",
    });

    logger.info(`Indemnización guardada con ID: ${nuevaIndemnizacion._id}`);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      null,
      `Datos recopilados:\n\n` +
        `📊 Sueldo Bruto: $${ctx.session.calculoDespidoState.data.sueldoBruto.toLocaleString()}\n` +
        `📅 Fecha de Ingreso: ${ctx.session.calculoDespidoState.data.fechaIngreso}\n` +
        `📅 Fecha de Egreso: ${fechaEgreso}\n` +
        `⌛ Antigüedad: ${antiguedadAnios.toFixed(2)} años\n\n` +
        `¿Desea proceder con el cálculo?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Calcular Indemnización",
                callback_data: `calcular_ind_${nuevaIndemnizacion._id}`,
              },
            ],
            [{ text: "Cancelar", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error al guardar la indemnización:", error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      messageId,
      null,
      "Hubo un error al guardar los datos. Por favor, intente nuevamente.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
  }

  ctx.session.waitingFor = null;
}

// Manejador para el cálculo final
exports.handleCalcularIndemnizacion = async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery.data;
    const indemnizacionId = callbackData.replace("calcular_ind_", "");
    logger.info(`Calculando indemnización con ID: ${indemnizacionId}`);

    const indemnizacion = await Indemnizacion.findById(indemnizacionId);

    if (!indemnizacion) {
      logger.error(
        `No se encontró la indemnización con ID: ${indemnizacionId}`
      );
      await ctx.editMessageText(
        "No se encontraron los datos del cálculo. Por favor, intente nuevamente.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Volver", callback_data: "calculos_legales" }],
            ],
          },
        }
      );
      return;
    }

    // Realizar el cálculo
    const resultado = indemnizacion.sueldoBruto * indemnizacion.antiguedadAnios;

    // Actualizar el registro
    indemnizacion.resultado = resultado;
    indemnizacion.estado = "calculado";
    await indemnizacion.save();

    // Mostrar el resultado
    await ctx.editMessageText(
      `Resultado del cálculo de indemnización:\n\n` +
        `💰 Sueldo Bruto: $${indemnizacion.sueldoBruto.toLocaleString()}\n` +
        `📅 Antigüedad: ${indemnizacion.antiguedadAnios.toFixed(2)} años\n` +
        `💵 Indemnización: $${resultado.toLocaleString()}\n\n` +
        `ID de cálculo: ${indemnizacion._id}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Nuevo Cálculo", callback_data: "calculo_despido" }],
            [{ text: "Volver al Menú", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
  } catch (error) {
    logger.error("Error al calcular la indemnización:", error);
    await ctx.editMessageText(
      "Hubo un error al realizar el cálculo. Por favor, intente nuevamente.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Volver", callback_data: "calculos_legales" }],
          ],
        },
      }
    );
  }
};
