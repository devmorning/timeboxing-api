const express = require("express");
const cors = require("cors");
const passport = require("passport");
const { getPool } = require("./storage/pool");
const { hasPostgresConfig } = require("./lib/pgConfig");
const { createSessionMiddleware } = require("./auth/session");
const { configurePassport } = require("./auth/passport");
const authRouter = require("./routes/auth");
const dayPlansRouter = require("./routes/dayPlans");
const repeatingTemplatesRouter = require("./routes/repeatingTemplates");

configurePassport();

async function pingPostgresOnce() {
  const pool = getPool();
  const r = await pool.query("SELECT 1 AS ok");
  return { ok: true, row: r.rows[0] };
}

function buildAllowedOrigins() {
  const values = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://timeboxplanner.vercel.app",
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [...new Set(values)];
}

function createCorsOptions() {
  const allowedOrigins = buildAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, normalizedOrigin);
      }

      // eslint-disable-next-line no-console
      console.error("[cors] blocked origin", {
        origin: normalizedOrigin,
        allowedOrigins,
      });
      return callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
    },
    credentials: true,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
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
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.035), transparent 24%),
          linear-gradient(180deg, #0a0a0b 0%, #0d0d10 100%);
        color: #f3f4f6;
      }
      main {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 64px 24px;
      }
      .shell {
        width: 100%;
        max-width: 980px;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 220px;
        gap: 16px;
        align-items: end;
        margin-bottom: 24px;
      }
      .hero-panel {
        padding: 32px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(18, 18, 21, 0.94);
      }
      .hero-side {
        padding: 22px 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(18, 18, 21, 0.94);
      }
      h1 {
        margin: 0 0 14px;
        font-size: 44px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: -0.05em;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: #a1a1aa;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .eyebrow::before {
        content: "";
        width: 14px;
        height: 1px;
        background: rgba(255, 255, 255, 0.35);
      }
      .hero-copy {
        max-width: 620px;
        font-size: 16px;
      }
      .hero-kicker {
        margin-top: 22px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 7px 11px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #101013;
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.01em;
      }
      .hero-side-label {
        margin: 0 0 10px;
        font-size: 12px;
        color: #d4d4d8;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .hero-side code {
        display: inline-block;
        margin-bottom: 14px;
      }
      .hero-side p {
        font-size: 13px;
        line-height: 1.6;
      }
      .section {
        margin-top: 24px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(18, 18, 21, 0.94);
        overflow: hidden;
      }
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: #111114;
      }
      .section-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #fafafa;
      }
      .section-subtitle {
        font-size: 13px;
        color: #71717a;
      }
      .endpoint {
        display: grid;
        grid-template-columns: 92px minmax(0, 1.25fr) minmax(220px, 0.75fr);
        gap: 18px;
        align-items: center;
        padding: 18px 22px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .endpoint:first-of-type {
        border-top: 0;
      }
      .endpoint:hover {
        background: rgba(255, 255, 255, 0.018);
      }
      .method {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 28px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
      }
      .method-get {
        background: rgba(255, 255, 255, 0.04);
        color: #e4e4e7;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .method-post {
        background: rgba(255, 255, 255, 0.04);
        color: #e4e4e7;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .method-put {
        background: rgba(255, 255, 255, 0.04);
        color: #e4e4e7;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .path {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 14px;
        color: #f4f4f5;
        word-break: break-word;
      }
      .description {
        font-size: 14px;
        color: #a1a1aa;
      }
      .meta {
        margin-top: 24px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .meta-card {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(18, 18, 21, 0.94);
        padding: 20px 22px;
      }
      .meta-card h2 {
        margin: 0 0 12px;
        font-size: 15px;
        color: #fafafa;
      }
      .meta-card p,
      .meta-card li {
        font-size: 14px;
        color: #a1a1aa;
      }
      .meta-card ul {
        margin: 0;
        padding-left: 18px;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: #101013;
        color: #f4f4f5;
        padding: 3px 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
      }
      .footer-note {
        margin-top: 14px;
        font-size: 12px;
        color: #71717a;
      }
      @media (max-width: 768px) {
        main {
          padding: 28px 14px;
        }
        h1 {
          font-size: 34px;
        }
        .hero {
          grid-template-columns: 1fr;
        }
        .hero-panel,
        .hero-side {
          padding: 24px 18px;
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
          <div class="hero-panel">
            <div class="eyebrow">API Docs</div>
            <h1>timeboxing-api</h1>
            <p class="hero-copy">Timeboxing 프론트엔드가 사용하는 세션 기반 Node API 서버입니다. 상태 확인, Google 인증, 날짜별 플랜 저장 API를 간결하게 제공합니다.</p>
            <div class="hero-kicker">
              <span class="pill">Session Auth</span>
              <span class="pill">PostgreSQL</span>
              <span class="pill">Serverless Ready</span>
            </div>
          </div>
          <aside class="hero-side">
            <div class="hero-side-label">Base URL</div>
            <code>timeboxing-api.vercel.app</code>
            <p>루트 페이지는 빠른 확인용 문서 역할을 하고, 실제 응답 검증은 <code>/healthz</code> 와 <code>/healthz/db</code> 에서 진행합니다.</p>
          </aside>
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
        <div class="footer-note">Minimal surface, developer-first navigation, readable defaults.</div>
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
  app.use("/api/repeating-templates", repeatingTemplatesRouter);

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
