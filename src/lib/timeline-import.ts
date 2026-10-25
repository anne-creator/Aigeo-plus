import { addDays, isYmd } from "./time";

export const TIMELINE_MAX_ITEMS = 200;
export const TIMELINE_MAX_TEXT = 100_000;
export const TIMELINE_FILE_LIMIT = 15 * 1024 * 1024;
export const TIMELINE_EXTENSIONS = ".docx,.pdf,.txt,.md,.csv,.tsv";

export interface TimelineDraftItem {
  title: string;
  dueDate: string | null;
  source: string;
  warning: string | null;
}

export interface TimelineImportResult {
  items: TimelineDraftItem[];
  warnings: string[];
  method: "ai" | "rules";
  fileName: string;
  sourceText: string;
}

export type TimelineContext = { startDate: string; endDate: string };
type DateHit = { date: string | null; raw: string; start: number; end: number; warning: string | null };
const pad = (n: number) => String(n).padStart(2, "0");
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 无年份日期只在服务周期中有唯一候选时推定，避免把旧日期误排到下一年。 */
function resolveDate(year: number | null, month: number, day: number, ctx: TimelineContext) {
  if (year !== null) {
    const date = year + "-" + pad(month) + "-" + pad(day);
    return { date: isYmd(date) ? date : null, warning: isYmd(date) ? null : "日期不存在，请修正" };
  }
  const candidates: string[] = [];
  for (let y = Number(ctx.startDate.slice(0, 4)); y <= Number(ctx.endDate.slice(0, 4)); y++) {
    const d = y + "-" + pad(month) + "-" + pad(day);
    if (isYmd(d) && d >= ctx.startDate && d <= ctx.endDate) candidates.push(d);
  }
  return candidates.length === 1
    ? { date: candidates[0], warning: "原文未写年份，已按服务周期补全，请核对" }
    : { date: null, warning: "原文未写年份，无法在服务周期中唯一确定，请补全日期" };
}

export function findTimelineDates(text: string, ctx: TimelineContext): DateHit[] {
  const hits: DateHit[] = [];
  const add = (m: RegExpMatchArray, value: { date: string | null; warning: string | null }) => {
    const start = m.index ?? 0;
    if (hits.some((h) => start < h.end && start + m[0].length > h.start)) return;
    hits.push({ ...value, raw: m[0], start, end: start + m[0].length });
  };
  for (const m of text.matchAll(/(?<!\d)(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})[日号]?(?!\d)/g)) {
    add(m, resolveDate(+m[1], +m[2], +m[3], ctx));
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  for (const m of text.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi)) {
    add(m, resolveDate(m[3] ? +m[3] : null, months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2], ctx));
  }
  for (const m of text.matchAll(/(?<![\d./v])(\d{1,2})\s*([-/.月])\s*(\d{1,2})[日号]?(?![\d.%])/gi)) {
    if (+m[1] > 12 || +m[1] < 1 || (m[2] === "." && /^\s*[篇条个万小时分]/.test(text.slice((m.index ?? 0) + m[0].length)))) continue;
    add(m, resolveDate(null, +m[1], +m[3], ctx));
  }
  for (const m of text.matchAll(/\bD\s*\+\s*(\d{1,3})\b/gi)) {
    add(m, { date: addDays(ctx.startDate, +m[1]), warning: "D+天数按项目开始日换算，请核对" });
  }
  for (const m of text.matchAll(/第\s*(\d{1,3})\s*天|\bDay\s+(\d{1,3})\b/gi)) {
    const day = +(m[1] || m[2]);
    add(m, { date: day > 0 ? addDays(ctx.startDate, day - 1) : null, warning: "第 1 天按项目开始日换算，请核对" });
  }
  return hits.sort((a, b) => a.start - b.start);
}

