require("dotenv").config();
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const EXCHANGE_NAME = "marketplace_events";
const PAYMENT_SUCCEEDED_KEY = "payment.succeeded";
const NOTIFICATION_QUEUE = "notification_queue";

async function start() {
  console.log("[Notification] Service starting...");
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      EXCHANGE_NAME,
      PAYMENT_SUCCEEDED_KEY
    );

    console.log('[Notification] Waiting for "payment.succeeded" events...');

    channel.consume(NOTIFICATION_QUEUE, (msg) => {
      if (msg !== null) {
        const event = JSON.parse(msg.content.toString());
        console.log(
          `[Notification] SUCCESS! Sending confirmation email for order ${event.orderId} to user ${event.userId}.`
        );
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("[Notification] Error starting service:", error);
    setTimeout(start, 5000);
  }
}

start();
