# services/catalog-service/Dockerfile
FROM node:18-alpine

RUN apk add --no-cache wget

WORKDIR /usr/src/app

# --- 1. Установка зависимостей для кэширования ---
COPY services/common/package*.json ./services/common/
RUN npm install --prefix services/common

COPY services/catalog-service/package*.json ./services/catalog-service/
RUN npm install --prefix services/catalog-service

# --- 2. Копирование исходного кода ---
COPY services/common ./services/common
COPY services/catalog-service ./services/catalog-service

# --- 3. Запуск приложения ---
WORKDIR /usr/src/app/services/catalog-service

EXPOSE 3002

CMD ["npm", "start"]