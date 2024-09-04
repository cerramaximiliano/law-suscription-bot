const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scrapingService");
const logger = require("../config/logger");
const moment = require("moment");
const { logCaptchaResult } = require("../controllers/captchaResultController");


async function updateTracking(cdNumber, userId, notificationId, type, captchaService) {
  try {
    logger.info(`Iniciando scraping para ${cdNumber}.`);
    const scrape = await scrapeCA(cdNumber, userId, notificationId, type);
    if (scrape && scrape.success) {
      const tracking = await Tracking.findOne({ trackingCode: cdNumber });
      tracking.lastScraped = new Date();
      tracking.notified = false;
      await logCaptchaResult(captchaService, true);
      await tracking.save();
    } else {
      logger.warn(`Failed to scrape data for ${cdNumber}`);
      await logCaptchaResult(captchaService, false);
    }
  } catch (err) {
    logger.error(`Error updating scraping ${err}`);
  } finally {
    logger.info(`Finalizando scraping para ${cdNumber}.`);
  }
}

const cronJobs = async () => {
  //cron.schedule("*/1 5-20 * * 1-5", async () => {
    logger.info(`Update tracking cron job start`);

    const startOfDay = moment().startOf("day").toDate();
    const tracking = await Tracking.findOneAndUpdate(
      {
        isCompleted: false,
        $or: [
          { lastScraped: { $lt: startOfDay } },
          { lastScraped: { $exists: false } },
        ],
      },
      { $set: { isProcessing: true } }, // Marca el elemento como en proceso
      { sort: { lastScraped: 1 }, new: true } // Selecciona el más antiguo
    );

    if (tracking) {
      logger.info(`Iniciando scraping para ${tracking.trackingCode}.`);
      await updateTracking(
        tracking.trackingCode,
        tracking.userId,
        null,
        tracking.trackingType,
        "2Captcha"
      );
      logger.info(`Finalizando scraping para ${tracking.trackingCode}.`);
    } else {
      logger.info("No se encontraron tracking pendientes para procesar.");
    }
//  });
};

module.exports = { cronJobs };
