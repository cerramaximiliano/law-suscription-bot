const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scrapingService");
const logger = require("../config/logger");
const moment = require("moment");
const { logCaptchaResult } = require("../controllers/captchaResultController");
const captchaServices = ["2Captcha", "capsolver", "anticaptcha"]; // Lista de servicios de CAPTCHA

let serviceErrors = {
  "2Captcha": 0,
  "capsolver": 0,
  "anticaptcha": 0,
};
const maxErrorsPerService = 20; // Umbral de errores antes de rotar servicio
let currentCaptchaService = captchaServices[0]; // Iniciar con el primer servicio

const getNextCaptchaService = (currentService) => {
  const currentIndex = captchaServices.indexOf(currentService);
  const nextIndex = (currentIndex + 1) % captchaServices.length; // Rotar al siguiente servicio
  return captchaServices[nextIndex];
};

// Función para realizar el testeo de scraping
async function testScraping(repetitions = 20) {
  try {
    logger.info(`Iniciando testeo de scraping con ${repetitions} repeticiones.`);

    // Obtener todos los trackings de la base de datos
    let allTrackings = await Tracking.find({});
    const totalTrackings = allTrackings.length;

    // Si no hay suficientes trackings, repetir algunos hasta alcanzar el número deseado
    if (totalTrackings < repetitions) {
      // Repetir los trackings para llegar al número de repeticiones
      allTrackings = [...allTrackings, ...allTrackings.slice(0, repetitions - totalTrackings)];
    } else {
      // Si hay suficientes trackings, seleccionar solo los primeros 'repetitions'
      allTrackings = allTrackings.slice(0, repetitions);
    }

    // Ejecutar scraping para cada tracking uno por uno
    for (let i = 0; i < repetitions; i++) {
      const tracking = allTrackings[i % totalTrackings]; // Repetir si es necesario
      const cdNumber = tracking.trackingCode;
      const userId = tracking.userId;
      const notificationId = null;
      const type = tracking.trackingType;

      logger.info(`Iniciando scraping para el tracking ${cdNumber} (${i + 1}/${repetitions}) usando ${currentCaptchaService}.`);

      // Medir tiempo de ejecución
      const startTime = moment();

      // Ejecutar scraping
      const scrape = await scrapeCA(cdNumber, userId, notificationId, type, currentCaptchaService);

      const endTime = moment();
      const duration = moment.duration(endTime.diff(startTime)).asSeconds(); // Duración en segundos

      if (scrape && scrape.success) {
        // Guardar los resultados en la base de datos, con tiempo de resolución y tipo "testing"
        logger.info(`Scraping completado en ${duration} segundos para ${cdNumber}.`);
        await logCaptchaResult(currentCaptchaService, true, scrape.ip, type, duration);

        // Reiniciar el contador de errores para el servicio actual
        serviceErrors[currentCaptchaService] = 0;
      } else {
        logger.warn(`Falló el scraping para ${cdNumber} usando ${currentCaptchaService}.`);

        // Aumentar el contador de errores para el servicio actual
        serviceErrors[currentCaptchaService] += 1;

        // Si el servicio ha excedido el límite de errores, cambiar al siguiente
        if (serviceErrors[currentCaptchaService] >= maxErrorsPerService) {
          logger.warn(`Cambiando de servicio de CAPTCHA: ${currentCaptchaService} -> siguiente servicio`);
          currentCaptchaService = getNextCaptchaService(currentCaptchaService);
        }

        await logCaptchaResult(currentCaptchaService, false, scrape.ip, type, duration);
      }

      logger.info(`Finalizando scraping para ${cdNumber}.`);
    }

    logger.info("Testeo de scraping finalizado.");
  } catch (err) {
    logger.error(`Error durante el testeo de scraping: ${err.message}`);
  }
}

module.exports = { testScraping };
