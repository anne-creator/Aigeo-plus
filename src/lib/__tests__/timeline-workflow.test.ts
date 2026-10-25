import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth";

const state = vi.hoisted(() => ({ directory: "", session: { uid: "test-pm", role: "PM", name: "测试 PM", username: "test-pm" } as Session }));
vi.mock("@/lib/auth", () => ({
  requireSession: async (roles: string[]) => {
    if (!roles.includes(state.session.role) && state.session.role !== "ADMIN") throw new Error("无权操作");
    return state.session;
  },
  canAccessProject: (session: Session, project: { pmId: string }) => session.role === "ADMIN" || session.uid === project.pmId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/app/pm/_lib", () => ({
  isLiveStatus: (s: string) => ["ACTIVE", "PAUSED"].includes(s),
  timelineHref: (id: string) => "/pm/projects/" + id + "/timeline",
  canEditTimelineItem: () => false,
  canUndoTimelineItem: () => false,
}));
vi.mock("@/lib/db", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { PrismaClient } = await import("@prisma/client");
  state.directory = mkdtempSync(join(tmpdir(), "aigeo-timeline-test-"));
  const url = "file:" + join(state.directory, "test.db");
  writeFileSync(join(state.directory, "test.db"), "");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

import { prisma } from "@/lib/db";
import { importTimelineAction, saveTimelineAction, submitTimelineRevisionAction } from "@/app/pm/projects/[id]/timeline/actions";
import { approveTimelineRevision } from "@/lib/timeline";
import { getClientView } from "@/lib/client-view";

const projectId = "timeline-workflow-test";
function form(rows: Array<[string, string]>) {
  const data = new FormData();
  data.set("projectId", projectId); data.set("confirmed", "yes"); data.set("reason", "调整第二波发布时间");
  for (const [date, title] of rows) { data.append("dueDate", date); data.append("title", title); }
  return data;
}
beforeAll(async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  await prisma.user.createMany({ data: [
    { id: "test-pm", username: "test-pm", name: "测试 PM", role: "PM", passwordHash: "unused" },
    { id: "test-admin", username: "test-admin", name: "测试管理员", role: "ADMIN", passwordHash: "unused" },
  ] });
  await prisma.project.create({ data: { id: projectId, clientName: "测试", websiteUrl: "", startDate: "2026-10-01", planTier: "GROW", monthlyFeeUsd: 1, contractMonths: 3, pmId: "test-pm" } });
});
afterAll(async () => {
  await prisma.$disconnect();
  const { rm } = await import("node:fs/promises");
  await rm(state.directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe.sequential("timeline 从草稿到客户横轴", () => {
  it("未确认前仅提取，不写入节点或客户视图", async () => {
    const data = new FormData(); data.set("projectId", projectId);
    data.set("file", new File(["2026-11-02 Readiness 发布\n2026-11-09 第二波发布"], "timeline.txt"));
    const r = await importTimelineAction(data);
    expect(r.result?.items).toHaveLength(2);
    expect(await prisma.timelineItem.count({ where: { projectId } })).toBe(0);
    expect((await getClientView(projectId))?.phases).toEqual([]);
    const unconfirmed = form([["2026-11-02", "Readiness 发布"]]); unconfirmed.delete("confirmed");
    expect((await saveTimelineAction({ error: null }, unconfirmed)).error).toContain("勾选确认");
  });
  it("首次确认写入客户横轴，重复确认不会重复添加", async () => {
    const data = form([["2026-11-02", "Readiness 发布"], ["2026-11-09", "第二波发布"]]);
    await expect(saveTimelineAction({ error: null }, data)).rejects.toThrow("REDIRECT:");
    const view = await getClientView(projectId);
    expect(view?.phases.flatMap((g) => g.steps).map((s) => s.title)).toEqual(["Readiness 发布", "第二波发布"]);
    expect((await saveTimelineAction({ error: null }, data)).error).toContain("修改申请");
    expect(await prisma.timelineItem.count({ where: { projectId } })).toBe(2);
  });
  it("后续修改先审批，待审批不改变客户计划，批准后生效且保留已完成节点", async () => {
    const done = await prisma.timelineItem.findFirstOrThrow({ where: { projectId, title: "Readiness 发布" } });
    await prisma.timelineItem.update({ where: { id: done.id }, data: { completedAt: new Date(), completedById: "test-pm" } });
    await expect(submitTimelineRevisionAction({ error: null }, form([["2026-11-23", "第二波发布"]]))).rejects.toThrow("REDIRECT:");
    const pending = await prisma.timelineRevision.findFirstOrThrow({ where: { projectId, status: "PENDING" } });
    const before = await getClientView(projectId);
    expect(before?.timeline.find((i) => i.title === "第二波发布")?.dueDate).toBe("2026-11-09");
    await approveTimelineRevision(pending.id, "test-admin", null);
    const after = await getClientView(projectId);
    expect(after?.timeline.find((i) => i.title === "第二波发布")?.dueDate).toBe("2026-11-23");
    expect(after?.timeline.find((i) => i.title === "Readiness 发布")?.done).toBe(true);
    expect(after?.phases.flatMap((g) => g.steps).find((s) => s.title === "第二波发布")?.dueDate).toBe("2026-11-23");
  });
  it("其他项目经理不能上传或确认本项目的计划", async () => {
    state.session = { ...state.session, uid: "other-pm" };
    const data = form([["2026-11-25", "第三波"]]);
    data.set("file", new File(["2026-11-25 第三波"], "timeline.txt"));
    expect((await importTimelineAction(data)).error).toContain("无权");
    expect((await saveTimelineAction({ error: null }, data)).error).toContain("无权");
    expect((await submitTimelineRevisionAction({ error: null }, data)).error).toContain("无权");
  });
});
