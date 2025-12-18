const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "order-service",
  brokers: [process.env.KAFKA_BROKER || "kafka:29092"],
});

const producer = kafka.producer();

async function connectKafkaProducer() {
  await producer.connect();
  console.log("[Order] Kafka Producer connected");
}

async function publishEvent(eventType, payload) {
  try {
    const event = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    await producer.send({
      topic: "order-events",
      messages: [{ value: JSON.stringify(event) }],
    });
    console.log(`[Order] Event published to Kafka: ${eventType}`);
  } catch (error) {
    console.error("[Order] Failed to publish event:", error);
  }
}

module.exports = { connectKafkaProducer, publishEvent };
