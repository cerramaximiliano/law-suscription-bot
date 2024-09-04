const { chromium } = require("playwright");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const {
  saveOrUpdateTrackingData,
} = require("../controllers/trackingController");
const { resolveCaptcha } = require("./captchaService");
const { simulateHumanLikeMouseMovements } = require("./mouseMovementService");
const { randomDelay } = require("../utils/utils");
const Captcha = require("2captcha");
const axios = require("axios");

const verifyRecaptcha = async (token) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );
    const verificationResult = response.data;
    console.log(verificationResult)
    if (verificationResult.success) {
      logger.info("reCAPTCHA verificado con éxito.");
      return true;
    } else {
      logger.error(
        "Error en la verificación de reCAPTCHA:",
        verificationResult["error-codes"]
      );
      return false;
    }
  } catch (error) {
    console.log(error)
    logger.error("Error al verificar reCAPTCHA:", error.message);
    return false;
  }
};

const scrapeCA = async (
  cdNumber = "164278815",
  userId = "66c78ff7e79922bf212a7e43",
  notificationId = "3564832",
  trackingType = "telegrama"
) => {
  let browser;
  let result = {
    success: false,
    message: "",
    data: null,
  };

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
      defaultViewport: null,
      executablePath: "/usr/bin/google-chrome",
      userDataDir: "/usr/bin/custom/cache",
    });

    const page = await browser.newPage();

    logger.info("Navegando a la página");
    await page.goto("https://www.correoargentino.com.ar/formularios/ondnc", {
      waitUntil: "domcontentloaded",
    });

    // Simular movimientos de mouse
    await simulateHumanLikeMouseMovements(page);

    const isCaptchaPresent = await page.evaluate(() => {
      return document.querySelector(".g-recaptcha") !== null;
    });
    logger.info(`Captcha class: ${isCaptchaPresent}`);

    let captchaResponse;
/*     try {
      const solver = new Captcha.Solver(process.env.RECAPTCHA_API_KEY);
      captchaResponse = await solver.recaptcha(
        process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
        process.env.RECAPTCHA_SCRAPE_PAGE,
        {
          proxy: `${process.env.RECAPTCHA_USER}:${process.env.RECAPTCHA_PASSWORD}@${process.env.RECAPTCHA_PROXY}`,
          proxytype: "HTTPS",
        }
      );

      if (!captchaResponse || !captchaResponse.data) {
        throw new Error("Error al resolver CAPTCHA.");
      }
    } catch (err) {
      logger.error(`Error al resolver CAPTCHA: ${err.message}`);
      throw err;
    } */

      captchaResponse = await resolveCaptcha(page);

    if (!captchaResponse) throw new Error("Error al resolver CAPTCHA.");

    const isTokenValid = await verifyRecaptcha(captchaResponse.data);
    logger.info(isTokenValid);

    // Completar formulario
    await completeForm(page, cdNumber, captchaResponse.data);

    // Simular movimientos de mouse antes de enviar el formulario
    await simulateHumanLikeMouseMovements(page);

    // Enviar formulario
    await submitForm(page);

    // Esperar a que los resultados se carguen
    await page.waitForSelector("#resultado", {
      visible: true,
      timeout: 60000,
    });

    // Tomar captura de pantalla y extraer datos
    const tableData = await extractTableData(page);

    if (tableData.length === 0) {
      // No se encontraron resultados
      const screenshotPath = await captureScreenshot(
        page,
        cdNumber,
        "/failure"
      );
      result.message =
        "No se encontraron resultados para el número de seguimiento.";
    } else {
      // Guardar datos en la base de datos
      const screenshotPath = await captureScreenshot(
        page,
        cdNumber,
        "/success"
      );

      const trackingResult = await saveOrUpdateTrackingData(
        cdNumber,
        userId,
        notificationId,
        tableData,
        screenshotPath,
        trackingType
      );

      result.success = true;
      result.message = "Proceso completado exitosamente";
      result.data = trackingResult;
    }

    logger.info(result.message);
  } catch (err) {
    console.log(err);
    logger.error(`Error en tarea de scraping tracking: ${err}`);
    result.message = `Error en tarea de scraping tracking: ${err.message}`;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
};