const titleHeader = /^(?:事项|节点|任务|事件|工作内容|内容|里程碑|交付物|活动|task|event|activity|milestone|deliverable|title)$/i;
const dateHeader = /^(?:(?:计划|预计|交付|发布|完成|截止|结束)(?:日期|时间)|日期|时间|date|due(?: date)?|deadline|publish(?: date)?|end(?: date)?)$/i;
const tidy = (s: string) => s.replace(/^[\s#>*•·\-–—]+/, "").replace(/^\d+[.)、）]\s+/, "").replace(/^[\s,，:：;；、|\-–—]+|[\s,，:：;；、|\-–—]+$/g, "").trim();

/** 保守的离线解析：不确定的日期留空，所有候选节点保留原文供人工核对。 */
export function parseTimelineDraft(text: string, ctx: TimelineContext): { items: TimelineDraftItem[]; warnings: string[] } {
  const items: TimelineDraftItem[] = [];
  const warnings: string[] = [];
  let columns: { title: number; date: number } | null = null;
  let sectionDate: DateHit | null = null;
  const lines = text.replace(/\r/g, "").split(/\n|[；;]/);
  for (const raw of lines) {
    const line = tidy(raw);
    if (!line || /^[-:|\s]+$/.test(line) || /^【第\s*\d+\s*页】$/.test(line)) continue;
    const cells = line.split(/\t|\s*\|\s*/).map((s) => s.trim());
    const ti = cells.findIndex((s) => titleHeader.test(s));
    const di = cells.findIndex((s) => dateHeader.test(s));
    if (cells.length > 1 && ti >= 0 && di >= 0) { columns = { title: ti, date: di }; sectionDate = null; continue; }
    const table = columns && cells.length > Math.max(columns.title, columns.date) ? columns : null;
    const dateText = table ? cells[table.date] : line;
    const hits = findTimelineDates(dateText, ctx);
    let title = table ? cells[table.title] : line;
    if (!table) {
      for (const h of [...hits].reverse()) title = title.slice(0, h.start) + " " + title.slice(h.end);
      title = tidy(title.replace(/(?:截止(?:日期|时间)?|计划日期|发布日期|交付日期|DDL|deadline|due)\s*[:：]?\s*/gi, "").replace(/\s+/g, " "));
    }
    if (!title && hits.length === 1) { sectionDate = hits[0]; continue; }
    if (!title || /^(?:项目计划|时间安排|timeline|schedule|节点|事项|日期|说明|备注)[:：]?$/i.test(title)) continue;
    if (/[:：]$/.test(line) && !hits.length && !table) { sectionDate = null; continue; }
    const chosen = hits.length === 1 ? hits[0] : !hits.length && !table ? sectionDate : null;
    const warning = hits.length > 1 ? "原文含多个日期，请选择此节点的交付日"
      : chosen?.warning || (!chosen ? "未识别到明确日期，请补全；非节点内容可删除" : !hits.length ? "沿用上方日期标题，请核对" : null);
    items.push({ title, dueDate: chosen?.date ?? null, source: raw.trim(), warning });
  }
  const clean = normalizeTimelineDraft(items, ctx);
  if (clean.length !== items.length) warnings.push("已合并完全相同的日期和事项，请对照原文检查是否有遗漏。");
  return { items: clean, warnings };
}

export function normalizeTimelineDraft(items: TimelineDraftItem[], ctx: TimelineContext): TimelineDraftItem[] {
  if (items.length > TIMELINE_MAX_ITEMS) throw new Error("识别结果超过 200 个节点，请拆分文件后导入。");
  const seen = new Set<string>();
  return items.filter((i) => i.title.trim()).map((item) => {
    let warning = item.warning;
    let dueDate = item.dueDate;
    if (dueDate && (!isYmd(dueDate) || dueDate < ctx.startDate)) {
      warning = "日期无效或早于项目开始日，请修正";
      dueDate = null;
    } else if (dueDate && dueDate > ctx.endDate) {
      warning = "日期晚于服务周期结束日，请核对";
    }
    if (item.title.length > 200) warning = "事项超过 200 字，请缩短后确认";
    return { title: item.title.trim(), dueDate, source: item.source, warning };
  }).filter((i) => {
    const key = norm(i.title) + "|" + (i.dueDate ?? "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** AI 必须给出能在文档中找到的依据；无法核实的节点清空日期、交由人工确认。 */
export function verifyTimelineEvidence(items: TimelineDraftItem[], sourceText: string): TimelineDraftItem[] {
  const document = norm(sourceText);
  return items.map((item) => item.source.trim() && document.includes(norm(item.source))
    ? item
    : { ...item, dueDate: null, warning: "未能在原文核实此节点的依据，请对照文件补全或删除" });
}

export function validateTimelineRows(dates: string[], titles: string[], startDate: string):
  { ok: true; items: Array<{ dueDate: string; title: string }> } | { ok: false; error: string } {
  if (dates.length !== titles.length) return { ok: false, error: "节点日期与事项数量不一致，请重新检查" };
  if (dates.length > TIMELINE_MAX_ITEMS) return { ok: false, error: "一份 timeline 最多 200 个节点" };
  const items: Array<{ dueDate: string; title: string }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < dates.length; i++) {
    const dueDate = dates[i].trim(), title = titles[i].trim();
    if (!dueDate && !title) continue;
    const prefix = "第 " + (i + 1) + " 行";
    if (!isYmd(dueDate)) return { ok: false, error: prefix + "请填写有效日期" };
    if (dueDate < startDate) return { ok: false, error: prefix + "日期早于项目开始日 " + startDate };
    if (!title || title.length > 200) return { ok: false, error: prefix + "事项须为 1–200 字" };
    const key = dueDate + "|" + norm(title);
    if (!seen.has(key)) items.push({ dueDate, title });
    seen.add(key);
  }
  if (!items.length) return { ok: false, error: "至少填写一个时间节点：日期 + 事项" };
  return { ok: true, items: items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)) };
}
