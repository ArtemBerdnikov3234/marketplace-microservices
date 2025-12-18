const express = require("express");
const { Kafka } = require("kafkajs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3004;
const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";

// Внутреннее хранилище статистики (Read Model)
const stats = {
  totalOrders: 0,
  totalRevenue: 0,
  cancelledOrders: 0,
  productsSold: {},
};

// Kafka Consumer
const kafka = new Kafka({
  clientId: "analytics-service",
  brokers: [KAFKA_BROKER],
});
const consumer = kafka.consumer({ groupId: "analytics-group" });

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: "order-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      console.log(`[Analytics] Received event: ${event.type}`);
      processEvent(event);
    },
  });
}

// Проекция событий в статистику (CQRS: Projector)
function processEvent(event) {
  const { type, payload } = event;

  if (type === "OrderCreated") {
    stats.totalOrders++;
    stats.totalRevenue += payload.totalAmount;

    payload.items.forEach((item) => {
      if (!stats.productsSold[item.productId]) {
        stats.productsSold[item.productId] = 0;
      }
      stats.productsSold[item.productId] += item.quantity;
    });
  } else if (type === "OrderCancelled") {
    stats.cancelledOrders++;
    // Можно вычитать выручку, если нужно
    // stats.totalRevenue -= payload.totalAmount;
  }
}

app.get("/api/analytics", (req, res) => {
  res.json(stats);
});

app.listen(PORT, async () => {
  console.log(`Analytics Service running on port ${PORT}`);
  try {
    await startConsumer();
    console.log("Kafka Consumer connected.");
  } catch (err) {
    console.error("Error connecting to Kafka:", err);
  }
});
