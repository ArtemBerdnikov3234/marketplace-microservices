// services/auth-service/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/user.model"); // Импортируем нашу модель

class AuthController {
  // Регистрация
  async register(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;

      // ПРОВЕРКА В БД: Ищем пользователя по email
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res
          .status(409)
          .json({ error: "User with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // СОЗДАНИЕ В БД: Создаем новую запись
      const user = await User.create({
        username,
        email,
        passwordHash, // Важно: поле называется passwordHash, как в модели
        role: "user",
      });

      res.status(201).json({
        message: "User registered successfully",
        userId: user.id,
        role: user.role,
      });
    } catch (error) {
      next(error);
    }
  }

  // Логин
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // ПОИСК В БД
      const user = await User.findOne({ where: { email } });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          username: user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN },
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Профиль
  async getProfile(req, res, next) {
    try {
      // ПОИСК ПО ID (Primary Key)
      const user = await User.findByPk(req.user.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Преобразуем в JSON и убираем пароль
      const userJson = user.toJSON();
      delete userJson.passwordHash;

      res.json(userJson);
    } catch (error) {
      next(error);
    }
  }

  // Список всех (для админа)
  async getAllUsers(req, res, next) {
    try {
      // ПОЛУЧИТЬ ВСЕХ ИЗ БД
      const usersList = await User.findAll({
        attributes: { exclude: ["passwordHash"] }, // Сразу говорим БД не возвращать пароль
      });
      res.json({ users: usersList, total: usersList.length });
    } catch (error) {
      next(error);
    }
  }

  // Обновление роли
  async updateUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // ОБНОВЛЕНИЕ В БД
      user.role = role;
      await user.save(); // Сохраняем изменения

      res.json({
        message: "User role updated successfully",
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
