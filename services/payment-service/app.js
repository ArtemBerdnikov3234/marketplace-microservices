// services/payment-service/app.js
require("dotenv").config();
const amqp = require("amqplib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

// --- Database ---
const sequelize = require("./config/db");
const Payment = require("./models/payment.model");

// --- RabbitMQ Config ---
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const EXCHANGE_NAME = "marketplace_events";
const ORDER_CREATED_KEY = "order.created";
const PAYMENT_QUEUE = "payment_queue";

// --- gRPC Config ---
const PROTO_PATH = path.join(__dirname, "protos/payment.proto");
const GRPC_PORT = process.env.GRPC_PORT || "50051";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const paymentProto = grpc.loadPackageDefinition(packageDefinition).payment;

// --- RabbitMQ Logic ---
async function processPayment(order) {
  console.log(`[Payment] Processing payment for order ${order.id}...`);

  // Имитация задержки
  await new Promise((resolve) => setTimeout(resolve, 500));

  let status = "processed";
  // Если сумма заканчивается на .99 - ошибка (бизнес-логика для теста)
  if (order.totalAmount.toString().endsWith(".99")) {
    status = "failed";
  }

  const transactionId = `tx-${Date.now()}`;

  try {
    // Сохраняем (или обновляем) запись в БД
    const [payment, created] = await Payment.findOrCreate({
      where: { orderId: order.id },
      defaults: {
        transactionId,
        amount: order.totalAmount,
        status,
      },
    });

    // Если запись уже существовала (например, статус был pending), обновляем её
    if (!created) {
      payment.status = status;
      payment.transactionId = transactionId;
      payment.amount = order.totalAmount; // На всякий случай обновляем сумму
      await payment.save();
    }

    console.log(`[Payment] Order ${order.id} processed with status: ${status}`);
    return status === "processed";
  } catch (error) {
    console.error(`[Payment] DB Error processing order ${order.id}:`, error);
    // В реальной системе тут могла бы быть логика повторных попыток (DLQ)
    return false;
  }
}

async function startRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    await channel.assertQueue(PAYMENT_QUEUE, { durable: true });
    await channel.bindQueue(PAYMENT_QUEUE, EXCHANGE_NAME, ORDER_CREATED_KEY);

    channel.consume(PAYMENT_QUEUE, async (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString());
        const isSuccess = await processPayment(order);

        // Публикуем результат в RabbitMQ (для Saga Order Service)
        const routingKey = isSuccess ? "payment.succeeded" : "payment.failed";
        channel.publish(
          EXCHANGE_NAME,
          routingKey,
          Buffer.from(
            JSON.stringify({ orderId: order.id, userId: order.userId }),
          ),
        );
        channel.ack(msg);
      }
    });
    console.log("[Payment] RabbitMQ Consumer started.");
  } catch (error) {
    console.error("[Payment] RabbitMQ Error:", error);
    setTimeout(startRabbitMQ, 5000);
  }
}

// --- gRPC Implementation ---
const getPaymentStatus = async (call, callback) => {
  const orderId = call.request.orderId;

  // !!! ИМИТАЦИЯ СБОЯ (CHAOS MONKEY) !!!
  if (orderId === "666") {
    return setTimeout(() => {
      callback({
        code: grpc.status.DEADLINE_EXCEEDED,
        details: "Service is too slow (Simulated failure)",
      });
    }, 2000);
  }

  try {
    // Ищем платеж в PostgreSQL
    const payment = await Payment.findOne({ where: { orderId: orderId } });

    if (payment) {
      callback(null, {
        status: payment.status,
        transactionId: payment.transactionId,
      });
    } else {
      callback(null, { status: "pending", transactionId: "" });
    }
  } catch (error) {
    console.error("[Payment] gRPC DB Error:", error);
    callback({
      code: grpc.status.INTERNAL,
      details: "Database error",
    });
  }
};

async function startGrpcServer() {
  // Подключаемся к БД перед запуском gRPC
  try {
    await sequelize.sync();
    console.log("[Payment] Database connected and synced");
  } catch (err) {
    console.error("[Payment] Failed to connect to DB:", err);
    // Не выходим, чтобы не рестартить контейнер в цикле, но сервис будет нерабочим
  }

  const server = new grpc.Server();
  server.addService(paymentProto.PaymentService.service, {
    GetPaymentStatus: getPaymentStatus,
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error("[Payment] gRPC Bind Error:", error);
        return;
      }
      console.log(`[Payment] gRPC Server running on port ${port}`);
    },
  );
}

// Start everything
startRabbitMQ();
startGrpcServer();
