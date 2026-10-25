/**
 * 演示数据。运行：npm run db:seed（会先清空再写入）。
 * 演示账号（均为测试值，上线前请在「账号管理」里改掉）：
 *   admin / admin123      管理员
 *   pm.zhang / pm123      项目经理 张经理
 *   pm.li / pm123         项目经理 李经理
 *   intern.wang / intern123  负责人 王小明（视频分发负责人）
 *   intern.chen / intern123  负责人 陈思（用户共识层分发负责人）
 *   intern.liu / intern123   负责人 刘洋（媒体分发负责人）
 *   intern.zhao / intern123  负责人 赵文（专业润色写手）
 *   channel.zhiwai / channel123  渠道方 知外（Acme SaaS、Gamma Health 来自知外）
 *   channel.maxus / channel123   渠道方 Maxus（Beta Robotics 来自 Maxus）
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncProjectDeliverables } from "../src/lib/deliverables";
import { addDays, BJ_OFFSET_MS, endOfDayBj, toBjYmd, ymdToUtcMidnight } from "../src/lib/time";

const prisma = new PrismaClient();

/** 北京时间 → Date */
function bj(ymd: string, hm = "10:00"): Date {
  const [h, m] = hm.split(":").map(Number);
  return new Date(ymdToUtcMidnight(ymd) - BJ_OFFSET_MS + (h * 60 + m) * 60_000);
}

async function placeholderFile(name: string, content: string): Promise<{ relPath: string; size: number }> {
  const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./uploads");
  const rel = path.join("seed", name);
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), content, "utf8");
  return { relPath: rel, size: Buffer.byteLength(content) };
}

async function submit(
  projectId: string,
  code: string,
  seq: number,
  by: string,
  at: Date,
  opts: { text?: string; file?: string; review?: "APPROVED" | "REJECTED" | "PENDING"; reviewNote?: string; reviewerId?: string },
) {
  const d = await prisma.deliverable.findUniqueOrThrow({ where: { projectId_code_seq: { projectId, code, seq } } });
  let file: { relPath: string; size: number } | null = null;
  if (opts.file) file = await placeholderFile(`${projectId}-${code}-${seq}.txt`, `示例文件：${opts.file}\n（演示数据，非真实交付物）\n`);
  await prisma.submission.create({
    data: {
      deliverableId: d.id,
      submittedById: by,
      submittedAt: at,
      version: 1,
      textContent: opts.text ?? null,
      fileName: opts.file ?? null,
      filePath: file?.relPath ?? null,
      fileSize: file?.size ?? null,
      mimeType: opts.file ? "text/plain" : null,
    },
  });
  await prisma.deliverable.update({
    where: { id: d.id },
    data: {
      firstSubmittedAt: at,
      reviewStatus: opts.review ?? "PENDING",
      reviewNote: opts.reviewNote ?? null,
      reviewedById: opts.review && opts.review !== "PENDING" ? opts.reviewerId ?? null : null,
      reviewedAt: opts.review && opts.review !== "PENDING" ? new Date(at.getTime() + 36e5) : null,
    },
  });
}

/** 写入 timeline 条目，done 为 true 的按截止当天或指定时间勾选 */
async function timeline(projectId: string, by: string, rows: Array<[string, string, boolean | string]>) {
  let order = 0;
  for (const [dueDate, title, done] of rows) {
    const completedAt = done === true ? bj(dueDate, "17:00") : typeof done === "string" ? bj(done, "17:00") : null;
    await prisma.timelineItem.create({
      data: { projectId, title, dueDate, sortOrder: order++, createdById: by, completedAt, completedById: completedAt ? by : null },
    });
  }
  const node = await prisma.deliverable.findUnique({ where: { projectId_code_seq: { projectId, code: "PROJECT_TIMELINE", seq: 1 } } });
  if (node) {
    const at = bj(rows[0][0], "10:00");
    await prisma.submission.create({
      data: { deliverableId: node.id, submittedById: by, submittedAt: at, version: 1, textContent: `上传项目 timeline：${rows.length} 条` },
    });
    await prisma.deliverable.update({ where: { id: node.id }, data: { firstSubmittedAt: at, reviewStatus: "APPROVED" } });
  }
}

