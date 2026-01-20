const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const crypto = require("crypto");
const connectDB = require("./config/db");
const productRoutes = require("./routes/product.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const { registerWithConsul, deregisterFromConsul } = require("./utils/consul");

// OBSERVABILITY
const {
  register,
  createLogger,
  initJaegerTracer,
  metricsMiddleware,
  tracingMiddleware,
  loggingMiddleware,
} = require("../common/observability");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const SERVICE_NAME = "catalog-service";
const SERVICE_ID = `${SERVICE_NAME}-${crypto.randomBytes(4).toString("hex")}`;
const SERVICE_HOST = process.env.SERVICE_HOST;

const logger = createLogger(SERVICE_NAME);
const tracer = initJaegerTracer(SERVICE_NAME);

logger.info("Starting Catalog Service", { serviceId: SERVICE_ID, port: PORT });

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(metricsMiddleware(SERVICE_NAME));
app.use(tracingMiddleware(tracer, SERVICE_NAME));
app.use(loggingMiddleware(logger));

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", service: SERVICE_NAME });
});

app.use((req, res, next) => {
  req.logger = logger;
  req.tracer = tracer;
  next();
});

app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.use((err, req, res, next) => {
  logger.error("Error", { error: err.message, url: req.url });
  if (req.span) {
    req.span.setTag("error", true);
    req.span.log({ event: "error", message: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(PORT, async () => {
  logger.info(`Catalog Service (${SERVICE_ID}) running on port ${PORT}`);

  await connectDB();
  logger.info("Connected to MongoDB");

  if (!SERVICE_HOST) {
    logger.error("SERVICE_HOST not set");
    process.exit(1);
  }

  try {
    await registerWithConsul(SERVICE_NAME, SERVICE_ID, PORT, SERVICE_HOST);
    logger.info("Registered with Consul");
  } catch (error) {
    logger.error("Consul registration failed", { error: error.message });
    process.exit(1);
  }
});

const gracefulShutdown = async () => {
  logger.info("Shutting down");
  try {
    await deregisterFromConsul(SERVICE_ID);
    await tracer.close();
  } finally {
    server.close(() => process.exit(0));
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
