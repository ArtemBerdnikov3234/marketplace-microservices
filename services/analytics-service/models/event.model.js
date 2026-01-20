const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  payload: { type: Object }, // Храним любые данные события
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AnalyticsEvent", eventSchema);
