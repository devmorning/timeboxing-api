const { getBearerToken, verifyAccessToken } = require("../auth/token");

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const payload = verifyAccessToken(token);

  if (!payload?.sub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = {
    id: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
    avatarUrl: payload.avatarUrl ?? null,
  };
  next();
}

module.exports = { requireAuth };
