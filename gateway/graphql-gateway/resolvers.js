// --- Файл: gateway/graphql-gateway/resolvers.js (ИСПРАВЛЕННАЯ ВЕРСИЯ С ЛОГИРОВАНИЕМ) ---

const resolvers = {
  Query: {
    userOrders: async (_, __, { token, dataSources }) => {
      console.log("--- [GraphQL Gateway] Received request for userOrders ---");
      console.log(
        `Incoming Authorization header: ${
          token ? `[${token}]` : "Not provided"
        }`
      );

      if (!token) {
        console.error("Authentication token is missing from the context.");
        throw new Error("Authentication token is required.");
      }

      let bearerToken = token;
      if (!bearerToken.toLowerCase().startsWith("bearer ")) {
        console.warn(
          "Authorization header is missing 'Bearer ' prefix. Adding it automatically."
        );
        bearerToken = `Bearer ${token}`;
      }

      try {
        const targetUrl = `${dataSources.ordersAPI.defaults.baseURL}/api/orders/`;
        console.log(`Sending GET request to: ${targetUrl}`);

        const downstreamHeaders = {
          authorization: bearerToken,
          "User-Agent": "GraphQL-Gateway/1.0",
        };
        console.log("Downstream headers being sent:", downstreamHeaders);

        const response = await dataSources.ordersAPI.get("/api/orders/", {
          headers: downstreamHeaders,
        });

        console.log(
          `SUCCESS from downstream service! Status: ${response.status}`
        );
        console.log(
          "----------------------------------------------------------"
        );
        return response.data.orders;
      } catch (error) {
        console.error("--- [GraphQL Gateway] FATAL ERROR ---");
        console.error(
          "Failed to get a successful response from the downstream order-service!"
        );

        if (error.response) {
          // Сервер ответил ошибкой (4xx, 5xx)
          console.error("Error Type: Server responded with an error.");
          console.error("Status Code:", error.response.status);
          console.error("Status Text:", error.response.statusText);
          console.error("Response Headers:", error.response.headers);
          console.error("Response Data:", JSON.stringify(error.response.data));
        } else if (error.request) {
          // Запрос был отправлен, но ответ не был получен (сеть, DNS, таймаут)
          console.error(
            "Error Type: No response received. This is a network/DNS/firewall issue."
          );
          console.error(
            `Attempted to connect to: ${error.config.baseURL}${error.config.url}`
          );
        } else {
          // Ошибка на этапе конфигурации Axios
          console.error("Error Type: Axios setup error.");
          console.error("Error Message:", error.message);
        }
        console.error(
          "----------------------------------------------------------"
        );
        throw new Error("Could not fetch user orders.");
      }
    },

    products: async (_, { limit }, { dataSources }) => {
      try {
        const response = await dataSources.catalogAPI.get(
          `/api/products/?limit=${limit || 10}` // Добавил слэш для единообразия
        );
        return response.data.products;
      } catch (error) {
        console.error(
          "Error fetching products:",
          error.response?.data || error.message
        );
        throw new Error("Could not fetch products.");
      }
    },
  },

  OrderItem: {
    product: async (parent, _, { dataSources }) => {
      try {
        const response = await dataSources.catalogAPI.get(
          `/api/products/${parent.productId}/`
        );
        return response.data;
      } catch (error) {
        console.error(
          `Error fetching product ${parent.productId}:`,
          error.response?.data || error.message
        );
        return null;
      }
    },
  },
};

module.exports = resolvers;
