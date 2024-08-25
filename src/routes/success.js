const express = require('express');
const router = express.Router();
const { handleSuccess } = require('../controllers/subscriptionController');

router.get('/', handleSuccess);

module.exports = router;
