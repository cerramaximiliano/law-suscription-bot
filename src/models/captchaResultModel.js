const mongoose = require('mongoose');

const CaptchaResultSchema = new mongoose.Schema({
  date: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) }, // Almacena solo la fecha
  service: { type: String, required: true }, // Nombre del servicio que resolvió el captcha
  success: { type: Number, default: 0 },
  failure: { type: Number, default: 0 }
});

const CaptchaResult = mongoose.model('CaptchaResult', CaptchaResultSchema);

module.exports = CaptchaResult;