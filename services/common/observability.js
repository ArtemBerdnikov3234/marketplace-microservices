const promClient = require("prom-client");
const { initTracer } = require("jaeger-client");
const winston = require("winston");

// ==================== PROMETHEUS METRICS ====================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// HTTP Metrics
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code", "service"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const httpRequestTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code", "service"],
});

const httpErrorsTotal = new promClient.Counter({
  name: "http_errors_total",
  help: "Total number of HTTP errors",
  labelNames: ["method", "route", "status_code", "service"],
});

const activeConnections = new promClient.Gauge({
  name: "active_connections",
  help: "Number of active connections",
  labelNames: ["service"],
});

// Business Metrics
const ordersTotal = new promClient.Counter({
  name: "orders_total",
  help: "Total number of orders",
  labelNames: ["status", "service"],
});

const orderProcessingDuration = new promClient.Histogram({
  name: "order_processing_duration_seconds",
  help: "Duration of order processing",
  labelNames: ["status", "service"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpErrorsTotal);
register.registerMetric(activeConnections);
register.registerMetric(ordersTotal);
register.registerMetric(orderProcessingDuration);

// ==================== LOGGING ====================
function createLogger(serviceName) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, service, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta)
                : "";
              return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
            }
          )
        ),
      }),
    ],
  });
}

// ==================== TRACING ====================
function initJaegerTracer(serviceName) {
  const config = {
    serviceName: serviceName,
    sampler: {
      type: "const",
      param: 1,
    },
    reporter: {
      logSpans: true,
      // Включаем HTTP sender вместо UDP sender
      collectorEndpoint: `http://${
        process.env.JAEGER_AGENT_HOST || "jaeger"
      }:14268/api/traces`,
    },
  };

  const options = {
    logger: {
      info: (msg) => console.log("Jaeger INFO:", msg),
      error: (msg) => console.error("Jaeger ERROR:", msg),
    },
  };

  return initTracer(config, options);
}

// ==================== MIDDLEWARE ====================
function metricsMiddleware(serviceName) {
  return (req, res, next) => {
    const start = Date.now();
    activeConnections.inc({ service: serviceName });

    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route ? req.route.path : req.path;
      const labels = {
        method: req.method,
        route: route,
        status_code: res.statusCode,
        service: serviceName,
      };

      httpRequestDuration.observe(labels, duration);
      httpRequestTotal.inc(labels);

      if (res.statusCode >= 400) {
        httpErrorsTotal.inc(labels);
      }

      activeConnections.dec({ service: serviceName });
    });

    next();
  };
}

function tracingMiddleware(tracer, serviceName) {
  return (req, res, next) => {
    const wireCtx = tracer.extract("http_headers", req.headers);
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
      childOf: wireCtx,
      tags: {
        "span.kind": "server",
        "http.method": req.method,
        "http.url": req.url,
        "service.name": serviceName,
      },
    });

    req.span = span;
    req.tracer = tracer;

    res.on("finish", () => {
      span.setTag("http.status_code", res.statusCode);
      if (res.statusCode >= 400) {
        span.setTag("error", true);
        span.log({ event: "error", message: `HTTP ${res.statusCode}` });
      }
      span.finish();
    });

    next();
  };
}

function loggingMiddleware(logger) {
  return (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      };

      if (res.statusCode >= 400) {
        logger.error("HTTP Request Error", logData);
      } else {
        logger.info("HTTP Request", logData);
      }
    });

    next();
  };
}

// ==================== EXPORTS ====================
module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpErrorsTotal,
  activeConnections,
  orderProcessingDuration,
  ordersTotal,
  createLogger,
  initJaegerTracer,
  metricsMiddleware,
  tracingMiddleware,
  loggingMiddleware,
};
