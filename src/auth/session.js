const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const { pool } = require("../storage/pool");
const { hasPostgresConfig } = require("../lib/pgConfig");

function createSessionMiddleware() {
  const isProd = process.env.NODE_ENV === "production";
  const PgStore = connectPgSimple(session);

  return session({
    secret: process.env.SESSION_SECRET || "timeboxing-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    store: hasPostgresConfig()
      ? new PgStore({
          pool,
          tableName: "user_sessions",
          createTableIfMissing: true,
        })
      : undefined,
  });
}

module.exports = { createSessionMiddleware };
