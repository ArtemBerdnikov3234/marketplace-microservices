FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

COPY protos ./protos

RUN npm install

COPY . .

CMD ["npm", "start"]