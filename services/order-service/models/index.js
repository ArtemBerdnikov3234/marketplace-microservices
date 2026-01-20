const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Ссылка на конфиг подключения

// Модель Заказа
const Order = sequelize.define("Order", {
  // ID создается автоматически
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: "pending", // Статусы: pending, paid, cancelled
  },
});

// Модель Позиции в заказе (товар + кол-во)
const OrderItem = sequelize.define("OrderItem", {
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});

// Настройка связей (Один Заказ имеет Много Позиций)
Order.hasMany(OrderItem, { as: "items", onDelete: "CASCADE" });
OrderItem.belongsTo(Order);

module.exports = { Order, OrderItem, sequelize };
