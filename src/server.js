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

  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>timeboxing-api</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      main {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      section {
        width: 100%;
        max-width: 560px;
        background: #ffffff;
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0 0 10px;
        line-height: 1.6;
        color: #475569;
      }
      code {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 6px;
      }
      ul {
        margin: 16px 0 0;
        padding-left: 18px;
        color: #334155;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>timeboxing-api</h1>
        <p>Timeboxing 프론트엔드가 사용하는 Node 기반 API 서버입니다.</p>
        <p>상태 확인은 <code>/healthz</code>, DB 연결 확인은 <code>/healthz/db</code> 에서 할 수 있습니다.</p>
        <ul>
          <li><code>/auth/google</code>: Google 로그인 시작</li>
          <li><code>/auth/me</code>: 현재 로그인 사용자 확인</li>
          <li><code>/api/day-plans/:dateYmd</code>: 날짜별 계획 조회/저장</li>
        </ul>
      </section>
    </main>
  </body>
</html>`);
  });

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
