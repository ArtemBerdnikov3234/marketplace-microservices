const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const crypto = require("crypto");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const sequelize = require("./config/db");

const authRoutes = require("./routes/auth.routes");
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
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = "auth-service";
const SERVICE_ID = `${SERVICE_NAME}-${crypto.randomBytes(4).toString("hex")}`;
const SERVICE_HOST = process.env.SERVICE_HOST;

// Initialize observability
const logger = createLogger(SERVICE_NAME);
const tracer = initJaegerTracer(SERVICE_NAME);

logger.info("Starting Auth Service", {
  serviceId: SERVICE_ID,
  port: PORT,
});

app.use(helmet());
app.use(cors());
app.use(express.json());

// Observability middleware
app.use(metricsMiddleware(SERVICE_NAME));
app.use(tracingMiddleware(tracer, SERVICE_NAME));
app.use(loggingMiddleware(logger));

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Swagger
try {
  const swaggerDocument = YAML.load(
    path.join(__dirname, "docs/openapi-auth.yaml"),
  );
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
  logger.warn("Could not load swagger docs", { error: error.message });
}

// Inject logger and tracer
app.use((req, res, next) => {
  req.logger = logger;
  req.tracer = tracer;
  next();
});

app.use("/api/auth", authRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    url: req.url,
  });

  if (req.span) {
    req.span.setTag("error", true);
    req.span.log({ event: "error", message: err.message });
  }

  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(PORT, async () => {
  logger.info(`Auth Service (${SERVICE_ID}) running on port ${PORT}`);

  try {
    await sequelize.sync(); // Эта команда создаст таблицу Users в Postgres, если её нет
    logger.info("PostgreSQL connected and synced");
  } catch (error) {
    logger.error("Unable to connect to the database:", {
      error: error.message,
    });
    // Не выходим из процесса (process.exit), чтобы контейнер не перезагружался бесконечно,
    // но в реальном проде это критическая ошибка.
  }

  if (!SERVICE_HOST) {
    logger.error("SERVICE_HOST environment variable not set. Exiting.");
    process.exit(1);
  }

  try {
    await registerWithConsul(SERVICE_NAME, SERVICE_ID, PORT, SERVICE_HOST);
    logger.info("Registered with Consul", { serviceId: SERVICE_ID });
  } catch (error) {
    logger.error("Failed to register with Consul", { error: error.message });
    process.exit(1);
  }
});

const gracefulShutdown = async () => {
  logger.info("Graceful shutdown initiated");

  try {
    await deregisterFromConsul(SERVICE_ID);
    await tracer.close();
  } finally {
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