const completeForm = async (page, cdNumber, captchaResponse) => {
  logger.info("Seleccionando opción del dropdown");
  await page.select('select[name="producto"]', "CD");

  logger.info("Esperando input para número");
  await page.waitForSelector("input#numero");

  logger.info("Escribiendo número en el input");
  await page.type("input#numero", cdNumber);

  logger.info("Inyectando respuesta de CAPTCHA en el DOM");
  await page.evaluate((captchaResponse) => {
    document.getElementById("g-recaptcha-response").innerHTML = captchaResponse;
  }, captchaResponse);
};

const submitForm = async (page) => {
  // Esperar a que el iframe de reCAPTCHA esté visible
  logger.info("Esperando iframe de reCAPTCHA");
  await page.waitForSelector("iframe[src*='recaptcha']", {
    visible: true,
    timeout: 60000,
  });

  // Acceder al iframe de reCAPTCHA
  const frames = page.frames();
  const recaptchaFrame = frames.find((frame) =>
    frame.url().includes("recaptcha")
  );

  if (recaptchaFrame) {
    logger.info("Iframe de reCAPTCHA encontrado");

    // Esperar al checkbox dentro del iframe
    await recaptchaFrame.waitForSelector(".recaptcha-checkbox-border", {
      visible: true,
      timeout: 60000,
    });

    logger.info("Haciendo clic en el checkbox de reCAPTCHA");
    await recaptchaFrame.click(".recaptcha-checkbox-border", { force: true });

    // Esperar un poco después de hacer clic en el checkbox
    await new Promise((resolve) => {
      const delay = randomDelay(3, 5);
      setTimeout(resolve, delay);
    });
  } else {
    throw new Error("No se pudo encontrar el iframe de reCAPTCHA.");
  }

  // Esperar un poco antes de hacer clic en el botón de submit
  await new Promise((resolve) => {
    const delay = randomDelay(3, 4);
    setTimeout(resolve, delay);
  });
  // Hacer clic en el botón de submit
  logger.info("Haciendo clic en el botón de enviar");
  await page.click("button#btsubmit");
  await new Promise((resolve) => {
    const delay = randomDelay(5, 7);
    setTimeout(resolve, delay);
  });
};

const captureScreenshot = async (page, cdNumber, subPath) => {
  // Esperar hasta que el resultado esté visible
  await page.waitForSelector("#resultado", {
    visible: true,
    timeout: 60000, // Esperar hasta 60 segundos
  });

  // Crear la carpeta de capturas de pantalla si no existe
  const screenshotDir = path.join(__dirname, `screenshots${subPath}`);
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  // Tomar una captura de pantalla del área visible completa
  const screenshotPath = path.join(screenshotDir, `result-${cdNumber}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  logger.info(
    `Captura de pantalla del resultado guardada en: ${screenshotPath}`
  );
  return screenshotPath;
};

const extractTableData = async (page) => {
  // Esperar hasta que el selector #resultado esté visible
  await page.waitForSelector("#resultado", {
    visible: true,
    timeout: 60000, // Esperar hasta 60 segundos
  });

  // Verificar si hay una tabla dentro del elemento #resultado
  const tableExists = await page.evaluate(() => {
    const table = document.querySelector("#resultado table");
    return !!table; // Retorna true si la tabla existe, false si no
  });

  if (tableExists) {
    // Si la tabla existe, extraer los datos
    const tableData = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll("#resultado table tbody tr")
      );
      const extractedData = [];

      rows.forEach((row) => {
        const columns = row.querySelectorAll("td");
        extractedData.push({
          date: columns[0]?.innerText.trim() || "",
          planta: columns[1]?.innerText.trim() || "",
          historia: columns[2]?.innerText.trim() || "",
          estado: columns[3]?.innerText.trim() || "",
        });
      });

      return extractedData;
    });

    logger.info("Datos extraídos de la tabla:", JSON.stringify(tableData));
    return tableData;
  } else {
    // Si no hay tabla, manejar el mensaje de "No se encontraron resultados"
    const noResultsMessage = await page.evaluate(() => {
      const alert = document.querySelector("#resultado .alert.alert-info");
      return alert ? alert.innerText.trim() : null;
    });

    if (noResultsMessage) {
      logger.info(
        "No se encontraron resultados para el número de seguimiento."
      );
    } else {
      logger.warn(
        "No se encontró la tabla ni el mensaje esperado en el sitio."
      );
    }

    // Retornar un arreglo vacío o algún indicativo de que no hubo resultados
    return [];
  }
};

module.exports = { scrapeCA };
