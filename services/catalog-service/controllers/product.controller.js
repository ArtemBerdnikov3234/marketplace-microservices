// services/catalog-service/controllers/product.controller.js
const { validationResult } = require("express-validator");

// Хранилище товаров в памяти
const products = new Map();
let productIdCounter = 1;

// Начальные данные для демонстрации
const seedProducts = () => {
  const sampleProducts = [
    {
      id: productIdCounter++,
      name: "Classic White T-Shirt",
      description: "Premium cotton t-shirt with comfortable fit",
      price: 29.99,
      size: "M",
      color: "White",
      stock: 100,
      brand: "BasicWear",
      createdAt: new Date().toISOString(),
    },
    {
      id: productIdCounter++,
      name: "Blue Denim Jeans",
      description: "Stylish slim-fit jeans for everyday wear",
      price: 79.99,
      size: "L",
      color: "Blue",
      stock: 50,
      brand: "DenimPro",
      createdAt: new Date().toISOString(),
    },
    {
      id: productIdCounter++,
      name: "Black Leather Jacket",
      description: "Genuine leather jacket with modern design",
      price: 199.99,
      size: "XL",
      color: "Black",
      stock: 25,
      brand: "LeatherLux",
      createdAt: new Date().toISOString(),
    },
  ];

  sampleProducts.forEach((product) => products.set(product.id, product));
  console.log("Product data seeded.");
};

seedProducts();

class ProductController {
  /**
   * Получает список всех товаров с возможностью фильтрации, сортировки и пагинации.
   */
  async getAllProducts(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let productList = Array.from(products.values());

      // Применяем фильтры из query-параметров
      const {
        size,
        color,
        minPrice,
        maxPrice,
        brand,
        sortBy,
        order,
        page,
        limit,
      } = req.query;

      if (size) {
        productList = productList.filter(
          (p) => p.size.toLowerCase() === size.toLowerCase()
        );
      }
      if (color) {
        productList = productList.filter(
          (p) => p.color.toLowerCase() === color.toLowerCase()
        );
      }
      if (brand) {
        productList = productList.filter((p) =>
          p.brand.toLowerCase().includes(brand.toLowerCase())
        );
      }
      if (minPrice) {
        productList = productList.filter(
          (p) => p.price >= parseFloat(minPrice)
        );
      }
      if (maxPrice) {
        productList = productList.filter(
          (p) => p.price <= parseFloat(maxPrice)
        );
      }

      // Применяем сортировку
      if (sortBy) {
        const sortOrder = order === "desc" ? -1 : 1;
        productList.sort((a, b) => {
          if (a[sortBy] < b[sortBy]) return -1 * sortOrder;
          if (a[sortBy] > b[sortBy]) return 1 * sortOrder;
          return 0;
        });
      }

      // Применяем пагинацию
      const pageNum = parseInt(page) || 1;
      const pageLimit = parseInt(limit) || 10;
      const startIndex = (pageNum - 1) * pageLimit;
      const endIndex = startIndex + pageLimit;
      const paginatedProducts = productList.slice(startIndex, endIndex);

      res.json({
        products: paginatedProducts,
        pagination: {
          page: pageNum,
          limit: pageLimit,
          totalItems: productList.length,
          totalPages: Math.ceil(productList.length / pageLimit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает один товар по его ID.
   */
  async getProductById(req, res, next) {
    try {
      const product = products.get(parseInt(req.params.id));

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(product);
    } catch (error) {
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

      const { name, description, price, size, color, stock, brand } = req.body;

      const newProduct = {
        id: productIdCounter++,
        name,
        description,
        price: parseFloat(price),
        size,
        color,
        stock: parseInt(stock),
        brand,
        createdAt: new Date().toISOString(),
      };

      products.set(newProduct.id, newProduct);

      res.status(201).json({
        message: "Product created successfully",
        product: newProduct,
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

      const productId = parseInt(req.params.id);
      const product = products.get(productId);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const { name, description, price, size, color, stock, brand } = req.body;

      // Обновляем только те поля, которые были переданы в теле запроса
      if (name) product.name = name;
      if (description) product.description = description;
      if (price) product.price = parseFloat(price);
      if (size) product.size = size;
      if (color) product.color = color;
      if (stock !== undefined) product.stock = parseInt(stock);
      if (brand) product.brand = brand;

      products.set(productId, product);

      res.json({
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Удаляет товар по ID.
   */
  async deleteProduct(req, res, next) {
    try {
      const productId = parseInt(req.params.id);

      if (!products.has(productId)) {
        return res.status(404).json({ error: "Product not found" });
      }

      products.delete(productId);

      res.status(200).json({
        message: "Product deleted successfully",
        productId,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
