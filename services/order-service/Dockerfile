# services/order-service/Dockerfile
FROM node:18-alpine

RUN apk add --no-cache wget

WORKDIR /usr/src/app

# --- 1. Установка зависимостей ---
COPY services/common/package*.json ./services/common/
RUN npm install --prefix services/common

COPY services/order-service/package*.json ./services/order-service/
RUN npm install --prefix services/order-service

# --- 2. Копирование кода ---
COPY services/common ./services/common
COPY services/order-service ./services/order-service

# --- 3. ВАЖНО: Копирование protos из корня проекта внутрь сервиса ---
# Берем папку 'protos' из корня контекста сборки и кладем её внутрь папки сервиса в контейнере
COPY protos ./services/order-service/protos

# --- 4. Запуск ---
WORKDIR /usr/src/app/services/order-service

EXPOSE 3003

CMD ["npm", "start"]

