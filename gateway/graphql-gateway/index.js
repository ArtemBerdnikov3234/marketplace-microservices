// gateway/graphql-gateway/index.js
const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { readFileSync } = require("fs");
const path = require("path");
const resolvers = require("./resolvers");
const axios = require("axios");

require("dotenv").config();

const typeDefs = readFileSync(path.join(__dirname, "./schema.graphql"), {
  encoding: "utf-8",
});

// Используем URL из переменных окружения, которые будут указывать НАПРЯМУЮ на сервисы
const orderServiceUrl =
  process.env.ORDER_SERVICE_URL || "http://localhost:3003";
const catalogServiceUrl =
  process.env.CATALOG_SERVICE_URL || "http://localhost:3002";

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer() {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => ({
      token: req.headers.authorization || "",
      dataSources: {
        ordersAPI: axios.create({ baseURL: orderServiceUrl }),
        catalogAPI: axios.create({ baseURL: catalogServiceUrl }),
      },
    }),
  });
  console.log(`🚀 GraphQL Gateway ready at: ${url}`);
}

startServer();
