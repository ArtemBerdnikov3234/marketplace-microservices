require("dotenv").config();
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const EXCHANGE_NAME = "marketplace_events";
const ORDER_CREATED_KEY = "order.created";
const PAYMENT_SUCCEEDED_KEY = "payment.succeeded";
const PAYMENT_FAILED_KEY = "payment.failed";
const PAYMENT_QUEUE = "payment_queue";

async function processPayment(order) {
  console.log(
    `[Payment] Processing payment for order ${order.id} with amount ${order.totalAmount}...`
  );
  // Имитируем логику: если сумма заказа заканчивается на .99, оплата не проходит
  if (order.totalAmount.toString().endsWith(".99")) {
    console.log(
      `[Payment] Payment FAILED for order ${order.id}. Simulating payment gateway rejection.`
    );
    return false;
  }
  console.log(`[Payment] Payment SUCCEEDED for order ${order.id}.`);
  return true;
}

async function start() {
  console.log("[Payment] Service starting...");
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    await channel.assertQueue(PAYMENT_QUEUE, { durable: true });
    await channel.bindQueue(PAYMENT_QUEUE, EXCHANGE_NAME, ORDER_CREATED_KEY);

    console.log('[Payment] Waiting for "order.created" events...');

    channel.consume(PAYMENT_QUEUE, async (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString());
        const isSuccess = await processPayment(order);

        const resultEvent = {
          orderId: order.id,
          userId: order.userId,
          totalAmount: order.totalAmount,
        };

        const routingKey = isSuccess
          ? PAYMENT_SUCCEEDED_KEY
          : PAYMENT_FAILED_KEY;
        channel.publish(
          EXCHANGE_NAME,
          routingKey,
          Buffer.from(JSON.stringify(resultEvent))
        );

        console.log(
          `[Payment] Published event "${routingKey}" for order ${order.id}`
        );
        channel.ack(msg); // Подтверждаем обработку сообщения
      }
    });
  } catch (error) {
    console.error("[Payment] Error starting service:", error);
    setTimeout(start, 5000); // Попробовать переподключиться через 5 сек
  }
}

start();
