const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // _id создается автоматически MongoDB, но для совместимости с твоим старым кодом
    // можно добавить числовой id через плагин или просто использовать _id как строку
    name: {
      type: String,
      required: [true, "Product name is required"],
    },
    description: String,
    price: {
      type: Number,
      required: true,
    },
    size: String,
    color: String,
    stock: {
      type: Number,
      default: 0,
    },
    brand: String,
  },
  {
    timestamps: true, // Автоматически добавит createdAt и updatedAt
  },
);

// Добавим виртуальное поле 'id', которое будет возвращать _id в виде строки
productSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString(); // 1. Сначала сохраняем ID как строку
    delete ret._id; // 2. Потом удаляем системное поле _id
    delete ret.__v; // 3. Удаляем версию документа (опционально)
  },
});

module.exports = mongoose.model("Product", productSchema);
