# services/auth-service/Dockerfile
FROM node:18-alpine

RUN apk add --no-cache wget

WORKDIR /usr/src/app

# --- 1. Установка зависимостей для кэширования ---
COPY services/common/package*.json ./services/common/
RUN npm install --prefix services/common

COPY services/auth-service/package*.json ./services/auth-service/
RUN npm install --prefix services/auth-service

# --- 2. Копирование исходного кода ---
COPY services/common ./services/common
COPY services/auth-service ./services/auth-service

# --- 3. Запуск приложения ---
WORKDIR /usr/src/app/services/auth-service

EXPOSE 3001

CMD ["npm", "start"]