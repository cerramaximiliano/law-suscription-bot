const cron = require("node-cron");
const Tracking = require("../models/trackingModel");
const { scrapeCA } = require("../services/scrapingService");
const logger = require("../config/logger");

async function updateTracking(cdNumber, userId, notificationId, type) {
    try{
        const scrape = await scrapeCA(cdNumber, userId, notificationId, type);
        // Aquí harías el scraping usando el captchaResponse y los datos de tracking
        logger.info(scrape);
        if (scrape && scrape.success) {
          const tracking = await Tracking.findOne({ trackingCode: cdNumber });
          tracking.lastScraped = new Date();
          tracking.notified = false; // Marcar para notificación al final del día
          await tracking.save();
        } else {
          logger.warn(`Failed to scrape data for ${cdNumber}`);
        }
    }catch(err){
        logger.error(`Error updating scraping ${err}`)
    }


  /* tracking.lastScraped = new Date();
  tracking.notified = false; // Marcar para notificación al final del día
  await tracking.save(); */
}

const cronJobs = () => {
  cron.schedule("0 */2 * * *", async () => {
    logger.info(`Update trancking cron job start`);
    const trackings = await Tracking.find({
      isComplete: false,
      lastScraped: { $lte: new Date(Date.now() - 86400000) },
    });
        logger.info(tracking.trackingCode, tracking.userId, null, tracking.trackingType);
        for (const tracking of trackings) {
          await updateTracking(tracking.trackingCode, tracking.userId, null, tracking.trackingType);
          await new Promise(resolve => setTimeout(resolve, 300000)); // Esperar 5 minutos entre cada solicitud
        }
  });
};

module.exports = { cronJobs };
