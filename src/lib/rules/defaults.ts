import type { DeliverableCode, DeliverableMeta, RulesConfig } from "./types";

export const DELIVERABLE_META: Record<DeliverableCode, DeliverableMeta> = {
  PROMPT_POOL: {
    code: "PROMPT_POOL",
    name: "提示词池 + 第一版方案",
    description: "第 1 天提交给客户：提示词池（供客户选择）、提示词 insights 与调研、第一版方案。",
    kind: "FILE",
    order: 1,
  },
  BASELINE_PLAN: {
    code: "BASELINE_PLAN",
    name: "基线报告 + 季度规划方案",
    description: "第 1 周结束前提交给客户：基线报告，以及一个季度的详细规划与方案。",
    kind: "FILE",
    order: 2,
  },
  SITE_CHECKLIST: {
    code: "SITE_CHECKLIST",
    name: "官网技术修改 checklist",
    description: "第 2–3 周内提交：客户官网的技术修改清单。",
    kind: "FILE",
    order: 3,
  },
  KNOWLEDGE_BASE: {
    code: "KNOWLEDGE_BASE",
    name: "客户知识库（客户已审核版）",
    description: "第 2–3 周内上传：用户支持 / 客户知识库，上传客户已审核通过的版本；负责人可在负责人端下载。",
    kind: "FILE",
    order: 4,
  },
  WEEKLY_UPDATE: {
    code: "WEEKLY_UPDATE",
    name: "周一复盘",
    description: "每周一提交文字：上周完成了什么、本周计划什么。",
    kind: "TEXT",
    order: 5,
  },
  MONTHLY_REPORT: {
    code: "MONTHLY_REPORT",
    name: "月报",
    description: "每 30 天结束后 7 天内提交该服务月的月末报告。",
    kind: "FILE",
    order: 6,
  },
  DISTRIBUTION_LIST: {
    code: "DISTRIBUTION_LIST",
    name: "分发内容清单",
    description: "与月报同步提交：该服务月用户公示层与媒体层的全部分发内容清单。",
    kind: "FILE",
    order: 7,
  },
  QUARTER_REPORT: {
    code: "QUARTER_REPORT",
    name: "季末报告",
    description: "季度结束后 7 天内提交季末报告。",
    kind: "FILE",
    order: 8,
  },
  PROJECT_TIMELINE: {
    code: "PROJECT_TIMELINE",
    name: "项目 timeline（详细节点计划）",
    description:
      "基线报告确认后逐个录入：本项目的详细时间节点（如“10-15 提交 Reddit 内容”“10-20 提交第二批博客”），节点自动进入日历与当日 checklist。第 2 周结束前完成首次录入。",
    kind: "TIMELINE",
    order: 3,
  },
  RENEWAL_PLAN: {
    code: "RENEWAL_PLAN",
    name: "续约推进计划（建议项，默认关闭）",
    description:
      "项目结束前 30 天提交：客户会议、续约会议、销售会议的安排与续约推进计划（薪酬规则要求 PM 在项目结束前提前规划并主动推进续约）。",
    kind: "TEXT",
    order: 9,
  },
  QUARTER_PLAN: {
    code: "QUARTER_PLAN",
    name: "新季度规划方案（建议项，默认关闭）",
    description: "续约后每个新季度开始 7 天内提交该季度的规划与约定交付内容，作为季末审核的“季初约定”依据。",
    kind: "FILE",
    order: 10,
  },
};

/** 默认规则（可在管理员「系统设置」中修改，存于 Setting 表 key=rules） */
export const DEFAULT_RULES: RulesConfig = {
  aiReview: {
    enabled: true,
    passScore: 80,
    bands: [
      { minScore: 60, deductionPct: 20 },
      { minScore: 40, deductionPct: 50 },
      { minScore: 0, deductionPct: 100 },
    ],
  },
  fxRate: 6.8,
  timeline: { weight: 1, graceDays: 7, penaltyPerDayPct: 10 },
  commissionRate: 0.1,
  reviewRejectDeductionPct: 50,
  monthlyReportWindowDays: 7,
  quarterReportWindowDays: 7,
  deliverables: {
    PROMPT_POOL: { weight: 10, penaltyPerDayPct: 10 },
    BASELINE_PLAN: { weight: 15, penaltyPerDayPct: 10 },
    SITE_CHECKLIST: { weight: 8, penaltyPerDayPct: 10 },
    KNOWLEDGE_BASE: { weight: 8, penaltyPerDayPct: 10 },
    WEEKLY_UPDATE: { weight: 2, penaltyPerDayPct: 20 },
    MONTHLY_REPORT: { weight: 10, penaltyPerDayPct: 10 },
    DISTRIBUTION_LIST: { weight: 5, penaltyPerDayPct: 10 },
    QUARTER_REPORT: { weight: 15, penaltyPerDayPct: 10 },
    PROJECT_TIMELINE: { weight: 10, penaltyPerDayPct: 10 },
    RENEWAL_PLAN: { weight: 5, penaltyPerDayPct: 10, enabled: false },
    QUARTER_PLAN: { weight: 15, penaltyPerDayPct: 10, enabled: false },
  },
};

export const PLAN_TIERS = [
  { value: "LAUNCH", label: "Launch 档" },
  { value: "GROW", label: "Growth 档" },
  { value: "SCALE", label: "Scale 档" },
  { value: "CUSTOM", label: "定制档" },
] as const;

export const KPI_METRIC_TYPES = [
  { value: "SHOWUP_RATE", label: "提示词池 ShowUp 率", defaultUnit: "%" },
  { value: "VISIBILITY_LIFT", label: "可见度提升", defaultUnit: "个百分点" },
  { value: "REDDIT_POSTS", label: "Reddit 发稿篇数", defaultUnit: "篇" },
  { value: "ARTICLES", label: "文章/内容篇数", defaultUnit: "篇" },
  { value: "CUSTOM", label: "其它自定义指标", defaultUnit: "" },
] as const;

export const PROJECT_STATUSES = [
  { value: "ACTIVE", label: "进行中" },
  { value: "PAUSED", label: "已暂停" },
  { value: "TERMINATED", label: "已终止" },
  { value: "COMPLETED", label: "已完成" },
] as const;

export const ROLES = [
  { value: "ADMIN", label: "管理员" },
  { value: "PM", label: "项目经理" },
  { value: "INTERN", label: "负责人" },
  { value: "CHANNEL", label: "渠道方" },
] as const;

export function labelOf<T extends readonly { value: string; label: string }[]>(list: T, value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}
