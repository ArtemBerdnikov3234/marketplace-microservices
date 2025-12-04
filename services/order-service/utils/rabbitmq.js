const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const EXCHANGE_NAME = "marketplace_events";
let channel = null;

async function connectRabbitMQ() {
  if (channel) return channel;
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    console.log("[Order] Connected to RabbitMQ and exchange is ready.");
    return channel;
  } catch (error) {
    console.error("[Order] Failed to connect to RabbitMQ", error);
    throw error;
  }
}

function getChannel() {
  if (!channel) throw new Error("RabbitMQ channel is not available.");
  return channel;
}

module.exports = { connectRabbitMQ, getChannel, EXCHANGE_NAME };
