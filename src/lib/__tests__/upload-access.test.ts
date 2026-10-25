import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "../auth";
const db = vi.hoisted(() => ({ project: { findUnique: vi.fn() }, internTask: { findUnique: vi.fn() }, deliverable: { findUnique: vi.fn() } }));
vi.mock("../db", () => ({ prisma: db }));
vi.mock("../auth", () => ({ canAccessProject: (s: Session, p: { pmId: string }) => s.role === "ADMIN" || p.pmId === s.uid }));
import { authorizeUpload } from "../upload-access";
const pm = { uid: "pm", role: "PM", name: "PM", username: "pm" } as Session;
const input = { purpose: "timeline" as const, targetId: "project", fileName: "timeline.pdf", size: 100, type: "application/pdf" };
beforeEach(() => { vi.resetAllMocks(); });
it("项目经理只能为自己的项目申请上传，渠道用户不能申请", async () => {
  db.project.findUnique.mockResolvedValue({ pmId: "pm" });
  await expect(authorizeUpload(pm, input)).resolves.toBeUndefined();
  await expect(authorizeUpload({ ...pm, uid: "other" }, input)).rejects.toThrow("无权");
  await expect(authorizeUpload({ ...pm, role: "CHANNEL" }, input)).rejects.toThrow("无权");
});
it("时间轴上传格式和 15 MB 限制在签发前验证", async () => {
  db.project.findUnique.mockResolvedValue({ pmId: "pm" });
  await expect(authorizeUpload(pm, { ...input, size: 16 * 1024 * 1024 })).rejects.toThrow("15 MB");
  await expect(authorizeUpload(pm, { ...input, fileName: "run.exe" })).rejects.toThrow("格式");
});
it("交付物必须是 FILE 节点且项目属于当前经理", async () => {
  db.deliverable.findUnique.mockResolvedValue({ kind: "FILE", project: { pmId: "other" } });
  await expect(authorizeUpload(pm, { ...input, purpose: "deliverable" })).rejects.toThrow("无权");
  db.deliverable.findUnique.mockResolvedValue({ kind: "TEXT", project: { pmId: "pm" } });
  await expect(authorizeUpload(pm, { ...input, purpose: "deliverable" })).rejects.toThrow("无权");
});
it("负责人只可上传分配给自己的任务，管理员可代操作", async () => {
  db.internTask.findUnique.mockResolvedValue({ assigneeId: "intern-1" });
  const taskInput = { ...input, purpose: "task-delivery" as const };
  await expect(authorizeUpload({ ...pm, uid: "intern-1", role: "INTERN" }, taskInput)).resolves.toBeUndefined();
  await expect(authorizeUpload({ ...pm, uid: "intern-2", role: "INTERN" }, taskInput)).rejects.toThrow("无权");
  await expect(authorizeUpload({ ...pm, role: "ADMIN" }, taskInput)).resolves.toBeUndefined();
});
