const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scrapingService");
const logger = require("../config/logger");
const moment = require("moment");

let queue = [];
let isProcessing = false;

async function updateTracking(cdNumber, userId, notificationId, type) {
  try {
    logger.info(`Iniciando scraping para ${cdNumber}.`);
    const scrape = await scrapeCA(cdNumber, userId, notificationId, type);
    if (scrape && scrape.success) {
      const tracking = await Tracking.findOne({ trackingCode: cdNumber });
      tracking.lastScraped = new Date();
      tracking.notified = false;
      await tracking.save();
    } else {
      logger.warn(`Failed to scrape data for ${cdNumber}`);
    }
  } catch (err) {
    logger.error(`Error updating scraping ${err}`);
  } finally {
    logger.info(`Finalizando scraping para ${cdNumber}.`);
  }
}

function processQueue() {
  if (queue.length === 0 || isProcessing) {
    return;
  }

  isProcessing = true;
  const { cdNumber, userId, notificationId, type } = queue.shift();
  logger.info(`Procesando elemento de la cola: ${cdNumber}. Elementos restantes en cola: ${queue.length}`);

  updateTracking(cdNumber, userId, notificationId, type).finally(() => {
    setTimeout(() => {
      isProcessing = false;
      logger.info(`Elemento procesado y eliminado de la cola: ${cdNumber}`);
      processQueue();
    }, 300000); // Esperar 5 minutos antes de procesar el siguiente en la cola
  });
}

const cronJobs = () => {
  cron.schedule("*/15 * * * *", async () => {
    logger.info(`Update tracking cron job start`);
    const startOfDay = moment().startOf('day').toDate();
    const trackings = await Tracking.find({
      isCompleted: false,
      $or: [
        { lastScraped: { $lt: startOfDay } },
        { lastScraped: { $exists: false } }
      ]
    });

    logger.info(`Trackings found: ${trackings.length}`);
    trackings.forEach(tracking => {
      queue.push({
        cdNumber: tracking.trackingCode,
        userId: tracking.userId,
        notificationId: null,
        type: tracking.trackingType
      });
      logger.info(`Elemento añadido a la cola: ${tracking.trackingCode}. Total en cola: ${queue.length}`);
    });

    processQueue(); // Iniciar el procesamiento de la cola
  });
};

module.exports = { cronJobs };
