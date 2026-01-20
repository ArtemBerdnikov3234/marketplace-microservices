# services/notification-service/Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

# --- 1. Установка зависимостей для кэширования ---
COPY services/common/package*.json ./services/common/
RUN npm install --prefix services/common

COPY services/notification-service/package*.json ./services/notification-service/
RUN npm install --prefix services/notification-service

# --- 2. Копирование исходного кода ---
COPY services/common ./services/common
COPY services/notification-service ./services/notification-service

# --- 3. Запуск приложения ---
WORKDIR /usr/src/app/services/notification-service

CMD ["npm", "start"]