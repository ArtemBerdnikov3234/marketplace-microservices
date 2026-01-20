const express = require("express");
const { Kafka } = require("kafkajs");
const connectDB = require("./config/db"); // Подключение БД
const AnalyticsEvent = require("./models/event.model"); // Модель

require("dotenv").config();

// OBSERVABILITY
const {
  register,
  createLogger,
  initJaegerTracer,
  metricsMiddleware,
  tracingMiddleware,
  loggingMiddleware,
} = require("../common/observability");

const app = express();
const PORT = process.env.PORT || 3004;
const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";
const SERVICE_NAME = "analytics-service";

const logger = createLogger(SERVICE_NAME);
const tracer = initJaegerTracer(SERVICE_NAME);

// Stats storage (оставляем в памяти для быстрого API, но историю пишем в БД)
const stats = {
  totalOrders: 0,
  totalRevenue: 0,
  cancelledOrders: 0,
  productsSold: {},
};

// Kafka Consumer
const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers: [KAFKA_BROKER],
});
const consumer = kafka.consumer({ groupId: "analytics-group" });

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: "order-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const eventStr = message.value.toString();
      const event = JSON.parse(eventStr);

      logger.info("Kafka event received", { type: event.type });

      // Сохраняем в MongoDB
      try {
        await AnalyticsEvent.create({
          eventType: event.type,
          payload: event.payload,
        });
      } catch (err) {
        logger.error("Failed to save event to DB", { error: err.message });
      }

      processEvent(event);
    },
  });
}

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
  }
}

// Middleware
app.use(metricsMiddleware(SERVICE_NAME));
app.use(tracingMiddleware(tracer, SERVICE_NAME));
app.use(loggingMiddleware(logger));

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/api/analytics", (req, res) => {
  res.json(stats);
});

// Запуск сервера
const server = app.listen(PORT, async () => {
  logger.info(`Analytics Service running on port ${PORT}`);

  // Подключение к БД
  await connectDB();
  logger.info("Connected to MongoDB");

  try {
    await startConsumer();
    logger.info("Kafka Consumer connected");
  } catch (err) {
    logger.error("Kafka connection error", { error: err.message });
  }
});

process.on("SIGTERM", async () => {
  await tracer.close();
  process.exit(0);
});
