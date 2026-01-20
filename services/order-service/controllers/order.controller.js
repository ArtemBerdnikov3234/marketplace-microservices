// services/order-service/controllers/order.controller.js
const { validationResult } = require("express-validator");
const { getChannel, EXCHANGE_NAME } = require("../utils/rabbitmq");
const { publishEvent } = require("../utils/kafka");
const { Order, OrderItem, sequelize } = require("../models/index");

// METRICS
const {
  orderProcessingDuration,
  ordersTotal,
} = require("../../common/observability");

const ORDER_CREATED_KEY = "order.created";

class OrderController {
  // Получить все заказы пользователя
  async getUserOrders(req, res, next) {
    const span = req.span
      ? req.tracer.startSpan("get-user-orders", { childOf: req.span.context() })
      : null;

    try {
      const userId = req.user.userId;
      span?.setTag("user.id", userId);

      const userOrders = await Order.findAll({
        where: { userId },
        include: [{ model: OrderItem, as: "items" }], // Подгружаем товары заказа
        order: [["createdAt", "DESC"]],
      });

      req.logger.info("Orders retrieved", { userId, count: userOrders.length });
      res.json({ orders: userOrders });
      span?.finish();
    } catch (error) {
      span?.setTag("error", true);
      req.logger.error("Error fetching orders", { error: error.message });
      next(error);
    }
  }

  // Создать заказ (Saga Start)
  async createOrder(req, res, next) {
    const startTime = Date.now();
    const span = req.span
      ? req.tracer.startSpan("create-order", { childOf: req.span.context() })
      : null;

    // Начинаем транзакцию, чтобы заказ и товары сохранились атомарно
    const t = await sequelize.transaction();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await t.rollback();
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { items } = req.body;

      // Считаем общую сумму
      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // 1. Сохраняем заказ в БД
      const order = await Order.create(
        {
          userId,
          totalAmount,
          status: "pending",
        },
        { transaction: t },
      );

      // Подготавливаем товары
      const itemsData = items.map((item) => ({
        ...item,
        OrderId: order.id,
      }));

      // Сохраняем товары
      await OrderItem.bulkCreate(itemsData, { transaction: t });

      // Фиксируем транзакцию (заказ сохранен в БД со статусом pending)
      await t.commit();

      req.logger.info("Order saved to DB", { orderId: order.id });

      // 2. Отправляем событие в RabbitMQ (Saga)
      const channel = getChannel();
      const payload = {
        id: order.id,
        userId,
        totalAmount,
        items,
      };

      channel.publish(
        EXCHANGE_NAME,
        ORDER_CREATED_KEY,
        Buffer.from(JSON.stringify(payload)),
      );

      req.logger.info("Order published to MQ", { orderId: order.id });
      // Analytics Service ждет событие с типом "OrderCreated"
      await publishEvent("OrderCreated", payload);
      req.logger.info("Order published to Kafka", { orderId: order.id });

      // Метрики
      const duration = (Date.now() - startTime) / 1000;
      orderProcessingDuration.observe(
        { status: "created", service: "order-service" },
        duration,
      );
      ordersTotal.inc({ status: "created", service: "order-service" });

      res.status(201).json({
        message: "Order created",
        order: { id: order.id, status: "pending", totalAmount },
      });

      span?.finish();
    } catch (error) {
      // Если что-то пошло не так, откатываем транзакцию БД
      if (t && !t.finished) await t.rollback();

      req.logger.error("Order creation failed", { error: error.message });
      next(error);
    }
  }
}

// Компенсирующая транзакция (Saga Rollback)
async function cancelOrder(orderId, tracer) {
  const span = tracer ? tracer.startSpan("cancel-order") : null;
  span?.setTag("order.id", orderId);

  try {
    const order = await Order.findByPk(orderId);

    if (order && order.status === "pending") {
      order.status = "cancelled";
      await order.save();

      console.log(
        `[Order] SAGA COMPENSATION: Order ${orderId} cancelled in DB.`,
      );
      ordersTotal.inc({ status: "cancelled", service: "order-service" });
    }
  } catch (err) {
    console.error(`[Order] Failed to cancel order ${orderId}`, err);
  } finally {
    span?.finish();
  }
}

module.exports = { OrderController: new OrderController(), cancelOrder };
