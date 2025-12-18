const { validationResult } = require("express-validator");
const { getChannel, EXCHANGE_NAME } = require("../utils/rabbitmq");
const { publishEvent } = require("../utils/kafka"); // <-- Kafka
const EventStore = require("../models/eventStore"); // <-- Event Sourcing

let orderIdCounter = 1;
const ORDER_CREATED_KEY = "order.created";

class OrderController {
  // Query: Чтение состояния (восстанавливается из событий)
  async getUserOrders(req, res, next) {
    try {
      const userId = req.user.userId;
      // Используем EventStore для получения актуального состояния
      const userOrders = EventStore.getAllOrdersForUser(userId);
      res.json({ orders: userOrders });
    } catch (error) {
      next(error);
    }
  }

  // Command: Создание события
  async createOrder(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { items } = req.body;
      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const orderId = orderIdCounter++;

      const payload = {
        id: orderId,
        userId,
        items,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        createdAt: new Date().toISOString(),
      };

      // 1. Сохраняем событие в Event Store
      EventStore.save(orderId, "OrderCreated", payload);

      // 2. Публикуем в Kafka (для аналитики)
      await publishEvent("OrderCreated", payload);

      // 3. Публикуем в RabbitMQ (для Саги - совместимость с прошлым шагом)
      // В "чистой" архитектуре Saga тоже могла бы слушать Kafka, но мы оставим Rabbit
      const channel = getChannel();
      const sagaPayload = { ...payload, status: "pending" }; // Саге нужно поле status
      channel.publish(
        EXCHANGE_NAME,
        ORDER_CREATED_KEY,
        Buffer.from(JSON.stringify(sagaPayload))
      );

      console.log(`[Order] Order ${orderId} created (Event Sourced).`);

      res.status(202).json({
        message: "Order accepted.",
        order: EventStore.getOrderState(orderId), // Возвращаем восстановленное состояние
      });
    } catch (error) {
      next(error);
    }
  }
}

// Обновленная функция компенсации (тоже через события)
async function cancelOrder(orderId) {
  const currentState = EventStore.getOrderState(orderId);

  if (currentState && currentState.status === "pending") {
    // 1. Сохраняем событие
    EventStore.save(orderId, "OrderCancelled", { reason: "Payment Failed" });

    // 2. Публикуем в Kafka
    await publishEvent("OrderCancelled", {
      id: orderId,
      totalAmount: currentState.totalAmount,
    });

    console.log(
      `[Order] SAGA COMPENSATION: Order ${orderId} cancelled via Event Sourcing.`
    );
  }
}

module.exports = { OrderController: new OrderController(), cancelOrder };
