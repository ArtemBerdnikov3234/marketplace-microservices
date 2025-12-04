// services/catalog-service/routes/wishlist.routes.js
const express = require("express");
const { body, param } = require("express-validator");
const wishlistController = require("../controllers/wishlist.controller.js");
const { verifyToken } = require("../middleware/auth.middleware.js");
const router = express.Router();

// Все роуты для "избранного" защищены
router.use(verifyToken);

router.get("/", wishlistController.getWishlist);

router.post("/", [body("productId").isInt()], wishlistController.addToWishlist);

router.delete(
  "/:productId",
  [param("productId").isInt()],
  wishlistController.removeFromWishlist
);

module.exports = router;
