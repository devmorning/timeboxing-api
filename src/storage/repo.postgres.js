const { pool } = require("./pool");

function createEmptyDayPlan() {
  return {
    important3: ["", "", ""],
    brainDump: "",
    items: [],
  };
}

function createPostgresDayPlansRepo() {
  return {
    async getByDate(userId, dateYmd) {
      const client = await pool.connect();
      try {
        const planRes = await client.query(
          `
          SELECT id, important1, important2, important3, brain_dump
          FROM day_plans
          WHERE user_id = $1 AND plan_date = $2::date
          `,
          [userId, dateYmd]
        );

        const row = planRes.rows[0];
        if (!row) return createEmptyDayPlan();

        const itemsRes = await client.query(
          `
          SELECT id, time, content, done
          FROM day_plan_items
          WHERE day_plan_id = $1
          ORDER BY time ASC, created_at ASC
          `,
          [row.id]
        );

        return {
          important3: [row.important1 ?? "", row.important2 ?? "", row.important3 ?? ""],
          brainDump: row.brain_dump ?? "",
          items: itemsRes.rows.map((it) => ({
            id: it.id,
            time: it.time,
            content: it.content,
            done: Boolean(it.done),
          })),
        };
      } finally {
        client.release();
      }
    },

    async saveByDate(userId, dateYmd, plan) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const important3 = Array.isArray(plan.important3) ? plan.important3 : ["", "", ""];
        const [i1, i2, i3] = important3.slice(0, 3).map((v) => (typeof v === "string" ? v : ""));
        const brainDump = typeof plan.brainDump === "string" ? plan.brainDump : "";
        const items = Array.isArray(plan.items) ? plan.items : [];

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

        const dayPlanId = upsertPlan.rows[0].id;
        await client.query("DELETE FROM day_plan_items WHERE day_plan_id = $1", [dayPlanId]);

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
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listMarkedDatesInMonth(userId, year, month) {
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

      return res.rows.map((row) => row.plan_date.toISOString().slice(0, 10));
    },

    async listMarkedDatesInRange(userId, startYmd, endYmd) {
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

      return res.rows.map((row) => row.plan_date.toISOString().slice(0, 10));
    },
  };
}

module.exports = { createPostgresDayPlansRepo };
