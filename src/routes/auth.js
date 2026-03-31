const express = require("express");
const passport = require("passport");

const router = express.Router();

const frontBaseUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${frontBaseUrl}?login=failed` }),
  (_req, res) => {
    res.redirect(frontBaseUrl);
  }
);

router.get("/me", (req, res) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ authenticated: false });
  }

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

router.post("/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

module.exports = router;
