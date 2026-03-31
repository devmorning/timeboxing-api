const express = require("express");
const cors = require("cors");
const passport = require("passport");
const { getPool } = require("./storage/pool");
const { hasPostgresConfig } = require("./lib/pgConfig");
const { createSessionMiddleware } = require("./auth/session");
const { configurePassport } = require("./auth/passport");
const authRouter = require("./routes/auth");
const dayPlansRouter = require("./routes/dayPlans");

configurePassport();

async function pingPostgresOnce() {
  const pool = getPool();
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
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0b1020;
        color: #e5e7eb;
      }
      main {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 40px 20px;
      }
      .shell {
        width: 100%;
        max-width: 920px;
      }
      .hero {
        margin-bottom: 24px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 32px;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: #94a3b8;
      }
      .eyebrow {
        display: inline-block;
        margin-bottom: 12px;
        color: #60a5fa;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .section {
        margin-top: 24px;
        border: 1px solid #1f2937;
        border-radius: 14px;
        background: #111827;
        overflow: hidden;
      }
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
        border-bottom: 1px solid #1f2937;
        background: #0f172a;
      }
      .section-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #f8fafc;
      }
      .section-subtitle {
        font-size: 13px;
        color: #64748b;
      }
      .endpoint {
        display: grid;
        grid-template-columns: 88px minmax(0, 1fr) minmax(180px, 220px);
        gap: 16px;
        padding: 16px 18px;
        border-top: 1px solid #1f2937;
      }
      .endpoint:first-of-type {
        border-top: 0;
      }
      .method {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 28px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .method-get {
        background: rgba(16, 185, 129, 0.14);
        color: #6ee7b7;
        border: 1px solid rgba(16, 185, 129, 0.28);
      }
      .method-post {
        background: rgba(96, 165, 250, 0.14);
        color: #93c5fd;
        border: 1px solid rgba(96, 165, 250, 0.28);
      }
      .method-put {
        background: rgba(245, 158, 11, 0.14);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.28);
      }
      .path {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
        color: #e2e8f0;
        word-break: break-word;
      }
      .description {
        font-size: 14px;
        color: #94a3b8;
      }
      .meta {
        margin-top: 24px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .meta-card {
        border: 1px solid #1f2937;
        border-radius: 14px;
        background: #111827;
        padding: 16px 18px;
      }
      .meta-card h2 {
        margin: 0 0 10px;
        font-size: 14px;
        color: #f8fafc;
      }
      .meta-card p,
      .meta-card li {
        font-size: 14px;
        color: #94a3b8;
      }
      .meta-card ul {
        margin: 0;
        padding-left: 18px;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: #0f172a;
        color: #cbd5e1;
        padding: 2px 6px;
        border: 1px solid #1f2937;
        border-radius: 8px;
      }
      @media (max-width: 768px) {
        main {
          padding: 24px 14px;
        }
        h1 {
          font-size: 28px;
        }
        .endpoint {
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .meta {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="shell">
        <div class="hero">
          <div class="eyebrow">API Docs</div>
          <h1>timeboxing-api</h1>
          <p>Timeboxing 프론트엔드가 사용하는 세션 기반 Node API 서버입니다.</p>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Endpoints</h2>
            <div class="section-subtitle">Health, auth, day plans</div>
          </div>

          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/</div>
            <div class="description">API 문서형 루트 페이지</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/healthz</div>
            <div class="description">서버 상태 확인</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/healthz/db</div>
            <div class="description">DB 연결 상태 확인</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/auth/google</div>
            <div class="description">Google 로그인 시작</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/auth/me</div>
            <div class="description">현재 로그인 사용자 확인</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-post">POST</span></div>
            <div class="path">/auth/logout</div>
            <div class="description">현재 세션 로그아웃</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/api/day-plans/:dateYmd</div>
            <div class="description">날짜별 계획 조회</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-put">PUT</span></div>
            <div class="path">/api/day-plans/:dateYmd</div>
            <div class="description">날짜별 계획 저장</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/api/day-plans/marked/month?year=YYYY&amp;month=MM</div>
            <div class="description">월 단위 마킹 날짜 조회</div>
          </div>
          <div class="endpoint">
            <div><span class="method method-get">GET</span></div>
            <div class="path">/api/day-plans/marked/range?startYmd=YYYY-MM-DD&amp;endYmd=YYYY-MM-DD</div>
            <div class="description">기간별 마킹 날짜 조회</div>
          </div>
        </div>

        <div class="meta">
          <section class="meta-card">
            <h2>Auth</h2>
            <p>Google OAuth 로그인 후 <code>connect.sid</code> 세션 쿠키 기반으로 인증합니다.</p>
          </section>
          <section class="meta-card">
            <h2>Notes</h2>
            <ul>
              <li><code>CORS_ORIGIN</code> 에 프론트 도메인이 포함되어야 합니다.</li>
              <li><code>/healthz/db</code> 로 PostgreSQL 연결 상태를 빠르게 확인할 수 있습니다.</li>
            </ul>
          </section>
        </div>
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

const app = createServer();

module.exports = app;
module.exports.createServer = createServer;
