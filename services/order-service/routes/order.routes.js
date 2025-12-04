const express = require("express");
const { body } = require("express-validator");
const { OrderController } = require("../controllers/order.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { breaker } = require("../utils/paymentClient");

const router = express.Router();

router.use(verifyToken);

// Получить заказы пользователя для проверки статуса
router.get("/", OrderController.getUserOrders);

// Создать заказ, который запускает Saga
router.post(
  "/",
  [
    body("items")
      .isArray({ min: 1 })
      .withMessage("Items must be a non-empty array"),
    body("items.*.productId")
      .isInt()
      .withMessage("Product ID must be an integer"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
    body("items.*.price")
      .isFloat({ gt: 0 })
      .withMessage("Price must be a positive number"),
  ],
  OrderController.createOrder
);

//Проверка статуса оплаты через gRPC + Circuit Breaker
router.get("/:id/payment-status", async (req, res) => {
  try {
    const orderId = req.params.id;
    // Вызываем через Breaker
    const result = await breaker.fire(orderId);

    res.json(result);
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

module.exports = router;
