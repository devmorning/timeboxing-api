const crypto = require("crypto");

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET || process.env.SESSION_SECRET || "timeboxing-dev-token-secret";
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getTokenSecret())
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createAccessToken(user) {
  const payload = JSON.stringify({
    sub: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyAccessToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (!payload?.sub || !payload?.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (_error) {
    return null;
  }
}

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

module.exports = {
  createAccessToken,
  verifyAccessToken,
  getBearerToken,
  TOKEN_TTL_MS,
};
