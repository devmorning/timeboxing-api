const express = require("express");
const { z } = require("zod");
const { createDayPlansRepo } = require("../storage/repo");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
const repo = createDayPlansRepo();

const YmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const DayPlanItemSchema = z.object({
  id: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .or(z.literal(""))
    .optional()
    .default(""),
  content: z.string().default(""),
  done: z.boolean().optional().default(false),
  executedSeconds: z.number().int().nonnegative().optional().default(0),
});

const DayPlanSchema = z.object({
  important3: z.array(z.string()).length(3).default(["", "", ""]),
  brainDump: z.string().default(""),
  items: z.array(DayPlanItemSchema).default([]),
});

function logRouteTiming(name, startedAt, meta = {}) {
  // eslint-disable-next-line no-console
  console.log("[route:day-plans]", {
    name,
    elapsedMs: Date.now() - startedAt,
    ...meta,
  });
}

router.use(requireAuth);

router.get("/marked/month", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Invalid year/month" });
    }

    const dates = await repo.listMarkedDatesInMonth(req.user.id, year, month);
    logRouteTiming("GET /api/day-plans/marked/month", startedAt, {
      status: 200,
      year,
      month,
      count: dates.length,
    });
    res.json({ dates });
  } catch (error) {
    next(error);
  }
});

router.get("/marked/range", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const startYmd = YmdSchema.parse(req.query.startYmd);
    const endYmd = YmdSchema.parse(req.query.endYmd);
    if (startYmd > endYmd) return res.status(400).json({ error: "Invalid range" });

    const dates = await repo.listMarkedDatesInRange(req.user.id, startYmd, endYmd);
    logRouteTiming("GET /api/day-plans/marked/range", startedAt, {
      status: 200,
      startYmd,
      endYmd,
      count: dates.length,
    });
    res.json({ dates });
  } catch (error) {
    next(error);
  }
});

router.get("/_meta", (_req, res) => {
  res.json({
    endpoints: {
      getByDate: "GET /api/day-plans/:dateYmd",
      saveByDate: "PUT /api/day-plans/:dateYmd",
      listMarkedDatesInMonth: "GET /api/day-plans/marked/month?year=YYYY&month=MM",
      listMarkedDatesInRange:
        "GET /api/day-plans/marked/range?startYmd=YYYY-MM-DD&endYmd=YYYY-MM-DD",
    },
    auth: "Session cookie required",
  });
});

router.get("/:dateYmd", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const dateYmd = YmdSchema.parse(req.params.dateYmd);
    const plan = await repo.getByDate(req.user.id, dateYmd);
    logRouteTiming("GET /api/day-plans/:dateYmd", startedAt, {
      status: 200,
      dateYmd,
      itemCount: Array.isArray(plan?.items) ? plan.items.length : 0,
    });
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

router.put("/:dateYmd", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const dateYmd = YmdSchema.parse(req.params.dateYmd);
    const input = DayPlanSchema.parse(req.body ?? {});
    await repo.saveByDate(req.user.id, dateYmd, input);
    logRouteTiming("PUT /api/day-plans/:dateYmd", startedAt, {
      status: 200,
      dateYmd,
      itemCount: input.items.length,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
