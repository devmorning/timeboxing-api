const express = require("express");
const { z } = require("zod");
const { createDayPlansRepo } = require("../storage/repo");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
const repo = createDayPlansRepo();

const YmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function parseHHMMToSeconds(hhmm) {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 3600 + min * 60;
}

function durationSeconds(startTime, endTime) {
  const st = parseHHMMToSeconds(startTime);
  const et = parseHHMMToSeconds(endTime);
  if (st == null || et == null) return null;
  let d = et - st;
  if (d <= 0) d += 86400;
  return d;
}

function summarizePlan(plan, dateYmd) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  let totalPlanned = 0;
  let totalExecuted = 0;
  let withEnd = 0;
  for (const it of items) {
    const planned = durationSeconds(it?.startTime || "09:00", it?.endTime || "");
    if (planned != null) {
      totalPlanned += planned;
      withEnd += 1;
    }
    totalExecuted += Math.max(0, Math.floor(it?.executedSeconds || 0));
  }
  return {
    dateYmd,
    important3: Array.isArray(plan?.important3) ? plan.important3 : ["", "", ""],
    brainDump: typeof plan?.brainDump === "string" ? plan.brainDump : "",
    items: items.map((it) => ({
      startTime: it?.startTime || "09:00",
      endTime: it?.endTime || "",
      content: it?.content || "",
      executedSeconds: Math.max(0, Math.floor(it?.executedSeconds || 0)),
    })),
    totalPlannedSeconds: totalPlanned,
    totalExecutedSeconds: totalExecuted,
    endedItemsCount: withEnd,
  };
}

function fallbackFeedback(summary) {
  const planned = summary.totalPlannedSeconds;
  const executed = summary.totalExecutedSeconds;
  const ratio = planned > 0 ? (executed / planned) * 100 : null;
  const strengths = [];
  const risks = [];
  const actions = [];

  if (summary.items.length >= 3) strengths.push("하루 계획을 여러 블록으로 나눠 구성한 점이 좋아요.");
  if ((summary.brainDump || "").trim().length > 0) strengths.push("브레인 덤프가 있어 누락 리스크를 줄였어요.");
  if (ratio != null && ratio >= 70) strengths.push("계획 대비 실행률이 높은 편이에요.");

  if (ratio == null) risks.push("종료 시간이 없는 일정이 많아 계획 대비 분석 정확도가 낮아요.");
  if (ratio != null && ratio < 50) risks.push("실행 시간이 계획 대비 크게 부족해 과계획 가능성이 보여요.");
  if (summary.items.some((it) => (it.content || "").trim().length < 2)) {
    risks.push("일부 일정 내용이 짧아 실행 단위가 모호할 수 있어요.");
  }

  actions.push("내일은 상위 1~2개 핵심 일정만 먼저 고정하고 나머지는 여유 슬롯으로 두세요.");
  actions.push("종료 시간을 비워둔 일정은 최소 30~60분 범위라도 먼저 지정해 보세요.");
  actions.push("실행률이 낮은 블록은 시간을 절반으로 쪼개 재배치해 보세요.");

  return {
    mode: "fallback",
    summary: ratio == null
      ? "종료 시간이 부족해 정밀 분석은 제한적이지만, 일정 구조 개선 여지가 있습니다."
      : `계획 대비 실행률은 ${ratio.toFixed(1)}%로 집계되었습니다.`,
    strengths,
    risks,
    actions,
  };
}

async function maybeCallLlm(prompt) {
  const apiKey = process.env.AI_API_KEY || "";
  if (!apiKey) return null;
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "당신은 타임박싱 코치입니다. 반드시 JSON만 반환하세요. 키는 summary, strengths, risks, actions만 사용하세요.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function sanitizeAiFeedback(raw) {
  const asArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : []);
  const summary = typeof raw?.summary === "string" ? raw.summary : "";
  const strengths = asArray(raw?.strengths);
  const risks = asArray(raw?.risks);
  const actions = asArray(raw?.actions);
  if (!summary && !strengths.length && !risks.length && !actions.length) return null;
  return { summary, strengths, risks, actions };
}

function fallbackGeneratePlan(recentSummaries, targetDateYmd) {
  const contentFreq = new Map();
  for (const day of recentSummaries) {
    for (const it of day.items) {
      const key = (it.content || "").trim();
      if (!key) continue;
      contentFreq.set(key, (contentFreq.get(key) || 0) + 1);
    }
  }
  const top = [...contentFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const items = top.map((content, idx) => ({
    startTime: ["09:00", "11:00", "14:00"][idx] || "16:00",
    endTime: ["10:00", "12:00", "15:00"][idx] || "17:00",
    content,
  }));
  return {
    mode: "fallback",
    targetDateYmd,
    important3: top.length ? top : ["핵심 업무 1", "핵심 업무 2", "핵심 업무 3"],
    brainDump: "",
    items,
    rationale: "최근 자주 수행한 내용을 기반으로 초안을 생성했습니다.",
  };
}

router.use(requireAuth);

router.post("/feedback/day", async (req, res, next) => {
  try {
    const dateYmd = YmdSchema.parse(req.body?.dateYmd);
    const plan = await repo.getByDate(req.user.id, dateYmd);
    const summary = summarizePlan(plan, dateYmd);

    const llm = await maybeCallLlm(
      `다음 하루 데이터를 분석해 피드백을 만들어줘: ${JSON.stringify(summary)}`
    );
    const sanitized = sanitizeAiFeedback(llm);
    const feedback = sanitized || fallbackFeedback(summary);
    res.json({ ok: true, feedback });
  } catch (error) {
    next(error);
  }
});

router.post("/plan/suggest", async (req, res, next) => {
  try {
    const targetDateYmd = YmdSchema.parse(req.body?.targetDateYmd);
    const lookbackDays = Math.min(28, Math.max(3, Number(req.body?.lookbackDays) || 7));
    const [y, m, d] = targetDateYmd.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const start = new Date(target);
    start.setDate(start.getDate() - lookbackDays);
    const startYmd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const endYmd = targetDateYmd;
    const range = await repo.getPlansByDateRangeInclusive(req.user.id, startYmd, endYmd);
    const recentSummaries = Object.entries(range || {})
      .filter(([ymd]) => ymd < targetDateYmd)
      .map(([ymd, plan]) => summarizePlan(plan, ymd))
      .filter((day) => day.items.length > 0);

    const llm = await maybeCallLlm(
      `다음 최근 데이터로 ${targetDateYmd}의 초안 계획을 만들어줘. JSON 키는 important3(길이3), brainDump, items([{startTime,endTime,content}]), rationale: ${JSON.stringify(
        recentSummaries
      )}`
    );

    const suggestion =
      llm &&
      Array.isArray(llm?.important3) &&
      Array.isArray(llm?.items) &&
      llm.important3.length === 3
        ? {
            mode: "llm",
            targetDateYmd,
            important3: llm.important3.map((x) => (typeof x === "string" ? x : "")).slice(0, 3),
            brainDump: typeof llm?.brainDump === "string" ? llm.brainDump : "",
            items: llm.items
              .map((it) => ({
                startTime: typeof it?.startTime === "string" ? it.startTime : "09:00",
                endTime: typeof it?.endTime === "string" ? it.endTime : "",
                content: typeof it?.content === "string" ? it.content : "",
              }))
              .filter((it) => it.content.trim().length > 0)
              .slice(0, 8),
            rationale: typeof llm?.rationale === "string" ? llm.rationale : "",
          }
        : fallbackGeneratePlan(recentSummaries, targetDateYmd);

    res.json({ ok: true, suggestion });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

