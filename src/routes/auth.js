const express = require("express");
const passport = require("passport");
const { createAccessToken, getBearerToken, verifyAccessToken } = require("../auth/token");
const { createDayPlansRepo } = require("../storage/repo");

const router = express.Router();
const repo = createDayPlansRepo();

const frontBaseUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

function isValidYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function logRouteTiming(name, startedAt, meta = {}) {
  // eslint-disable-next-line no-console
  console.log("[route:auth]", {
    name,
    elapsedMs: Date.now() - startedAt,
    ...meta,
  });
}

function getAuthUser(req) {
  const token = getBearerToken(req);
  const payload = verifyAccessToken(token);
  if (!payload?.sub) return null;

  return {
    id: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
    avatarUrl: payload.avatarUrl ?? null,
  };
}

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${frontBaseUrl}?login=failed`,
    session: false,
  }),
  (req, res) => {
    const token = createAccessToken(req.user);
    res.redirect(`${frontBaseUrl}?token=${encodeURIComponent(token)}`);
  }
);

router.get("/me", (req, res) => {
  const startedAt = Date.now();
  const user = getAuthUser(req);

  if (!user) {
    logRouteTiming("GET /auth/me", startedAt, { authenticated: false, status: 401 });
    return res.status(401).json({ authenticated: false });
  }

  logRouteTiming("GET /auth/me", startedAt, { authenticated: true, status: 200 });
  res.json({
    authenticated: true,
    user,
  });
});

router.get("/bootstrap", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const user = getAuthUser(req);

    if (!user?.id) {
      logRouteTiming("GET /auth/bootstrap", startedAt, {
        authenticated: false,
        status: 200,
        dateYmd: req.query.dateYmd ?? null,
      });
      return res.status(200).json({
        authenticated: false,
        user: null,
        plan: null,
      });
    }

    const dateYmd = isValidYmd(req.query.dateYmd) ? req.query.dateYmd : null;
    const plan = dateYmd ? await repo.getByDate(user.id, dateYmd) : null;

    logRouteTiming("GET /auth/bootstrap", startedAt, {
      authenticated: true,
      status: 200,
      dateYmd,
    });
    return res.status(200).json({
      authenticated: true,
      user,
      plan,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  const startedAt = Date.now();
  logRouteTiming("POST /auth/logout", startedAt, { status: 200 });
  res.json({ ok: true });
});

module.exports = router;
