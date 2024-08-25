const express = require('express');
const router = express.Router();
const { createSubscription } = require('../controllers/subscriptionController');

router.get('/', createSubscription);

module.exports = router;
