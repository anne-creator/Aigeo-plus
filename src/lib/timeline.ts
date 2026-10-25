import type { Deliverable, Project, TimelineItem, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, diffDays, isYmd, toBjYmd } from "./time";
import { projectEndDate } from "./rules";

/* ---------------- 批量粘贴解析 ---------------- */

export interface ParsedTimelineLine {
  line: number;
  dueDate: string;
  title: string;
}
export interface ParseError {
  line: number;
  text: string;
  reason: string;
}

const DATE_PATTERNS: Array<{ re: RegExp; build: (m: RegExpMatchArray) => { y?: number; mo: number; d: number } }> = [
  { re: /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/, build: (m) => ({ y: +m[1], mo: +m[2], d: +m[3] }) },
  { re: /^(\d{1,2})[-/.月](\d{1,2})日?/, build: (m) => ({ mo: +m[1], d: +m[2] }) },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 解析粘贴的 timeline 文本。每行一条：`日期 标题`，日期支持
 * 2026-10-15 / 2026/10/15 / 2026.10.15 / 10-15 / 10/15 / 10.15 / 10月15日；
 * 日期与标题之间可用空格、逗号、Tab、冒号、顿号分隔。
 * 不带年份时取“不早于项目开始日的最近一年”。
 */
export function parseTimelineText(text: string, startDate: string): { items: ParsedTimelineLine[]; errors: ParseError[] } {
  const items: ParsedTimelineLine[] = [];
  const errors: ParseError[] = [];
  const startYear = Number(startDate.slice(0, 4));
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1;
    const t = raw
      .trim()
      .replace(/^[-*•]\s+/, "") // 列表符号
      .replace(/^\d+[.)]\s+(?=\d)/, ""); // "1. 10-15 …" 这种编号
    if (!t) return;
    let matched: { y?: number; mo: number; d: number } | null = null;
    let rest = "";
    for (const p of DATE_PATTERNS) {
      const m = t.match(p.re);
      if (m) {
        matched = p.build(m);
        rest = t.slice(m[0].length);
        break;
      }
    }
    if (!matched) {
      errors.push({ line, text: raw, reason: "行首没有识别到日期（如 10-15 或 2026-10-15）" });
      return;
    }
    const title = rest.replace(/^[\s,，:：、|\t-]+/, "").trim();
    if (!title || /^[\d\s./-]+$/.test(title)) {
      errors.push({ line, text: raw, reason: "日期后面没有事项内容（日期请写成 10-15 或 2026-10-15）" });
      return;
    }
    let ymd: string;
    if (matched.y) {
      ymd = `${matched.y}-${pad(matched.mo)}-${pad(matched.d)}`;
    } else {
      ymd = `${startYear}-${pad(matched.mo)}-${pad(matched.d)}`;
      if (isYmd(ymd) && diffDays(ymd, startDate) < 0) ymd = `${startYear + 1}-${pad(matched.mo)}-${pad(matched.d)}`;
    }
    if (!isYmd(ymd)) {
      errors.push({ line, text: raw, reason: `日期不存在：${ymd}` });
      return;
    }
    items.push({ line, dueDate: ymd, title: title.slice(0, 200) });
  });
  return { items, errors };
}

/* ---------------- 读写 ---------------- */

