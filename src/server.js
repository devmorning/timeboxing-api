const express = require("express");
const cors = require("cors");
const passport = require("passport");
const { pool } = require("./storage/pool");
const { hasPostgresConfig } = require("./lib/pgConfig");
const { createSessionMiddleware } = require("./auth/session");
const { configurePassport } = require("./auth/passport");
const authRouter = require("./routes/auth");
const dayPlansRouter = require("./routes/dayPlans");

configurePassport();

async function pingPostgresOnce() {
  const r = await pool.query("SELECT 1 AS ok");
  return { ok: true, row: r.rows[0] };
}

function createCorsOptions() {
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
        return callback(null, origin);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "PUT", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };
}

function createServer() {
  const app = express();
  const corsOptions = createCorsOptions();

  app.use(cors(corsOptions));
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      return cors(corsOptions)(req, res, next);
    }
    return next();
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(createSessionMiddleware());
  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  app.get("/healthz/db", async (_req, res) => {
    if (!hasPostgresConfig()) {
      return res.status(200).json({
        ok: true,
        mode: "memory",
        message: "No PostgreSQL env configured",
      });
    }
    try {
      const result = await pingPostgresOnce();
      return res.status(200).json({ ok: true, mode: "postgres", ...result });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        mode: "postgres",
        error: error?.message || String(error),
      });
    }
  });

  app.use("/auth", authRouter);
  app.use("/api/day-plans", dayPlansRouter);

  app.use((error, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error("[api] unhandled error", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}

module.exports = { createServer };
