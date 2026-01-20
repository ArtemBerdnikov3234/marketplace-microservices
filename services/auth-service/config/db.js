// services/auth-service/config/db.js
const { Sequelize } = require("sequelize");

// Подключение к базе данных 'auth_db'
const sequelize = new Sequelize(
  process.env.DB_NAME, // Название БД (из docker-compose)
  process.env.DB_USER, // Логин (admin)
  process.env.DB_PASS, // Пароль (root)
  {
    host: process.env.DB_HOST, // Хост (имя контейнера 'postgres')
    dialect: "postgres",
    logging: false, // Отключаем лишний мусор в логах
  },
);

module.exports = sequelize;
