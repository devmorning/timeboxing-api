function requireAuth(req, res, next) {
  if (req.isAuthenticated?.() && req.user?.id) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

module.exports = { requireAuth };
