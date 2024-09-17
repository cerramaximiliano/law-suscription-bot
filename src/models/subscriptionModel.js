const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
  stripeCustomerId: { type: String, required: true },
  userId: { type: String, required: true },
  chatId: { type: String, required: true },
  subscriptionDate: { type: Date, default: Date.now },
  lastMessageId: { type: String },
  lastMessageDate: { type: Date },
  status: { type: String, default: "active" },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
