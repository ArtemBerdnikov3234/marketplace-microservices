require("dotenv").config();
const amqp = require("amqplib");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

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

// Имитация базы данных статусов
const paymentStatuses = new Map();

// --- RabbitMQ Logic ---
async function processPayment(order) {
  console.log(`[Payment] Processing payment for order ${order.id}...`);

  // Имитация задержки для реалистичности
  await new Promise((resolve) => setTimeout(resolve, 500));

  let status = "processed";
  // Если сумма заканчивается на .99 - ошибка
  if (order.totalAmount.toString().endsWith(".99")) {
    status = "failed";
  }

  paymentStatuses.set(order.id.toString(), {
    status: status,
    transactionId: `tx-${Date.now()}`,
  });

  return status === "processed";
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

        // Публикуем результат в RabbitMQ (для Saga)
        const routingKey = isSuccess ? "payment.succeeded" : "payment.failed";
        channel.publish(
          EXCHANGE_NAME,
          routingKey,
          Buffer.from(
            JSON.stringify({ orderId: order.id, userId: order.userId })
          )
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
const getPaymentStatus = (call, callback) => {
  const orderId = call.request.orderId;

  // !!! ИМИТАЦИЯ СБОЯ (CHAOS MONKEY) !!!
  // Если ID заказа равен "666", сервис "падает" (возвращает ошибку или виснет)
  if (orderId === "666") {
    // Имитируем тайм-аут или ошибку сервера
    return setTimeout(() => {
      callback({
        code: grpc.status.DEADLINE_EXCEEDED,
        details: "Service is too slow (Simulated failure)",
      });
    }, 2000);
  }

  const info = paymentStatuses.get(orderId);

  if (info) {
    callback(null, { status: info.status, transactionId: info.transactionId });
  } else {
    callback(null, { status: "pending", transactionId: "" });
  }
};

function startGrpcServer() {
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
    }
  );
}

// Start everything
startRabbitMQ();
startGrpcServer();
