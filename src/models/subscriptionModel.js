const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
  userId: { type: String, required: true },
  chatId: { type: String, required: true }, // Asegúrate de tener este campo
  subscriptionDate: { type: Date, default: Date.now },
  status: { type: String, default: "active" },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
