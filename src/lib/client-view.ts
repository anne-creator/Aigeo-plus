/**
 * 给客户 / 渠道方看的项目视图：只含进度、计划、已交付的东西。
 * 不含任何内部考核信息（扣分、得分、审核意见、KPI 奖、项目经理的逾期）。
 */
import { mergeTimelineGroups } from "./timeline-track";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { sourceLabel } from "./channels";
import { PLAN_TIERS, labelOf, projectEndDate } from "./rules";
import { diffDays, toBjYmd } from "./time";

/** 客户看到的状态：已交付 / 进行中（已到或已过计划日，尚未交付）/ 计划中 */
export type ClientStepStatus = "DONE" | "IN_PROGRESS" | "PLANNED";

export interface ClientFile {
  /** 用于下载链接：由调用方拼成 /share/<token>/file/<id> 或 /api/files/<id> */
  submissionId: string;
  fileName: string;
}

export interface ClientStep {
  key: string;
  title: string;
  /** 计划完成日 YYYY-MM-DD */
  dueDate: string;
  status: ClientStepStatus;
  /** 交付日 YYYY-MM-DD */
  deliveredDate: string | null;
  file: ClientFile | null;
}

export interface ClientPhase {
  label: string;
  steps: ClientStep[];
}

export interface ClientWeekly {
  dueDate: string;
  status: ClientStepStatus;
  deliveredDate: string | null;
  /** 当周进展文字（项目经理提交的周一复盘：上周完成了什么、本周计划什么） */
  text: string | null;
}

export interface ClientTimelineItem {
  dueDate: string;
  title: string;
  done: boolean;
}

export interface ClientView {
  projectId: string;
  clientName: string;
  websiteUrl: string;
  planTierLabel: string;
  sourceLabel: string;
  pmName: string;
  statusLabel: string;
  startDate: string;
  endDate: string;
  /** 今天北京时间 */
  today: string;
  /** 第几天（未开始为 0，结束后封顶） */
  dayIndex: number;
  totalDays: number;
  /** 主要交付物完成比例 0–100 */
  progressPct: number;
  deliveredCount: number;
  totalCount: number;
  /** 下一项计划交付 */
  next: { title: string; dueDate: string } | null;
  phases: ClientPhase[];
  weekly: ClientWeekly[];
  timeline: ClientTimelineItem[];
  kpis: Array<{ name: string; target: number; unit: string }>;
  /** 最近交付（新到旧） */
  recent: Array<{ title: string; date: string; file: ClientFile | null }>;
  updatedAt: string;
}

/** 客户看到的交付物名称（比内部名称更直白） */
function clientTitle(code: string, seq: number): string {
  switch (code) {
    case "PROMPT_POOL":
      return "提示词池与第一版方案";
    case "BASELINE_PLAN":
      return "基线报告与季度规划";
    case "PROJECT_TIMELINE":
      return "项目详细计划";
    case "SITE_CHECKLIST":
      return "官网技术优化清单";
    case "KNOWLEDGE_BASE":
      return "品牌知识库";
    case "MONTHLY_REPORT":
      return `第 ${seq} 月月报`;
    case "DISTRIBUTION_LIST":
      return `第 ${seq} 月内容分发清单`;
    case "QUARTER_REPORT":
      return `第 ${seq} 季度报告`;
    default:
      return "";
  }
}

const PROJECT_STATUS_LABEL: Record<string, string> = { ACTIVE: "服务中", PAUSED: "已暂停", TERMINATED: "已结束", COMPLETED: "已完成" };
/** 只给客户看这些节点（续约推进计划、新季度规划是内部节点） */
const CLIENT_CODES = new Set(["PROMPT_POOL", "BASELINE_PLAN", "PROJECT_TIMELINE", "SITE_CHECKLIST", "KNOWLEDGE_BASE", "MONTHLY_REPORT", "DISTRIBUTION_LIST", "QUARTER_REPORT"]);

function stepStatus(due: string, delivered: boolean, today: string): ClientStepStatus {
  if (delivered) return "DONE";
  return due <= today ? "IN_PROGRESS" : "PLANNED";
}