export async function getTimelineItems(projectId: string): Promise<TimelineItem[]> {
  return prisma.timelineItem.findMany({ where: { projectId }, orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
}

/**
 * 保存 timeline 条目后调用：把 PROJECT_TIMELINE 节点记为“已提交”（只记第一次），
 * 并追加一条提交记录作为留痕；审核状态回到待审核。
 */
export async function markTimelineSubmitted(
  projectId: string,
  userId: string,
  summary: string,
  file?: { relPath: string; fileName: string; size: number; mimeType: string } | null,
  transaction?: Prisma.TransactionClient,
): Promise<void> {
  const record = async (tx: Prisma.TransactionClient) => {
    const node = await tx.deliverable.findUnique({
      where: { projectId_code_seq: { projectId, code: "PROJECT_TIMELINE", seq: 1 } },
    });
    if (!node) return;
    const now = new Date();
    const count = await tx.submission.count({ where: { deliverableId: node.id } });
    await tx.submission.create({
      data: {
        deliverableId: node.id,
        submittedById: userId,
        submittedAt: now,
        version: count + 1,
        textContent: summary,
        fileName: file?.fileName ?? null,
        filePath: file?.relPath ?? null,
        fileSize: file?.size ?? null,
        mimeType: file?.mimeType ?? null,
      },
    });
    await tx.deliverable.update({
      where: { id: node.id },
      data: { firstSubmittedAt: node.firstSubmittedAt ?? now, reviewStatus: "PENDING", reviewNote: null, reviewedAt: null, reviewedById: null },
    });
  };
  if (transaction) await record(transaction);
  else await prisma.$transaction(record);
}

/* ---------------- 项目进度 ---------------- */

export interface ProjectProgress {
  /** 第几天（1 起），未开始为 0 */
  dayIndex: number;
  totalDays: number;
  /** 时间进度 0–100 */
  timePct: number;
  totalItems: number;
  doneItems: number;
  overdueItems: number;
  /** 完成进度 0–100（按条目数） */
  donePct: number;
  /** 截至今天应完成的条目数与其中已完成数 */
  dueSoFar: number;
  doneSoFar: number;
}

/** 项目进度：系统节点 + timeline 条目一起算。done = 已提交 / 已勾选 */
export function projectProgress(
  project: Pick<Project, "startDate" | "contractMonths" | "terminationDate">,
  deliverables: Array<Pick<Deliverable, "dueAt" | "firstSubmittedAt">>,
  timeline: Array<Pick<TimelineItem, "dueDate" | "completedAt">>,
  now: Date = new Date(),
): ProjectProgress {
  const today = toBjYmd(now);
  const endYmd = project.terminationDate && diffDays(project.terminationDate, projectEndDate(project.startDate, project.contractMonths)) < 0
    ? project.terminationDate
    : projectEndDate(project.startDate, project.contractMonths);
  const totalDays = diffDays(endYmd, project.startDate) + 1;
  const dayIndex = Math.max(0, Math.min(totalDays, diffDays(today, project.startDate) + 1));
  const rows = [
    ...deliverables.map((d) => ({ due: toBjYmd(d.dueAt), done: Boolean(d.firstSubmittedAt) })),
    ...timeline.map((t) => ({ due: t.dueDate, done: Boolean(t.completedAt) })),
  ];
  const totalItems = rows.length;
  const doneItems = rows.filter((r) => r.done).length;
  const dueSoFarRows = rows.filter((r) => r.due <= today);
  const overdueItems = dueSoFarRows.filter((r) => !r.done && r.due < today).length;
  return {
    dayIndex,
    totalDays,
    timePct: totalDays > 0 ? Math.round((dayIndex / totalDays) * 100) : 0,
    totalItems,
    doneItems,
    overdueItems,
    donePct: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
    dueSoFar: dueSoFarRows.length,
    doneSoFar: dueSoFarRows.filter((r) => r.done).length,
  };
}

/** 下一个未完成的节点日期（用于“下一步”提示） */
export function nextDueDate(deliverables: Array<Pick<Deliverable, "dueAt" | "firstSubmittedAt">>, timeline: Array<Pick<TimelineItem, "dueDate" | "completedAt">>, now = new Date()): string | null {
  const today = toBjYmd(now);
  const dates = [
    ...deliverables.filter((d) => !d.firstSubmittedAt).map((d) => toBjYmd(d.dueAt)),
    ...timeline.filter((t) => !t.completedAt).map((t) => t.dueDate),
  ].filter((d) => d >= today);
  return dates.length ? dates.sort()[0] : null;
}

export { addDays };

/* ---------------- 修改申请（需管理员审批） ---------------- */

export interface ProposedItem {
  dueDate: string;
  title: string;
}

export interface TimelineDiff {
  added: ProposedItem[];
  removed: Array<{ id: string; dueDate: string; title: string }>;
  moved: Array<{ id: string; title: string; from: string; to: string }>;
  unchanged: number;
  /** 已勾选完成的旧条目：始终保留，不受修改影响 */
  keptDone: number;
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 新 timeline 与当前未完成条目的差异：按事项名称（忽略空格大小写）对应，
 * 同名不同日期 = 改期；新清单里没有的未完成条目 = 删除；当前没有的 = 新增。
 * 已完成条目不参与比较（新清单里与它同名同日的一行视为已完成，不重复新增）。
 */
export function diffTimeline(
  current: Array<Pick<TimelineItem, "id" | "dueDate" | "title" | "completedAt">>,
  proposed: ProposedItem[],
): TimelineDiff {
  const done = current.filter((c) => c.completedAt);
  const open = current.filter((c) => !c.completedAt);
  const doneKeys = new Set(done.map((d) => `${norm(d.title)}|${d.dueDate}`));
  const pool = new Map<string, Array<(typeof open)[number]>>();
  for (const o of open) {
    const k = norm(o.title);
    pool.set(k, [...(pool.get(k) ?? []), o]);
  }
  const diff: TimelineDiff = { added: [], removed: [], moved: [], unchanged: 0, keptDone: done.length };
  for (const p of proposed) {
    const k = norm(p.title);
    const list = pool.get(k);
    if (list && list.length) {
      // 优先匹配同一天的，其次最早的
      const idx = Math.max(0, list.findIndex((o) => o.dueDate === p.dueDate));
      const [hit] = list.splice(idx, 1);
      if (hit.dueDate === p.dueDate) diff.unchanged += 1;
      else diff.moved.push({ id: hit.id, title: hit.title, from: hit.dueDate, to: p.dueDate });
      continue;
    }
    if (doneKeys.has(`${k}|${p.dueDate}`)) continue;
    diff.added.push(p);
  }
  for (const list of pool.values()) for (const o of list) diff.removed.push({ id: o.id, dueDate: o.dueDate, title: o.title });
  diff.moved.sort((a, b) => (a.to < b.to ? -1 : 1));
  diff.added.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  diff.removed.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return diff;
}

export function diffSummary(d: TimelineDiff): string {
  const parts = [
    d.added.length ? `新增 ${d.added.length}` : "",
    d.removed.length ? `删除 ${d.removed.length}` : "",
    d.moved.length ? `改期 ${d.moved.length}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "没有变化";
}

export function parseProposedJson(json: string): ProposedItem[] {
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => x as Partial<ProposedItem>)
      .filter((x): x is ProposedItem => typeof x.title === "string" && !!x.title.trim() && isYmd(x.dueDate))
      .map((x) => ({ dueDate: x.dueDate, title: x.title.trim().slice(0, 200) }));
  } catch {
    return [];
  }
}

/** 当前未完成条目 → 可直接修改的文本（每行「YYYY-MM-DD 事项」），用来预填“修改 timeline” */
export function timelineToText(items: Array<Pick<TimelineItem, "dueDate" | "title" | "completedAt">>): string {
  return items
    .filter((i) => !i.completedAt)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
    .map((i) => `${i.dueDate} ${i.title}`)
    .join("\n");
}

/**
 * 管理员通过修改申请：按审批这一刻的差异更新条目——改期的保留原条目只改日期，
 * 删除的移除，新增的追加；已完成条目不动。返回变更摘要。
 */
export async function approveTimelineRevision(revisionId: string, reviewerId: string, note: string | null): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const rev = await tx.timelineRevision.findUniqueOrThrow({ where: { id: revisionId } });
    if (rev.status !== "PENDING") throw new Error("这份申请已经处理过了");
    const current = await tx.timelineItem.findMany({ where: { projectId: rev.projectId } });
    const proposed = parseProposedJson(rev.itemsJson);
    const d = diffTimeline(current, proposed);
    for (const m of d.moved) await tx.timelineItem.update({ where: { id: m.id }, data: { dueDate: m.to } });
    if (d.removed.length) await tx.timelineItem.deleteMany({ where: { id: { in: d.removed.map((r) => r.id) } } });
    if (d.added.length) {
      const base = await tx.timelineItem.count({ where: { projectId: rev.projectId } });
      await tx.timelineItem.createMany({
        data: d.added.map((a, i) => ({
          projectId: rev.projectId,
          title: a.title,
          dueDate: a.dueDate,
          sortOrder: base + i,
          createdById: rev.submittedById,
        })),
      });
    }
    const summary = diffSummary(d);
    await tx.timelineRevision.update({
      where: { id: rev.id },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note, appliedSummary: summary },
    });
    return summary;
  });
}
