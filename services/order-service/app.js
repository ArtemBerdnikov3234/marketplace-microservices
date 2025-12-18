const express = require("express");
const dotenv = require("dotenv");
const {
  connectRabbitMQ,
  getChannel,
  EXCHANGE_NAME,
} = require("./utils/rabbitmq");
const { cancelOrder } = require("./controllers/order.controller");
const orderRoutes = require("./routes/order.routes");
const { verifyToken } = require("./middleware/auth.middleware");
const { connectKafkaProducer } = require("./utils/kafka");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Регистрируем роуты. Middleware verifyToken уже внутри orderRoutes
app.use("/api/orders", orderRoutes);

// Функция для настройки прослушивания событий Saga
async function startSagaListeners() {
  const channel = getChannel();
  const PAYMENT_FAILED_KEY = "payment.failed";
  const COMPENSATION_QUEUE = "order_compensation_queue";

  await channel.assertQueue(COMPENSATION_QUEUE, { durable: true });
  await channel.bindQueue(
    COMPENSATION_QUEUE,
    EXCHANGE_NAME,
    PAYMENT_FAILED_KEY
  );

  console.log(
    '[Order] Waiting for "payment.failed" events for compensation...'
  );
  channel.consume(COMPENSATION_QUEUE, (msg) => {
    if (msg !== null) {
      const event = JSON.parse(msg.content.toString());
      // Вызываем компенсирующую транзакцию
      cancelOrder(event.orderId);
      channel.ack(msg);
    }
  });
}

// Основная функция запуска сервиса
async function startServer() {
  app.listen(PORT, async () => {
    console.log(`[Order] Service listening on port ${PORT}`);
    try {
      await connectRabbitMQ();
      await connectKafkaProducer();
      await startSagaListeners();
      console.log(
        "[Order] Application started successfully and listening for events."
      );
    } catch (error) {
      console.error("[Order] Fatal error during application startup:", error);
      process.exit(1);
    }
  });
}

startServer();