export async function getClientView(projectId: string, now: Date = new Date()): Promise<ClientView | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      pm: { select: { name: true } },
      kpis: { orderBy: { id: "asc" } },
      deliverables: {
        orderBy: [{ dueAt: "asc" }, { seq: "asc" }],
        include: { submissions: { orderBy: { version: "desc" }, take: 5 } },
      },
      timelineItems: { orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!p) return null;
  const today = toBjYmd(now);
  const end = p.terminationDate && p.terminationDate < projectEndDate(p.startDate, p.contractMonths) ? p.terminationDate : projectEndDate(p.startDate, p.contractMonths);
  const totalDays = diffDays(end, p.startDate) + 1;
  const dayIndex = Math.max(0, Math.min(totalDays, diffDays(today, p.startDate) + 1));

  const steps: Array<ClientStep & { code: string; seq: number }> = [];
  const weekly: ClientWeekly[] = [];
  const recent: ClientView["recent"] = [];
  for (const d of p.deliverables) {
    const due = toBjYmd(d.dueAt);
    const delivered = Boolean(d.firstSubmittedAt);
    const deliveredDate = d.firstSubmittedAt ? toBjYmd(d.firstSubmittedAt) : null;
    if (d.code === "WEEKLY_UPDATE") {
      const latest = d.submissions[0];
      weekly.push({ dueDate: due, status: stepStatus(due, delivered, today), deliveredDate, text: latest?.textContent ?? null });
      continue;
    }
    if (!CLIENT_CODES.has(d.code)) continue;
    const withFile = d.submissions.find((s) => s.filePath);
    const file = withFile ? { submissionId: withFile.id, fileName: withFile.fileName ?? "文件" } : null;
    const title = clientTitle(d.code, d.seq);
    steps.push({ key: d.id, code: d.code, seq: d.seq, title, dueDate: due, status: stepStatus(due, delivered, today), deliveredDate, file });
    if (deliveredDate) recent.push({ title, date: deliveredDate, file });
  }

  // 分阶段：启动（第 1 周）· 优化（第 2–3 周）· 每月（月报 + 分发清单，季度末附季度报告）
  const phases: Array<{ label: string; steps: typeof steps }> = [];
  const pick = (codes: string[]) => steps.filter((s) => codes.includes(s.code));
  const kickoff = pick(["PROMPT_POOL", "BASELINE_PLAN", "PROJECT_TIMELINE"]);
  if (kickoff.length) phases.push({ label: "启动 · 第 1–2 周", steps: kickoff });
  const optimize = pick(["SITE_CHECKLIST", "KNOWLEDGE_BASE"]);
  if (optimize.length) phases.push({ label: "优化 · 第 2–3 周", steps: optimize });
  const months = Array.from(new Set(steps.filter((s) => s.code === "MONTHLY_REPORT" || s.code === "DISTRIBUTION_LIST").map((s) => s.seq))).sort((a, b) => a - b);
  for (const m of months) {
    const ms = steps.filter((s) => (s.code === "MONTHLY_REPORT" || s.code === "DISTRIBUTION_LIST") && s.seq === m);
    if (m % 3 === 0) ms.push(...steps.filter((s) => s.code === "QUARTER_REPORT" && s.seq === m / 3));
    phases.push({ label: `第 ${m} 月`, steps: ms });
  }
  const placedQuarters = new Set(months.filter((m) => m % 3 === 0).map((m) => m / 3));
  const orphanQ = steps.filter((s) => s.code === "QUARTER_REPORT" && !placedQuarters.has(s.seq));
  if (orphanQ.length) phases.push({ label: "季度总结", steps: orphanQ });

  // 只读已生效的 TimelineItem；上传草稿与待审批 revision 不进入客户视图。
  const confirmedSteps: ClientStep[] = p.timelineItems.map((t) => ({
    key: "plan-" + t.id, title: t.title, dueDate: t.dueDate,
    status: stepStatus(t.dueDate, Boolean(t.completedAt), today),
    deliveredDate: t.completedAt ? toBjYmd(t.completedAt) : null, file: null,
  }));
  const visiblePhases = confirmedSteps.length ? mergeTimelineGroups<ClientStep>(phases, confirmedSteps, (s) => s.dueDate) : phases;
  const main = visiblePhases.flatMap((ph) => ph.steps);
  const deliveredCount = main.filter((s) => s.status === "DONE").length;
  const nextStep = main.filter((s) => s.status !== "DONE").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];
  recent.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    projectId: p.id,
    clientName: p.clientName,
    websiteUrl: p.websiteUrl,
    planTierLabel: labelOf(PLAN_TIERS, p.planTier),
    sourceLabel: sourceLabel(p.source),
    pmName: p.pm.name,
    statusLabel: PROJECT_STATUS_LABEL[p.status] ?? p.status,
    startDate: p.startDate,
    endDate: end,
    today,
    dayIndex,
    totalDays,
    progressPct: main.length ? Math.round((deliveredCount / main.length) * 100) : 0,
    deliveredCount,
    totalCount: main.length,
    next: nextStep ? { title: nextStep.title, dueDate: nextStep.dueDate } : null,
    phases: visiblePhases.map((ph): ClientPhase => ({
      label: ph.label,
      steps: ph.steps.map((s) => ({ key: s.key, title: s.title, dueDate: s.dueDate, status: s.status, deliveredDate: s.deliveredDate, file: s.file })),
    })),
    weekly,
    timeline: p.timelineItems.map((t) => ({ dueDate: t.dueDate, title: t.title, done: Boolean(t.completedAt) })),
    kpis: p.kpis.map((k) => ({ name: k.name, target: k.targetValue, unit: k.unit })),
    recent: recent.slice(0, 8),
    updatedAt: now.toISOString(),
  };
}

/* ---------------- 分享链接 ---------------- */

/** 生成（或返回已有的）分享令牌 */
export async function ensureShareToken(projectId: string): Promise<string> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { shareToken: true } });
  if (p.shareToken) return p.shareToken;
  return rotateShareToken(projectId);
}

/** 重新生成令牌：旧链接立即失效 */
export async function rotateShareToken(projectId: string): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  await prisma.project.update({ where: { id: projectId }, data: { shareToken: token } });
  return token;
}

/** 关闭分享 */
export async function revokeShareToken(projectId: string): Promise<void> {
  await prisma.project.update({ where: { id: projectId }, data: { shareToken: null } });
}

export async function projectIdByShareToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const p = await prisma.project.findUnique({ where: { shareToken: token }, select: { id: true } });
  return p?.id ?? null;
}

/** 某个交付文件是否属于该项目（给客户下载前校验） */
export async function submissionInProject(submissionId: string, projectId: string): Promise<boolean> {
  const s = await prisma.submission.findUnique({ where: { id: submissionId }, select: { deliverable: { select: { projectId: true, code: true } } } });
  return Boolean(s && s.deliverable.projectId === projectId && (CLIENT_CODES.has(s.deliverable.code) || s.deliverable.code === "WEEKLY_UPDATE"));
}

/** 渠道方能否看这个项目：项目来源必须是该渠道 */
export function channelCanSee(channel: string | null | undefined, project: { source: string }): boolean {
  return Boolean(channel) && project.source === channel;
}
