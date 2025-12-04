// services/auth-service/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

// In-memory user storage
const users = new Map();
let userIdCounter = 1;

class AuthController {
  async register(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;

      if (Array.from(users.values()).some((u) => u.email === email)) {
        return res
          .status(409)
          .json({ error: "User with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = {
        id: userIdCounter++,
        username,
        email,
        passwordHash,
        role: "buyer",
      };

      users.set(user.id, user);

      res
        .status(201)
        .json({ message: "User registered successfully", userId: user.id });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = Array.from(users.values()).find((u) => u.email === email);

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({ token });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = users.get(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { passwordHash, ...userProfile } = user;
      res.json(userProfile);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
