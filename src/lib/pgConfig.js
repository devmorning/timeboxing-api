let poolConfigLogged = false;

function getPgSslOption() {
  const url = process.env.DATABASE_URL || "";
  const wantSsl =
    process.env.PGSSL === "true" ||
    process.env.PGSSLMODE === "require" ||
    /sslmode=require/i.test(url);

  if (!wantSsl) return undefined;

  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED !== "false";
  return { rejectUnauthorized };
}

function hasDatabaseUrl() {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.trim().length > 0;
}

function hasPostgresConfig() {
  if (hasDatabaseUrl()) return true;
  return Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE);
}

function getPoolConfig() {
  const ssl = getPgSslOption();
  const usesUrl = hasDatabaseUrl();
  const port = usesUrl ? undefined : process.env.PGPORT ? Number(process.env.PGPORT) : 5432;

  if (!poolConfigLogged) {
    poolConfigLogged = true;
    // eslint-disable-next-line no-console
    console.log("[pg] getPoolConfig", {
      source: usesUrl ? "DATABASE_URL" : "PGHOST/PGUSER/PGDATABASE",
      host: usesUrl ? "(from URL)" : process.env.PGHOST ?? null,
      port: usesUrl ? "(from URL)" : port,
      database: usesUrl ? "(from URL)" : process.env.PGDATABASE ?? null,
      user: usesUrl ? "(from URL)" : process.env.PGUSER ?? null,
      ssl: ssl ? { enabled: true, rejectUnauthorized: ssl.rejectUnauthorized } : { enabled: false },
    });
  }

  if (usesUrl) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...(ssl ? { ssl } : {}),
    };
  }

  return {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    port,
    database: process.env.PGDATABASE,
    ...(ssl ? { ssl } : {}),
  };
}

module.exports = { getPoolConfig, hasPostgresConfig };
