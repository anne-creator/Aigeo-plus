/** 交付物类型代码（见 docs/考核规则说明.md 第 3 节） */
export const DELIVERABLE_CODES = [
  "PROMPT_POOL",
  "BASELINE_PLAN",
  "WEEKLY_UPDATE",
  "SITE_CHECKLIST",
  "KNOWLEDGE_BASE",
  "MONTHLY_REPORT",
  "DISTRIBUTION_LIST",
  "QUARTER_REPORT",
  "PROJECT_TIMELINE",
  // 以下两类为建议补充的节点，默认关闭，管理员可在系统设置中启用
  "RENEWAL_PLAN",
  "QUARTER_PLAN",
] as const;
export type DeliverableCode = (typeof DELIVERABLE_CODES)[number];

/** FILE 上传文件；TEXT 提交文字；TIMELINE 在 timeline 页面维护条目（保存即视为提交） */
export type DeliverableKind = "FILE" | "TEXT" | "TIMELINE";

export interface DeliverableTypeConfig {
  /** 权重（分） */
  weight: number;
  /** 每延期 1 天扣该项权重的百分比（0–100） */
  penaltyPerDayPct: number;
  /** 是否启用（默认 true；关闭后不再生成该类节点） */
  enabled?: boolean;
}

export interface TimelineRuleConfig {
  /** 每条 timeline 条目的权重（分） */
  weight: number;
  /** 宽限天数：超过截止日这么多天仍未完成才开始扣分 */
  graceDays: number;
  /** 宽限期后每延期 1 天扣该条权重的百分比（0–100） */
  penaltyPerDayPct: number;
}

/** AI 审核：分数 ≥ passScore 通过不扣；否则按分数段扣该项权重的比例（PDF：审核未通过的，当季 KPI 奖按比例扣除） */
export interface AiReviewConfig {
  enabled: boolean;
  passScore: number;
  /** 从高到低：分数 ≥ minScore 时扣 deductionPct% */
  bands: Array<{ minScore: number; deductionPct: number }>;
}

export interface RulesConfig {
  aiReview: AiReviewConfig;
  /** 美元→人民币汇率估算值（PDF：按 6.8 估算，实际以到账为准） */
  fxRate: number;
  /** 项目 timeline 条目的扣分规则 */
  timeline: TimelineRuleConfig;
  /** 月提成比例（PDF：10%） */
  commissionRate: number;
  /** 审核不通过时额外扣该项权重的百分比 */
  reviewRejectDeductionPct: number;
  /** 月报/分发清单：每 30 天结束后几天内提交 */
  monthlyReportWindowDays: number;
  /** 季末报告：季度结束后几天内提交 */
  quarterReportWindowDays: number;
  deliverables: Record<DeliverableCode, DeliverableTypeConfig>;
}

export interface DeliverableMeta {
  code: DeliverableCode;
  name: string;
  description: string;
  kind: DeliverableKind;
  /** 在时间线里的显示顺序（同一天内） */
  order: number;
}

export interface ScheduledDeliverable {
  code: DeliverableCode;
  /** 一次性节点为 1；周报为第几次；月报为第几个服务月；季报为第几季度 */
  seq: number;
  title: string;
  kind: DeliverableKind;
  periodLabel: string;
  /** 归属考核季度（按交付物覆盖的周期，不按截止日） */
  quarter: number;
  windowStartYmd: string;
  dueYmd: string;
  windowStart: Date;
  dueAt: Date;
}

export interface ScheduleInput {
  /** D0，YYYY-MM-DD */
  startDate: string;
  contractMonths: number;
  /** 暂停/终止日（YYYY-MM-DD），截止日晚于此日的节点不生成 */
  terminationDate?: string | null;
  config?: Partial<Pick<RulesConfig, "monthlyReportWindowDays" | "quarterReportWindowDays">> & {
    deliverables?: Partial<Record<DeliverableCode, Partial<DeliverableTypeConfig>>>;
  };
}

export type ReviewStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

/** OPEN 待提交（未到截止）；ON_TIME 按时；LATE 延期提交；OVERDUE 已过截止仍未提交。所有节点从第 1 天起开放。 */
export type DeliverableStatus = "OPEN" | "ON_TIME" | "LATE" | "OVERDUE";

/** timeline 条目状态：TODO 未到期；DONE 已完成；GRACE 已过截止但在宽限期内；OVERDUE 已超出宽限期 */
export type TimelineStatus = "TODO" | "DONE" | "GRACE" | "OVERDUE";

export type TierPct = 100 | 60 | 0;
