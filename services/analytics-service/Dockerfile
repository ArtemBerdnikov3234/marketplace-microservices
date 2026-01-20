# services/analytics-service/Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

# --- 1. Установка зависимостей для кэширования ---
# Сначала копируем зависимости общего модуля и устанавливаем их
COPY services/common/package*.json ./services/common/
RUN npm install --prefix services/common

# Копируем зависимости сервиса и устанавливаем их
COPY services/analytics-service/package*.json ./services/analytics-service/
RUN npm install --prefix services/analytics-service

# --- 2. Копирование исходного кода ---
# Копируем код общего модуля и самого сервиса
COPY services/common ./services/common
COPY services/analytics-service ./services/analytics-service

# --- 3. Запуск приложения ---
# Устанавливаем рабочую директорию на конкретный сервис
WORKDIR /usr/src/app/services/analytics-service

# Port не указываем, так как он задан в docker-compose
CMD ["npm", "start"]