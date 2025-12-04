# --- Файл: services/order-service/Dockerfile ---
FROM node:18-alpine

RUN apk add --no-cache wget

WORKDIR /usr/src/app

COPY package*.json ./

COPY protos ./protos

RUN npm install

COPY . .

EXPOSE 3003

CMD ["npm", "start"]