async function main() {
  await prisma.meetingInvite.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.timelineRevision.deleteMany();
  await prisma.timelineItem.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.quarterAssessment.deleteMany();
  await prisma.projectKpi.deleteMany();
  await prisma.project.deleteMany();
  await prisma.internDailyLog.deleteMany();
  await prisma.taskSubmission.deleteMany();
  await prisma.internTask.deleteMany();
  await prisma.taskBatch.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  const [admin, zhang, li, wang] = await Promise.all([
    prisma.user.create({ data: { username: "admin", name: "管理员", role: "ADMIN", passwordHash: await bcrypt.hash("admin123", 10) } }),
    prisma.user.create({ data: { username: "pm.zhang", name: "张经理", role: "PM", passwordHash: await bcrypt.hash("pm123", 10) } }),
    prisma.user.create({ data: { username: "pm.li", name: "李经理", role: "PM", passwordHash: await bcrypt.hash("pm123", 10) } }),
    prisma.user.create({ data: { username: "intern.wang", name: "王小明", role: "INTERN", dutyRole: "VIDEO", passwordHash: await bcrypt.hash("intern123", 10) } }),
  ]);
  await Promise.all([
    prisma.user.create({ data: { username: "channel.zhiwai", name: "知外", role: "CHANNEL", channel: "ZHIWAI", passwordHash: await bcrypt.hash("channel123", 10) } }),
    prisma.user.create({ data: { username: "channel.zhitui", name: "智推时代", role: "CHANNEL", channel: "ZHITUI", passwordHash: await bcrypt.hash("channel123", 10) } }),
    prisma.user.create({ data: { username: "channel.maxus", name: "Maxus", role: "CHANNEL", channel: "MAXUS", passwordHash: await bcrypt.hash("channel123", 10) } }),
  ]);
  const [chen, liu, zhao] = await Promise.all([
    prisma.user.create({ data: { username: "intern.chen", name: "陈思", role: "INTERN", dutyRole: "USER_LAYER", passwordHash: await bcrypt.hash("intern123", 10) } }),
    prisma.user.create({ data: { username: "intern.liu", name: "刘洋", role: "INTERN", dutyRole: "MEDIA", passwordHash: await bcrypt.hash("intern123", 10) } }),
    prisma.user.create({ data: { username: "intern.zhao", name: "赵文", role: "INTERN", dutyRole: "WRITER", passwordHash: await bcrypt.hash("intern123", 10) } }),
  ]);

  // 项目 A：2026-09-21 开始，Grow 档，$3,300，有按时/延期/逾期各种情况
  const acme = await prisma.project.create({
    data: {
      clientName: "示例客户 · Acme SaaS",
      websiteUrl: "https://www.acme-saas.example",
      startDate: "2026-09-21",
      planTier: "GROW",
      source: "ZHIWAI",
      monthlyFeeUsd: 3300,
      contractMonths: 3,
      pmId: zhang.id,
      notes: "演示数据：季度目标 ShowUp 率 50%，Reddit 发稿 12 篇/季。",
      kpis: {
        create: [
          { metricType: "SHOWUP_RATE", name: "提示词池 ShowUp 率", targetValue: 50, unit: "%" },
          { metricType: "REDDIT_POSTS", name: "Reddit 发稿篇数", targetValue: 12, unit: "篇/季" },
          { metricType: "VISIBILITY_LIFT", name: "AI 可见度提升", targetValue: 20, unit: "个百分点" },
        ],
      },
    },
  });
  await syncProjectDeliverables(acme.id);
  await submit(acme.id, "PROMPT_POOL", 1, zhang.id, bj("2026-09-21", "18:30"), { file: "Acme-提示词池与第一版方案.pdf", review: "APPROVED", reviewerId: admin.id });
  await submit(acme.id, "BASELINE_PLAN", 1, zhang.id, bj("2026-09-29", "10:00"), { file: "Acme-基线报告与季度规划.pdf", review: "APPROVED", reviewerId: admin.id }); // 延期 2 天
  await submit(acme.id, "SITE_CHECKLIST", 1, zhang.id, bj("2026-10-10", "16:00"), { file: "Acme-官网技术修改checklist.xlsx" });
  // KNOWLEDGE_BASE 未提交（已逾期）
  await submit(acme.id, "WEEKLY_UPDATE", 1, zhang.id, bj("2026-09-28", "09:30"), {
    text: "上周完成：提示词池 120 条已交付，客户选定 60 条；基线报告已出。\n本周计划：官网技术 checklist 初稿、知识库大纲与客户确认会。",
    review: "APPROVED",
    reviewerId: admin.id,
  });
  await submit(acme.id, "WEEKLY_UPDATE", 2, zhang.id, bj("2026-10-06", "09:00"), {
    text: "上周完成：官网 checklist 初稿完成并与客户技术负责人过了一遍。\n本周计划：知识库 v1 交客户审核；Reddit 首批 3 篇内容排期。",
  }); // 延期 1 天
  await submit(acme.id, "WEEKLY_UPDATE", 3, zhang.id, bj("2026-10-12", "08:50"), {
    text: "上周完成：官网 checklist 定稿提交；Reddit 发稿 3 篇。\n本周计划：知识库客户审核版收尾；月报数据准备。",
    review: "REJECTED",
    reviewNote: "没有写明 Reddit 3 篇的链接，与季初承诺的分发口径对不上，请补充后重新提交。",
    reviewerId: admin.id,
  });

  await timeline(acme.id, zhang.id, [
    ["2026-09-30", "客户确认提示词池（60 条）", true],
    ["2026-10-08", "Reddit 首批 3 篇发布", "2026-10-09"],
    ["2026-10-15", "第二批博客 2 篇交付", "2026-10-17"],
    ["2026-10-20", "官网 FAQ 页面上线", false],
    ["2026-10-22", "Reddit 第二批 3 篇发布", false],
    ["2026-10-27", "第 1 个月月报发送客户", false],
    ["2026-11-05", "知识库 v2 上线", false],
    ["2026-11-12", "第三批博客 3 篇交付", false],
    ["2026-11-19", "Reddit 第三批 3 篇发布", false],
    ["2026-11-26", "第 2 个月月报发送客户", false],
    ["2026-12-10", "季度复盘会 + 续约会议", false],
  ]);

  // 项目 B：2026-10-14（周三）开始，Launch 档，$2,000，刚起步
  const beta = await prisma.project.create({
    data: {
      clientName: "示例客户 · Beta Robotics",
      websiteUrl: "https://beta-robotics.example",
      startDate: "2026-10-14",
      planTier: "LAUNCH",
      source: "MAXUS",
      monthlyFeeUsd: 2000,
      contractMonths: 3,
      pmId: zhang.id,
      kpis: {
        create: [
          { metricType: "SHOWUP_RATE", name: "提示词池 ShowUp 率", targetValue: 35, unit: "%" },
          { metricType: "REDDIT_POSTS", name: "Reddit 发稿篇数", targetValue: 8, unit: "篇/季" },
        ],
      },
    },
  });
  await syncProjectDeliverables(beta.id);
  await submit(beta.id, "PROMPT_POOL", 1, zhang.id, bj("2026-10-14", "20:10"), { file: "Beta-提示词池与第一版方案.pdf" });

  // 项目 C：李经理，2026-08-03 开始，历史较长
  const gamma = await prisma.project.create({
    data: {
      clientName: "示例客户 · Gamma Health",
      websiteUrl: "https://gammahealth.example",
      startDate: "2026-08-03",
      planTier: "CUSTOM",
      source: "ZHIWAI",
      monthlyFeeUsd: 3300,
      contractMonths: 3,
      pmId: li.id,
      kpis: {
        create: [
          { metricType: "SHOWUP_RATE", name: "提示词池 ShowUp 率", targetValue: 40, unit: "%" },
          { metricType: "ARTICLES", name: "官网文章篇数", targetValue: 9, unit: "篇/季" },
        ],
      },
    },
  });
  await syncProjectDeliverables(gamma.id);
  await submit(gamma.id, "PROMPT_POOL", 1, li.id, bj("2026-08-03", "17:00"), { file: "Gamma-提示词池与第一版方案.pdf", review: "APPROVED", reviewerId: admin.id });
  await submit(gamma.id, "BASELINE_PLAN", 1, li.id, bj("2026-08-09", "21:00"), { file: "Gamma-基线报告与季度规划.pdf", review: "APPROVED", reviewerId: admin.id });
  await submit(gamma.id, "SITE_CHECKLIST", 1, li.id, bj("2026-08-21", "11:00"), { file: "Gamma-官网技术修改checklist.xlsx", review: "APPROVED", reviewerId: admin.id });
  await submit(gamma.id, "KNOWLEDGE_BASE", 1, li.id, bj("2026-08-26", "15:00"), { file: "Gamma-知识库-客户确认版.docx", review: "APPROVED", reviewerId: admin.id }); // 延期 3 天
  const weeks = await prisma.deliverable.findMany({ where: { projectId: gamma.id, code: "WEEKLY_UPDATE" }, orderBy: { seq: "asc" } });
  for (const w of weeks) {
    const dueYmd = new Date(w.dueAt.getTime() + BJ_OFFSET_MS).toISOString().slice(0, 10);
    if (dueYmd > "2026-10-19") break;
    const late = w.seq % 4 === 0;
    const at = late ? bj(addDays(dueYmd, 1), "11:00") : bj(dueYmd, "09:20");
    await submit(gamma.id, "WEEKLY_UPDATE", w.seq, li.id, at, {
      text: `上周完成：第 ${w.seq} 周内容分发 2 篇，官网 FAQ 更新。\n本周计划：继续推进第 ${w.seq + 1} 周排期。`,
      review: "APPROVED",
      reviewerId: admin.id,
    });
  }
  await submit(gamma.id, "MONTHLY_REPORT", 1, li.id, bj("2026-09-07", "18:00"), { file: "Gamma-第1个月月报.pdf", review: "APPROVED", reviewerId: admin.id });
  await submit(gamma.id, "DISTRIBUTION_LIST", 1, li.id, bj("2026-09-07", "18:05"), { file: "Gamma-第1个月分发清单.xlsx", review: "APPROVED", reviewerId: admin.id });
  await submit(gamma.id, "MONTHLY_REPORT", 2, li.id, bj("2026-10-09", "12:00"), { file: "Gamma-第2个月月报.pdf" }); // 延期 1 天
  // 第 2 个月分发清单未提交（已逾期）
  await timeline(gamma.id, li.id, [
    ["2026-08-12", "客户确认提示词池", true],
    ["2026-08-25", "官网 schema 修改上线", "2026-08-27"],
    ["2026-09-05", "首批文章 3 篇发布", true],
    ["2026-09-25", "第二批文章 3 篇发布", "2026-10-08"],
    ["2026-10-10", "Reddit 内容 2 篇", false],
    ["2026-10-20", "第三批文章 3 篇发布", false],
    ["2026-10-28", "客户季度复盘会", false],
  ]);
  // 一份待审批的 timeline 修改申请（演示审批流程）
  await prisma.timelineRevision.create({
    data: {
      projectId: gamma.id,
      submittedById: li.id,
      reason: "客户推迟季度复盘会；Reddit 新账号审核延后一周",
      itemsJson: JSON.stringify([
        { dueDate: "2026-10-24", title: "Reddit 内容 2 篇" },
        { dueDate: "2026-10-20", title: "第三批文章 3 篇发布" },
        { dueDate: "2026-11-04", title: "客户季度复盘会" },
        { dueDate: "2026-11-10", title: "第四批文章 3 篇发布" },
      ]),
      createdAt: bj("2026-10-21", "18:20"),
    },
  });

  // 实习生占位数据
  // 负责人任务：项目经理通过“分配任务”下发的清单（已确认），以及一份待确认的草稿
  async function batch(
    projectId: string,
    pmId: string,
    assigneeId: string,
    dutyRole: string,
    sourceText: string,
    items: Array<{ title: string; dueDate: string; minutes: number; done?: string; url?: string }>,
    createdAt: string,
  ) {
    const b = await prisma.taskBatch.create({
      data: {
        projectId,
        createdById: pmId,
        assigneeId,
        dutyRole,
        sourceText,
        itemsJson: JSON.stringify(items.map((i) => ({ title: i.title, dueDate: i.dueDate, note: null, estimatedMinutes: i.minutes }))),
        parseMethod: "rules",
        status: "CONFIRMED",
        createdAt: bj(createdAt, "10:00"),
        confirmedAt: bj(createdAt, "10:05"),
      },
    });
    for (const it of items) {
      const t = await prisma.internTask.create({
        data: {
          assigneeId,
          createdById: pmId,
          projectId,
          batchId: b.id,
          title: it.title,
          dueAt: endOfDayBj(it.dueDate),
          estimatedMinutes: it.minutes,
          status: it.done ? "DONE" : "TODO",
          completedAt: it.done ? bj(it.done, "16:00") : null,
          createdAt: bj(createdAt, "10:05"),
        },
      });
      if (it.done && it.url) {
        await prisma.taskSubmission.create({
          data: { taskId: t.id, submittedById: assigneeId, submittedAt: bj(it.done, "16:00"), url: it.url, note: "已发布" },
        });
      }
    }
  }
  await batch(acme.id, zhang.id, zhao.id, "WRITER", "10-18 润色 Reddit 帖子 3 篇\n10-24 润色第二批博客 2 篇（DDL 10/24）\n10-30 知识库 FAQ 文案润色 20 条", [
    { title: "润色 Reddit 帖子 3 篇", dueDate: "2026-10-18", minutes: 90, done: "2026-10-17", url: "https://docs.example.com/acme-reddit-batch1" },
    { title: "润色第二批博客 2 篇", dueDate: "2026-10-24", minutes: 120, done: "2026-10-20", url: "https://docs.example.com/acme-blog-batch2" },
    { title: "知识库 FAQ 文案润色 20 条", dueDate: "2026-10-30", minutes: 150 },
  ], "2026-10-15");
  await batch(acme.id, zhang.id, wang.id, "VIDEO", "10-22 剪辑 3 条产品短视频并发布到 YouTube Shorts\n10-29 TikTok 发布 2 条", [
    { title: "剪辑 3 条产品短视频并发布到 YouTube Shorts", dueDate: "2026-10-22", minutes: 180 },
    { title: "TikTok 发布 2 条", dueDate: "2026-10-29", minutes: 60 },
  ], "2026-10-16");
  await batch(gamma.id, li.id, chen.id, "USER_LAYER", "10-15 Reddit r/HealthIT 发帖 2 篇\n10-26 Quora 回答 5 条", [
    { title: "Reddit r/HealthIT 发帖 2 篇", dueDate: "2026-10-15", minutes: 45, done: "2026-10-15", url: "https://www.reddit.com/r/HealthIT/comments/example" },
    { title: "Quora 回答 5 条", dueDate: "2026-10-26", minutes: 75 },
  ], "2026-10-10");
  await batch(gamma.id, li.id, liu.id, "MEDIA", "11-02 联系 3 家行业媒体投稿", [
    { title: "联系 3 家行业媒体投稿", dueDate: "2026-11-02", minutes: 90 },
  ], "2026-10-12");
  // 会议（相对今天，保证演示时总在未来）：已确认 / 等待确认 / 有人拒绝
  const today = toBjYmd(new Date());
  const at = (days: number, hm: string) => bj(addDays(today, days), hm);
  async function meeting(organizerId: string, title: string, startAt: Date, minutes: number, location: string, invites: Array<[string, "ACCEPTED" | "DECLINED" | "PENDING"]>) {
    await prisma.meeting.create({
      data: {
        title,
        startAt,
        durationMinutes: minutes,
        location,
        organizerId,
        invites: {
          create: [
            { userId: organizerId, status: "ACCEPTED", respondedAt: new Date() },
            ...invites.map(([userId, status]) => ({ userId, status, respondedAt: status === "PENDING" ? null : new Date() })),
          ],
        },
      },
    });
  }
  await meeting(admin.id, "每周项目例会", at(1, "10:00"), 60, "会议室 A", [[zhang.id, "ACCEPTED"], [li.id, "ACCEPTED"]]);
  await meeting(zhang.id, "Acme 月报对齐 + 下月内容排期", at(2, "14:00"), 45, "腾讯会议", [[zhao.id, "ACCEPTED"], [wang.id, "PENDING"], [admin.id, "PENDING"]]);
  await meeting(li.id, "Gamma 媒体投稿复盘", at(3, "16:00"), 30, "会议室 B", [[liu.id, "DECLINED"], [chen.id, "ACCEPTED"]]);

  // 待确认的草稿（演示“自动整理 → 确认下发”）
  await prisma.taskBatch.create({
    data: {
      projectId: beta.id,
      createdById: zhang.id,
      assigneeId: chen.id,
      dutyRole: "USER_LAYER",
      sourceText: "1. Reddit r/robotics 发帖 2 篇，DDL 10/27，约 60 分钟\n2. 回复 5 条相关讨论（截止 10.30）\n3. 整理 subreddit 清单",
      itemsJson: JSON.stringify([
        { title: "Reddit r/robotics 发帖 2 篇", dueDate: "2026-10-27", note: null, estimatedMinutes: 60 },
        { title: "回复 5 条相关讨论", dueDate: "2026-10-30", note: null, estimatedMinutes: null },
        { title: "整理 subreddit 清单", dueDate: null, note: null, estimatedMinutes: null },
      ]),
      parseMethod: "rules",
      status: "DRAFT",
      createdAt: bj("2026-10-19", "15:00"),
    },
  });

  console.log("seed done:", { users: 10, projects: 3 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
