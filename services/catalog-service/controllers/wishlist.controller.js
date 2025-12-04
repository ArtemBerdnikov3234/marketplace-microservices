// services/catalog-service/controllers/wishlist.controller.js

const wishlists = new Map();

class WishlistController {
  async getWishlist(req, res) {
    const userId = req.user.userId;
    const userWishlist = wishlists.get(userId) || new Set();
    res.json({ productIds: Array.from(userWishlist) });
  }

  async addToWishlist(req, res) {
    const userId = req.user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    if (!wishlists.has(userId)) {
      wishlists.set(userId, new Set());
    }

    wishlists.get(userId).add(parseInt(productId));
    res.status(201).json({ message: "Product added to wishlist" });
  }

  async removeFromWishlist(req, res) {
    const userId = req.user.userId;
    const { productId } = req.params;

    if (wishlists.has(userId)) {
      wishlists.get(userId).delete(parseInt(productId));
    }

    res.json({ message: "Product removed from wishlist" });
  }
}

module.exports = new WishlistController();
