// services/auth-service/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const crypto = require("crypto");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const { registerWithConsul, deregisterFromConsul } = require("./utils/consul");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = "auth-service";
const SERVICE_ID = `${SERVICE_NAME}-${crypto.randomBytes(4).toString("hex")}`;
const SERVICE_HOST = process.env.SERVICE_HOST;

app.use(helmet());
app.use(cors());
app.use(express.json());

const swaggerDocument = YAML.load(
  path.join(__dirname, "docs/openapi-auth.yaml")
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/health", (req, res) => res.status(200).json({ status: "UP" }));
app.use("/api/auth", authRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(PORT, async () => {
  console.log(`Auth Service (${SERVICE_ID}) running on port ${PORT}`);
  if (!SERVICE_HOST) {
    console.error("SERVICE_HOST environment variable not set. Exiting.");
    process.exit(1);
  }
  try {
    await registerWithConsul(SERVICE_NAME, SERVICE_ID, PORT, SERVICE_HOST);
  } catch (error) {
    console.error("Failed to register with Consul:", error.message);
    process.exit(1);
  }
});

const gracefulShutdown = async () => {
  console.log("Deregistering from Consul...");
  try {
    await deregisterFromConsul(SERVICE_ID);
  } finally {
    server.close(() => process.exit(0));
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
