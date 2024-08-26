const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/webhookController'); // Importa el controlador

router.post('/', handleWebhook);

module.exports = router;
