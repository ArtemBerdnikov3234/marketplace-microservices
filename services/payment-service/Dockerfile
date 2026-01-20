# services/payment-service/Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

# --- 1. Установка зависимостей ---
COPY services/common/package*.json ./services/common/
RUN npm install --prefix services/common

COPY services/payment-service/package*.json ./services/payment-service/
RUN npm install --prefix services/payment-service

# --- 2. Копирование кода ---
COPY services/common ./services/common
COPY services/payment-service ./services/payment-service

# --- 3. ВАЖНО: Копирование protos из корня проекта внутрь сервиса ---
COPY protos ./services/payment-service/protos

# --- 4. Запуск ---
WORKDIR /usr/src/app/services/payment-service

CMD ["npm", "start"]