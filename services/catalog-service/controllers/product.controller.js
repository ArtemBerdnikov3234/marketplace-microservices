// services/catalog-service/controllers/product.controller.js
const Product = require("../models/product.model");
const { validationResult } = require("express-validator");

class ProductController {
  /**
   * Получает список всех товаров с фильтрацией, сортировкой и пагинацией (MongoDB).
   */
  async getAllProducts(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // --- Фильтрация ---
      const filter = {};

      // Поиск по бренду (case-insensitive)
      if (req.query.brand) {
        filter.brand = { $regex: req.query.brand, $options: "i" };
      }

      // Точное совпадение
      if (req.query.size) filter.size = req.query.size;
      if (req.query.color) filter.color = req.query.color;

      // Диапазон цен
      if (req.query.minPrice || req.query.maxPrice) {
        filter.price = {};
        if (req.query.minPrice)
          filter.price.$gte = parseFloat(req.query.minPrice);
        if (req.query.maxPrice)
          filter.price.$lte = parseFloat(req.query.maxPrice);
      }

      // --- Сортировка ---
      let sort = "-createdAt"; // По умолчанию: сначала новые
      if (req.query.sortBy) {
        const order = req.query.order === "desc" ? "-" : "";
        // В Mongo поле сортировки просто указывается строкой, например "-price" или "name"
        sort = order + req.query.sortBy;
      }

      // --- Пагинация ---
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      // --- Выполнение запроса ---
      const products = await Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const totalItems = await Product.countDocuments(filter);

      res.json({
        products,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает один товар по его ID (MongoDB _id).
   */
  async getProductById(req, res, next) {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      // Если ID имеет неверный формат MongoDB (не 24 hex chars), это тоже ошибка 404/400
      if (error.kind === "ObjectId") {
        return res.status(404).json({ error: "Product not found" });
      }
      next(error);
    }
  }

  /**
   * Создает новый товар.
   */
  async createProduct(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Mongoose модель сама валидирует типы данных
      const product = await Product.create(req.body);

      res.status(201).json({
        message: "Product created successfully",
        product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Обновляет существующий товар по ID.
   */
  async updateProduct(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }, // Вернуть обновленный документ
      );

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      if (error.kind === "ObjectId") {
        return res.status(404).json({ error: "Product not found" });
      }
      next(error);
    }
  }

  /**
   * Удаляет товар по ID.
   */
  async deleteProduct(req, res, next) {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.status(200).json({
        message: "Product deleted successfully",
        productId: req.params.id,
      });
    } catch (error) {
      if (error.kind === "ObjectId") {
        return res.status(404).json({ error: "Product not found" });
      }
      next(error);
    }
  }
}

module.exports = new ProductController();
