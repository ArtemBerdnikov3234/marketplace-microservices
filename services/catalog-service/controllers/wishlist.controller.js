const Wishlist = require("../models/wishlist.model");
const Product = require("../models/product.model"); // Чтобы проверить, существует ли товар

class WishlistController {
  // Получить вишлист текущего пользователя
  async getWishlist(req, res, next) {
    try {
      const userId = req.user.userId;

      // Ищем вишлист и сразу "популейтим" (подтягиваем) данные о товарах
      let wishlist = await Wishlist.findOne({ userId }).populate("products");

      if (!wishlist) {
        return res.json({ productIds: [], products: [] });
      }

      // Возвращаем и список ID, и полные объекты (для удобства фронтенда)
      res.json({
        productIds: wishlist.products.map((p) => p._id || p), // map для надежности
        products: wishlist.products,
      });
    } catch (error) {
      next(error);
    }
  }

  // Добавить товар в вишлист
  async addToWishlist(req, res, next) {
    try {
      const userId = req.user.userId;
      const { productId } = req.body; // productId теперь строка (ObjectId)

      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }

      // Проверяем, существует ли такой товар
      const productExists = await Product.findById(productId);
      if (!productExists) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Находим вишлист или создаем новый (upsert)
      let wishlist = await Wishlist.findOne({ userId });
      if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
      }

      // Проверяем на дубликаты (в массиве ObjectId нужно сравнивать через .equals или строки)
      const alreadyExists = wishlist.products.some(
        (p) => p.toString() === productId,
      );

      if (!alreadyExists) {
        wishlist.products.push(productId);
        await wishlist.save();
      }

      res.status(201).json({ message: "Product added to wishlist" });
    } catch (error) {
      next(error);
    }
  }

  // Удалить товар из вишлиста
  async removeFromWishlist(req, res, next) {
    try {
      const userId = req.user.userId;
      const { productId } = req.params;

      const wishlist = await Wishlist.findOne({ userId });

      if (wishlist) {
        // Удаляем из массива
        wishlist.products = wishlist.products.filter(
          (p) => p.toString() !== productId,
        );
        await wishlist.save();
      }

      res.json({ message: "Product removed from wishlist" });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WishlistController();
