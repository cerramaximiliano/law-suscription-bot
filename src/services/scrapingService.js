const { chromium } = require("playwright");
const puppeteer = require("puppeteer-extra");
const { HttpsProxyAgent } = require("https-proxy-agent");

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
const { resolveRecaptchaV2 } = require("./screenshots/captchaDBCService");
const { captchaACSolver } = require("./captchaACService");
const { capsolver } = require("./captchaCapService");

const siteKey = process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY;
const pageUrl = process.env.RECAPTCHA_SCRAPE_PAGE;
const user = process.env.RECAPTCHA_USER;
const password = process.env.RECAPTCHA_PASSWORD;
const dns = process.env.RECAPTCHA_DNS;
const port = process.env.RECAPTCHA_PORT;

const retryCaptchaValidation = async (maxRetries, siteKey, pageUrl) => {
  let attempts = 0;
  let isTokenValid = false;
  let captchaResponse;

  while (attempts < maxRetries) {
    attempts += 1;
    logger.info(`Intento ${attempts} de resolver CAPTCHA.`);

    captchaResponse = await captchaACSolver(pageUrl, siteKey); // Solicita nuevo captcha

    if (!captchaResponse) {
      logger.error("Error al resolver CAPTCHA.");
      continue; // Si falla, reintenta
    }

    isTokenValid = await verifyRecaptcha(captchaResponse);

    if (isTokenValid) {
      logger.info("CAPTCHA validado correctamente.");
      break; // Sale del bucle si se valida correctamente
    } else {
      logger.warn(
        `Token inválido. Reintentando... (${attempts}/${maxRetries})`
      );
    }
  }

  if (!isTokenValid) {
    throw new Error("No se pudo validar el CAPTCHA tras varios intentos.");
  }

  return captchaResponse;
};

async function getPublicIP() {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  // Configuración del proxy (igual que con `curl`)
  try {
    const response = await axios.get("http://icanhazip.com", {
      proxy: {
        protocol: "http",
        host: dns,
        port: port,
        auth: {
          username: encodedUser, // Asegúrate de usar las credenciales escapadas
          password: encodedPassword,
        },
      },
    });
    logger.info(`Tu IP pública es: ${response.data.trim()}`);
    return response.data.trim();
  } catch (error) {
    logger.error("Error al obtener la IP pública:", error.message);
  }
}

const verifyRecaptcha = async (token) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const proxyUrl = `http://${user}:${password}@${dns}:${port}`;
  const proxyAgent = new HttpsProxyAgent(proxyUrl);
  logger.info(`Recaptcha token to verify: ${token}`);

  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      new URLSearchParams({
        secret: secretKey,
        response: token,
        // Puedes incluir el remoteip si es necesario
        // remoteip: 'user-ip-address'
      }),
      {
        httpsAgent: proxyAgent, // Usar proxy
        headers: {
          "Content-Type": "application/x-www-form-urlencoded", // Importante para enviar datos en el cuerpo de la solicitud
        },
      }
    );

    const verificationResult = response.data;
    if (verificationResult.success) {
      logger.info("reCAPTCHA verificado con éxito.");
      return true;
    } else {
      let error = verificationResult["error-codes"]
        ? verificationResult["error-codes"][0]
        : "Error desconocido";
      logger.error("Error en la verificación de reCAPTCHA:", error);
      return false;
    }
  } catch (error) {
    console.log("Error al verificar reCAPTCHA", error);
    logger.error("Error al verificar reCAPTCHA:", error.message);
    return false;
  }
};

const scrapeWithoutBrowser = async () => {
  try {
    const captchaResponse = await capsolver(siteKey, pageUrl);

    console.log(captchaResponse);

    if (!captchaResponse) throw new Error("Error al resolver CAPTCHA.");

    /* const maxRetries = 5;
    captchaResponse = await retryCaptchaValidation(maxRetries, siteKey, pageUrl);
 */

    const isTokenValid = await verifyRecaptcha(captchaResponse);
    logger.info("Is token valid: ", isTokenValid);
  } catch (err) {
    console.log(err);
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
    ip: "",
  };

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", `--proxy-server=${dns}:${port}`],
      ignoreDefaultArgs: ["--disable-extensions"],
      defaultViewport: null,
      executablePath: "/usr/bin/google-chrome",
      userDataDir: "/usr/bin/custom/cache",
    });

    const page = await browser.newPage();
    await page.authenticate({
      username: user, // Tu usuario del proxy
      password: password, // Tu contraseña del proxy
    });
    logger.info("Navegando a la página");
    await page.goto("https://www.correoargentino.com.ar/formularios/ondnc", {
      waitUntil: "domcontentloaded",
    });
    const ip = getPublicIP();
    if (ip) {
      result.ip = ip;
    }

    // Simular movimientos de mouse
    await simulateHumanLikeMouseMovements(page);

    const isCaptchaPresent = await page.evaluate(() => {
      return document.querySelector(".g-recaptcha") !== null;
    });
    logger.info(`Captcha class: ${isCaptchaPresent}`);

    let captchaResponse;
    try {
      const solver = new Captcha.Solver(process.env.RECAPTCHA_API_KEY);
      captchaResponse = await solver.recaptcha(
        process.env.RECAPTCHA_SCRAPE_PAGE_SITE_KEY,
        process.env.RECAPTCHA_SCRAPE_PAGE,
        {
          proxy: `${process.env.RECAPTCHA_USER}:${process.env.RECAPTCHA_PASSWORD}@${process.env.RECAPTCHA_PROXY}`,
          proxytype: "HTTPS",
        }
      );
      captchaResponse = captchaResponse.data;
      console.log(captchaResponse);
      if (!captchaResponse) {
        throw new Error("Error al resolver CAPTCHA.");
      }
    } catch (err) {
      logger.error(`Error al resolver CAPTCHA: ${err.message}`);
      throw err;
    }

    //captchaResponse = await resolveCaptcha(page);
    //  captchaResponse = await captchaACSolver()
    //captchaResponse = await capsolver(siteKey, pageUrl);

    //console.log(captchaResponse);

    if (!captchaResponse) throw new Error("Error al resolver CAPTCHA.");

    /* const maxRetries = 5;
    captchaResponse = await retryCaptchaValidation(maxRetries, siteKey, pageUrl);
 */

    const isTokenValid = await verifyRecaptcha(captchaResponse);
    logger.info("Is token valid: ", isTokenValid);
    logger.info(`Token: ${captchaResponse}`);
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

module.exports = { scrapeCA, scrapeWithoutBrowser };
