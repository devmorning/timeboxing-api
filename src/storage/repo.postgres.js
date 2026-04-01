const { getPool } = require("./pool");

function createEmptyDayPlan() {
  return {
    important3: ["", "", ""],
    brainDump: "",
    items: [],
  };
}

function logRepoTiming(name, startedAt, meta = {}) {
  // eslint-disable-next-line no-console
  console.log("[repo:postgres]", {
    name,
    elapsedMs: Date.now() - startedAt,
    ...meta,
  });
}

function createPostgresDayPlansRepo() {
  return {
    async getByDate(userId, dateYmd) {
      const pool = getPool();
      const totalStartedAt = Date.now();
      const client = await pool.connect();
      try {
        const queryStartedAt = Date.now();
        const planRes = await client.query(
          `
          SELECT
            dp.id,
            dp.important1,
            dp.important2,
            dp.important3,
            dp.brain_dump,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', i.id,
                  'time', i.time,
                  'content', i.content,
                  'done', i.done
                )
                ORDER BY i.time ASC, i.created_at ASC
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM day_plans dp
          LEFT JOIN day_plan_items i
            ON i.day_plan_id = dp.id
          WHERE dp.user_id = $1 AND dp.plan_date = $2::date
          GROUP BY dp.id, dp.important1, dp.important2, dp.important3, dp.brain_dump
          `,
          [userId, dateYmd]
        );
        logRepoTiming("getByDate.singleQuery", queryStartedAt, { userId, dateYmd });

        const row = planRes.rows[0];
        if (!row) {
          logRepoTiming("getByDate.total", totalStartedAt, {
            userId,
            dateYmd,
            itemCount: 0,
            empty: true,
          });
          return createEmptyDayPlan();
        }

        const result = {
          important3: [row.important1 ?? "", row.important2 ?? "", row.important3 ?? ""],
          brainDump: row.brain_dump ?? "",
          items: Array.isArray(row.items)
            ? row.items.map((it) => ({
                id: it.id,
                time: it.time,
                content: it.content,
                done: Boolean(it.done),
              }))
            : [],
        };
        logRepoTiming("getByDate.total", totalStartedAt, {
          userId,
          dateYmd,
          itemCount: result.items.length,
          empty: false,
        });
        return result;
      } finally {
        client.release();
      }
    },

    async saveByDate(userId, dateYmd, plan) {
      const pool = getPool();
      const totalStartedAt = Date.now();
      const client = await pool.connect();
      try {
        const beginStartedAt = Date.now();
        await client.query("BEGIN");
        logRepoTiming("saveByDate.begin", beginStartedAt, { userId, dateYmd });

        const important3 = Array.isArray(plan.important3) ? plan.important3 : ["", "", ""];
        const [i1, i2, i3] = important3.slice(0, 3).map((v) => (typeof v === "string" ? v : ""));
        const brainDump = typeof plan.brainDump === "string" ? plan.brainDump : "";
        const items = Array.isArray(plan.items) ? plan.items : [];

        const upsertStartedAt = Date.now();
        const upsertPlan = await client.query(
          `
          INSERT INTO day_plans(user_id, plan_date, important1, important2, important3, brain_dump, updated_at)
          VALUES ($1, $2::date, $3, $4, $5, $6, now())
          ON CONFLICT (user_id, plan_date) DO UPDATE SET
            important1 = EXCLUDED.important1,
            important2 = EXCLUDED.important2,
            important3 = EXCLUDED.important3,
            brain_dump = EXCLUDED.brain_dump,
            updated_at = now()
          RETURNING id
          `,
          [userId, dateYmd, i1, i2, i3, brainDump]
        );
        logRepoTiming("saveByDate.upsertPlan", upsertStartedAt, { userId, dateYmd });

        const dayPlanId = upsertPlan.rows[0].id;
        const deleteStartedAt = Date.now();
        await client.query("DELETE FROM day_plan_items WHERE day_plan_id = $1", [dayPlanId]);
        logRepoTiming("saveByDate.deleteItems", deleteStartedAt, { userId, dateYmd });

        const insertStartedAt = Date.now();
        let insertedCount = 0;
        for (const item of items) {
          if (!item || typeof item !== "object" || typeof item.content !== "string") continue;
          if (item.content.trim().length === 0) continue;
          await client.query(
            `
            INSERT INTO day_plan_items(day_plan_id, time, content, done, created_at, updated_at)
            VALUES ($1, $2, $3, $4, now(), now())
            `,
            [
              dayPlanId,
              typeof item.time === "string" ? item.time : "09:00",
              item.content,
              typeof item.done === "boolean" ? item.done : false,
            ]
          );
          insertedCount += 1;
        }
        logRepoTiming("saveByDate.insertItems", insertStartedAt, {
          userId,
          dateYmd,
          insertedCount,
        });

        const commitStartedAt = Date.now();
        await client.query("COMMIT");
        logRepoTiming("saveByDate.commit", commitStartedAt, { userId, dateYmd });
        logRepoTiming("saveByDate.total", totalStartedAt, {
          userId,
          dateYmd,
          itemCount: insertedCount,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listMarkedDatesInMonth(userId, year, month) {
      const pool = getPool();
      const startedAt = Date.now();
      const mm = String(month).padStart(2, "0");
      const startYmd = `${year}-${mm}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const res = await pool.query(
        `
        SELECT dp.plan_date
        FROM day_plans dp
        WHERE dp.user_id = $1
          AND dp.plan_date >= $2::date
          AND dp.plan_date < $3::date
          AND (
            NULLIF(dp.important1, '') IS NOT NULL
            OR NULLIF(dp.important2, '') IS NOT NULL
            OR NULLIF(dp.important3, '') IS NOT NULL
            OR NULLIF(dp.brain_dump, '') IS NOT NULL
            OR EXISTS (
              SELECT 1
              FROM day_plan_items i
              WHERE i.day_plan_id = dp.id
                AND NULLIF(i.content, '') IS NOT NULL
            )
          )
        ORDER BY dp.plan_date ASC
        `,
        [userId, startYmd, endExclusive]
      );

      const dates = res.rows.map((row) => row.plan_date.toISOString().slice(0, 10));
      logRepoTiming("listMarkedDatesInMonth", startedAt, {
        userId,
        year,
        month,
        count: dates.length,
      });
      return dates;
    },

    async listMarkedDatesInRange(userId, startYmd, endYmd) {
      const pool = getPool();
      const startedAt = Date.now();
      const res = await pool.query(
        `
        SELECT dp.plan_date
        FROM day_plans dp
        WHERE dp.user_id = $1
          AND dp.plan_date >= $2::date
          AND dp.plan_date <= $3::date
          AND (
            NULLIF(dp.important1, '') IS NOT NULL
            OR NULLIF(dp.important2, '') IS NOT NULL
            OR NULLIF(dp.important3, '') IS NOT NULL
            OR NULLIF(dp.brain_dump, '') IS NOT NULL
            OR EXISTS (
              SELECT 1
              FROM day_plan_items i
              WHERE i.day_plan_id = dp.id
                AND NULLIF(i.content, '') IS NOT NULL
            )
          )
        ORDER BY dp.plan_date ASC
        `,
        [userId, startYmd, endYmd]
      );

      const dates = res.rows.map((row) => row.plan_date.toISOString().slice(0, 10));
      logRepoTiming("listMarkedDatesInRange", startedAt, {
        userId,
        startYmd,
        endYmd,
        count: dates.length,
      });
      return dates;
    },
  };
}

module.exports = { createPostgresDayPlansRepo };
