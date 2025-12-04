const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const Opossum = require("opossum");

const PROTO_PATH = path.join(__dirname, "../protos/payment.proto");
// Адрес payment-service внутри Docker сети
const PAYMENT_SERVICE_ADDR =
  process.env.PAYMENT_SERVICE_GRPC || "payment-service:50051";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const paymentProto = grpc.loadPackageDefinition(packageDefinition).payment;

const client = new paymentProto.PaymentService(
  PAYMENT_SERVICE_ADDR,
  grpc.credentials.createInsecure()
);

// Функция обертка для промисификации gRPC
function getStatusFromService(orderId) {
  return new Promise((resolve, reject) => {
    client.GetPaymentStatus({ orderId }, (error, response) => {
      if (error) return reject(error);
      resolve(response);
    });
  });
}

// --- Circuit Breaker Options ---
const breakerOptions = {
  timeout: 1000, // Если запрос длится дольше 1 сек -> считать ошибкой
  errorThresholdPercentage: 50, // Если 50% запросов падают -> открыть цепь
  resetTimeout: 5000, // Через 5 сек попробовать снова (Half-Open)
};

const breaker = new Opossum(getStatusFromService, breakerOptions);

// Логирование состояний
breaker.on("open", () =>
  console.warn("🔴 Circuit Breaker is OPEN! (Requests blocked)")
);
breaker.on("halfOpen", () =>
  console.log("🟡 Circuit Breaker is HALF-OPEN (Testing downstream)")
);
breaker.on("close", () =>
  console.log("🟢 Circuit Breaker is CLOSED (Normal operation)")
);
breaker.on("fallback", () => console.log("⚠️ Serving Fallback response"));

// Fallback функция (если сервис лежит)
breaker.fallback(() => {
  return {
    status: "unknown (service unavailable)",
    transactionId: "N/A",
    isFallback: true,
  };
});

module.exports = { breaker };
