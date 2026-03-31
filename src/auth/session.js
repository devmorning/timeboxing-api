const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const { getPool } = require("../storage/pool");
const { hasPostgresConfig } = require("../lib/pgConfig");

function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const crossSiteCookie = process.env.SESSION_COOKIE_SAMESITE === "none" || isProd;

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: crossSiteCookie ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  };
}

function createSessionMiddleware() {
  const PgStore = connectPgSimple(session);
  let store;

  if (hasPostgresConfig()) {
    try {
      store = new PgStore({
        pool: getPool(),
        tableName: "user_sessions",
        createTableIfMissing: true,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[session] PostgreSQL session store 초기화 실패, 메모리 스토어로 대체합니다.", error);
    }
  }

  return session({
    secret: process.env.SESSION_SECRET || "timeboxing-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: getSessionCookieOptions(),
    store,
  });
}

module.exports = { createSessionMiddleware, getSessionCookieOptions };
