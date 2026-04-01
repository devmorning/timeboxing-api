const express = require("express");
const passport = require("passport");
const { getSessionCookieOptions } = require("../auth/session");
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

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${frontBaseUrl}?login=failed` }),
  (_req, res) => {
    res.redirect(frontBaseUrl);
  }
);

router.get("/me", (req, res) => {
  const startedAt = Date.now();
  if (!req.isAuthenticated?.() || !req.user) {
    logRouteTiming("GET /auth/me", startedAt, { authenticated: false, status: 401 });
    return res.status(401).json({ authenticated: false });
  }

  logRouteTiming("GET /auth/me", startedAt, { authenticated: true, status: 200 });
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email ?? null,
      name: req.user.name ?? null,
      avatarUrl: req.user.avatarUrl ?? null,
    },
  });
});

router.get("/bootstrap", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    if (!req.isAuthenticated?.() || !req.user?.id) {
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
    const plan = dateYmd ? await repo.getByDate(req.user.id, dateYmd) : null;

    logRouteTiming("GET /auth/bootstrap", startedAt, {
      authenticated: true,
      status: 200,
      dateYmd,
    });
    return res.status(200).json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email ?? null,
        name: req.user.name ?? null,
        avatarUrl: req.user.avatarUrl ?? null,
      },
      plan,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res, next) => {
  const startedAt = Date.now();
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie("connect.sid", getSessionCookieOptions());
      logRouteTiming("POST /auth/logout", startedAt, { status: 200 });
      res.json({ ok: true });
    });
  });
});

module.exports = router;
