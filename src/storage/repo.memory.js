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
      store.set(keyOf(userId, dateYmd), normalizePlan(plan));
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
