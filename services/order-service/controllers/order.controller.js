const { validationResult } = require("express-validator");
const { getChannel, EXCHANGE_NAME } = require("../utils/rabbitmq");

// Хранилище заказов в памяти
const orders = new Map();
let orderIdCounter = 1;
const ORDER_CREATED_KEY = "order.created";

class OrderController {
  // Получить все заказы аутентифицированного пользователя
  async getUserOrders(req, res, next) {
    try {
      const userId = req.user.userId;
      const userOrders = Array.from(orders.values()).filter(
        (order) => order.userId === userId
      );
      res.json({ orders: userOrders });
    } catch (error) {
      next(error);
    }
  }

  // Создать новый заказ и запустить Saga
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

      const newOrder = {
        id: orderIdCounter++,
        userId,
        items,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        status: "pending", // Начальный статус
        createdAt: new Date().toISOString(),
      };

      orders.set(newOrder.id, newOrder);

      // Публикуем событие в RabbitMQ
      const channel = getChannel();
      channel.publish(
        EXCHANGE_NAME,
        ORDER_CREATED_KEY,
        Buffer.from(JSON.stringify(newOrder))
      );

      console.log(
        `[Order] Order ${newOrder.id} created and event "${ORDER_CREATED_KEY}" published.`
      );

      // Отвечаем клиенту СРАЗУ (статус 202 Accepted)
      res.status(202).json({
        message: "Order accepted for processing.",
        order: newOrder,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Отдельная функция для компенсирующей транзакции
function cancelOrder(orderId) {
  const order = orders.get(orderId);
  if (order && order.status === "pending") {
    order.status = "cancelled";
    orders.set(orderId, order);
    console.log(
      `[Order] SAGA COMPENSATION: Order ${orderId} has been cancelled due to payment failure.`
    );
  }
}

module.exports = { OrderController: new OrderController(), cancelOrder };
