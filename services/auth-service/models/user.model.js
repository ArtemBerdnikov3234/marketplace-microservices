// services/auth-service/models/user.model.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Импортируем подключение из шага 1

const User = sequelize.define("User", {
  // Автоматически создастся id (Primary Key)
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Email должен быть уникальным
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: "user",
  },
});

module.exports = User;
