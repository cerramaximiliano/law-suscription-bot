const CaptchaResult = require("../models/captchaResultModel");

const moment = require('moment');

// Función para registrar un éxito o fracaso en la resolución de captchas
const logCaptchaResult = async (service, success, ip = null) => {
  try {
    const today = moment().startOf('day').toDate(); // Fecha de hoy
    let result = await CaptchaResult.findOne({ date: today, service });

    if (!result) {
      result = new CaptchaResult({ service });
    }

    if (success) {
      result.success += 1;
    } else {
      result.failure += 1;
    }
    if (ip) {
      result.ipsUsed.push(ip);
    }
    await result.save();
  } catch (error) {
    console.error('Error logging captcha result:', error);
  }
};

// Función para obtener el reporte de captchas de un día específico y servicio
const getCaptchaReport = async (date, service) => {
  try {
    const reportDate = moment(date).startOf('day').toDate();
    const report = await CaptchaResult.findOne({ date: reportDate, service });

    if (report) {
      return report;
    } else {
      return { service, success: 0, failure: 0 };
    }
  } catch (error) {
    console.error('Error retrieving captcha report:', error);
    throw error;
  }
};

module.exports = { logCaptchaResult, getCaptchaReport };