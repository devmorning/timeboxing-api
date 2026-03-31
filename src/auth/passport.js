const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { pool } = require("../storage/pool");

function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query(
        `SELECT id, email, name, avatar_url AS "avatarUrl" FROM users WHERE id = $1`,
        [id]
      );
      done(null, result.rows[0] ?? false);
    } catch (error) {
      done(error);
    }
  });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    // eslint-disable-next-line no-console
    console.warn("[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 가 없어 Google OAuth 를 비활성화합니다.");
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || "http://localhost/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleSub = profile.id;
          const email = profile.emails?.[0]?.value ?? null;
          const name = profile.displayName ?? "Google User";
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          const result = await pool.query(
            `
            INSERT INTO users(google_sub, email, name, avatar_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4, now(), now())
            ON CONFLICT (google_sub) DO UPDATE SET
              email = EXCLUDED.email,
              name = EXCLUDED.name,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = now()
            RETURNING id, email, name, avatar_url AS "avatarUrl"
            `,
            [googleSub, email, name, avatarUrl]
          );

          done(null, result.rows[0]);
        } catch (error) {
          done(error);
        }
      }
    )
  );

  return passport;
}

module.exports = { configurePassport };
