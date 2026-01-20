// services/order-service/app.js
const express = require("express");
const dotenv = require("dotenv");
const {
  connectRabbitMQ,
  getChannel,
  EXCHANGE_NAME,
} = require("./utils/rabbitmq");
const { connectKafkaProducer } = require("./utils/kafka");
const { cancelOrder } = require("./controllers/order.controller");
const orderRoutes = require("./routes/order.routes");
const { sequelize } = require("./models/index"); // Импорт моделей

// OBSERVABILITY
const {
  register,
  createLogger,
  initJaegerTracer,
  metricsMiddleware,
  tracingMiddleware,
  loggingMiddleware,
} = require("../common/observability");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const SERVICE_NAME = "order-service";

const logger = createLogger(SERVICE_NAME);
const tracer = initJaegerTracer(SERVICE_NAME);

logger.info("Starting Order Service", { port: PORT });

app.use(express.json());

app.use(metricsMiddleware(SERVICE_NAME));
app.use(tracingMiddleware(tracer, SERVICE_NAME));
app.use(loggingMiddleware(logger));

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", service: SERVICE_NAME });
});

app.use((req, res, next) => {
  req.logger = logger;
  req.tracer = tracer;
  next();
});

app.use("/api/orders", orderRoutes);

app.use((err, req, res, next) => {
  logger.error("Error", { error: err.message, url: req.url });
  if (req.span) {
    req.span.setTag("error", true);
    req.span.log({ event: "error", message: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

async function startSagaListeners() {
  const channel = getChannel();
  const PAYMENT_FAILED_KEY = "payment.failed";
  const COMPENSATION_QUEUE = "order_compensation_queue";

  await channel.assertQueue(COMPENSATION_QUEUE, { durable: true });
  await channel.bindQueue(
    COMPENSATION_QUEUE,
    EXCHANGE_NAME,
    PAYMENT_FAILED_KEY,
  );

  logger.info("Listening for payment.failed events");

  channel.consume(COMPENSATION_QUEUE, (msg) => {
    if (msg !== null) {
      const event = JSON.parse(msg.content.toString());

      const span = tracer.startSpan("saga-compensation", {
        tags: {
          "event.type": "payment.failed",
          "order.id": event.orderId,
        },
      });

      logger.info("Payment failed event received", { orderId: event.orderId });

      // Передаем tracer для трассировки
      cancelOrder(event.orderId, tracer);

      span.finish();
      channel.ack(msg);
    }
  });
}

async function startServer() {
  // Подключение к БД
  try {
    await sequelize.sync();
    logger.info("PostgreSQL connected and synced");
  } catch (error) {
    logger.error("Database connection failed", { error: error.message });
    // В реальном мире тут стоит сделать process.exit(1), но для демо оставим
  }

  app.listen(PORT, async () => {
    logger.info(`Order Service listening on port ${PORT}`);

    try {
      await connectRabbitMQ();
      logger.info("RabbitMQ connected");

      await connectKafkaProducer(); // <--- ДОБАВЛЕНО: Подключаем Kafka Producer
      logger.info("Kafka Producer connected"); // <--- ДОБАВЛЕНО

      await startSagaListeners();
      logger.info("Saga listeners started");
    } catch (error) {
      logger.error("Startup error", { error: error.message });
      process.exit(1);
    }
  });
}

startServer();

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received");
  await tracer.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received");
  await tracer.close();
  process.exit(0);
});
