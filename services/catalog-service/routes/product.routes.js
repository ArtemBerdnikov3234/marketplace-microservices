// services/catalog-service/routes/product.routes.js
const express = require("express");
const { body, query, param } = require("express-validator");
const productController = require("../controllers/product.controller.js");
const { verifyToken } = require("../middleware/auth.middleware.js");
const { adminOnly } = require("../middleware/rbac.middleware.js");

const router = express.Router();

// Публичные роуты (не требуют токен)
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Limit must be a positive integer"),
  ],
  productController.getAllProducts,
);

// Убрали .isInt()
router.get("/:id", productController.getProductById);

// Защищенные роуты (только для администраторов)
router.post(
  "/",
  verifyToken,
  adminOnly,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("price")
      .isFloat({ gt: 0 })
      .withMessage("Price must be a positive number"),
    body("stock")
      .isInt({ min: 0 })
      .withMessage("Stock must be a non-negative integer"),
  ],
  productController.createProduct,
);

// Убрали .isInt()
router.put("/:id", verifyToken, adminOnly, productController.updateProduct);

// Убрали .isInt()
router.delete("/:id", verifyToken, adminOnly, productController.deleteProduct);

module.exports = router;
