// services/payment-service/models/payment.model.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Payment = sequelize.define("Payment", {
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // Один платеж на один заказ
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2), // Финансовые данные лучше хранить в DECIMAL
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("processed", "failed", "pending"),
    defaultValue: "pending",
  },
});

module.exports = Payment;
