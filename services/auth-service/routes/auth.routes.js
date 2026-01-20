const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/auth.controller.js");
const { verifyToken, adminOnly } = require("../middleware/auth.middleware.js");

const router = express.Router();

router.post(
  "/register",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  authController.register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.login
);

router.get("/profile", verifyToken, authController.getProfile);

router.get("/users", verifyToken, adminOnly, authController.getAllUsers);
router.patch(
  "/users/:userId/role",
  verifyToken,
  adminOnly,
  authController.updateUserRole
);

module.exports = router;
