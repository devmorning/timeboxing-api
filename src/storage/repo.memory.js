function createEmptyDayPlan() {
  return {
    important3: ["", "", ""],
    brainDump: "",
    items: [],
  };
}

function normalizePlan(plan) {
  const base = createEmptyDayPlan();
  if (!plan || typeof plan !== "object") return base;

  const important3 = Array.isArray(plan.important3)
    ? plan.important3.slice(0, 3).map((v) => (typeof v === "string" ? v : ""))
    : base.important3;
  while (important3.length < 3) important3.push("");

  const brainDump = typeof plan.brainDump === "string" ? plan.brainDump : "";
  const items = Array.isArray(plan.items)
    ? plan.items
        .filter((it) => it && typeof it === "object")
        .map((it) => ({
          id: typeof it.id === "string" ? it.id : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          startTime:
            typeof it.startTime === "string"
              ? it.startTime
              : typeof it.time === "string"
                ? it.time
                : "09:00",
          endTime: typeof it.endTime === "string" ? it.endTime : "",
          content: typeof it.content === "string" ? it.content : "",
          done: typeof it.done === "boolean" ? it.done : false,
          executedSeconds:
            typeof it.executedSeconds === "number" && Number.isFinite(it.executedSeconds)
              ? Math.max(0, Math.floor(it.executedSeconds))
              : 0,
          executionStartedAt:
            typeof it.executionStartedAt === "string" && it.executionStartedAt.length > 0
              ? it.executionStartedAt
              : null,
        }))
        .filter((it) => it.content.trim().length > 0)
    : [];

  return { important3, brainDump, items };
}

function hasContent(plan) {
  return (
    plan.items.length > 0 ||
    plan.brainDump.trim().length > 0 ||
    plan.important3.some((v) => v.trim().length > 0)
  );
}

function keyOf(userId, dateYmd) {
  return `${userId}:${dateYmd}`;
}

function createMemoryDayPlansRepo() {
  const store = new Map();
  return {
    async getByDate(userId, dateYmd) {
      return normalizePlan(store.get(keyOf(userId, dateYmd)));
    },
    async saveByDate(userId, dateYmd, plan) {
      const prev = normalizePlan(store.get(keyOf(userId, dateYmd)));
      const next = normalizePlan(plan);
      const execById = new Map();
      for (const it of prev.items) {
        if (it.executionStartedAt) execById.set(it.id, it.executionStartedAt);
      }
      const merged = {
        ...next,
        items: next.items.map((it) => ({
          ...it,
          executionStartedAt: execById.get(it.id) ?? it.executionStartedAt ?? null,
        })),
      };
      store.set(keyOf(userId, dateYmd), normalizePlan(merged));
    },

    async startExecution(userId, dateYmd, itemId) {
      const k = keyOf(userId, dateYmd);
      const plan = normalizePlan(store.get(k));
      const nowIso = new Date().toISOString();
      const others = plan.items.map((it) => {
        if (it.id === itemId) return it;
        if (!it.executionStartedAt) return it;
        const started = Date.parse(it.executionStartedAt);
        const add = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
        return {
          ...it,
          executedSeconds: (it.executedSeconds ?? 0) + add,
          executionStartedAt: null,
          done: false,
        };
      });
      let found = false;
      const items = others.map((it) => {
        if (it.id !== itemId) return it;
        found = true;
        return { ...it, executionStartedAt: nowIso, done: true };
      });
      if (!found) {
        const err = new Error("Item not found");
        err.status = 404;
        throw err;
      }
      store.set(k, normalizePlan({ ...plan, items }));
      const target = items.find((it) => it.id === itemId);
      return {
        id: target.id,
        executedSeconds: target.executedSeconds ?? 0,
        executionStartedAt: target.executionStartedAt,
        done: target.done,
      };
    },

    async stopExecution(userId, dateYmd, itemId) {
      const k = keyOf(userId, dateYmd);
      const plan = normalizePlan(store.get(k));
      const orig = plan.items.find((it) => it.id === itemId);
      if (!orig) {
        const err = new Error("Item not found");
        err.status = 404;
        throw err;
      }
      if (!orig.executionStartedAt) {
        const err = new Error("Not running");
        err.status = 409;
        throw err;
      }
      const started = Date.parse(orig.executionStartedAt);
      const add = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
      const items = plan.items.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          executedSeconds: (it.executedSeconds ?? 0) + add,
          executionStartedAt: null,
          done: false,
        };
      });
      const target = items.find((it) => it.id === itemId);
      store.set(k, normalizePlan({ ...plan, items }));
      return {
        id: target.id,
        executedSeconds: target.executedSeconds ?? 0,
        executionStartedAt: null,
        done: false,
      };
    },
    async listMarkedDatesInMonth(userId, year, month) {
      const mm = String(month).padStart(2, "0");
      const prefix = `${userId}:${year}-${mm}-`;
      const dates = [];
      for (const [k, v] of store.entries()) {
        if (!k.startsWith(prefix)) continue;
        const plan = normalizePlan(v);
        if (hasContent(plan)) {
          dates.push(k.split(":")[1]);
        }
      }
      dates.sort();
      return dates;
    },
    async listMarkedDatesInRange(userId, startYmd, endYmd) {
      const dates = [];
      for (const [k, v] of store.entries()) {
        const [uid, date] = k.split(":");
        if (uid !== userId) continue;
        if (date < startYmd || date > endYmd) continue;
        const plan = normalizePlan(v);
        if (hasContent(plan)) dates.push(date);
      }
      dates.sort();
      return dates;
    },
  };
}

module.exports = { createMemoryDayPlansRepo };
