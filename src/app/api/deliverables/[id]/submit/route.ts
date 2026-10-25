import { after, NextResponse, type NextRequest } from "next/server";
import { runAiReview } from "@/lib/ai-review";
import { z } from "zod";
import { canAccessProject, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES, saveUpload, fileFromForm } from "@/lib/files";

const textSchema = z.string().trim().min(1, "请填写文字内容").max(20_000, "文字内容请控制在 2 万字以内");
const noteSchema = z.string().trim().max(300, "备注请控制在 300 字以内");

/** 只接受站内相对路径（禁止 //host 与 /\host 形式），并且解析后必须仍在本站 */
function safeBack(raw: string, reqUrl: string, fallback: string): string {
  if (!/^\/(?![\/\\])/.test(raw)) return fallback;
  try {
    const u = new URL(raw, reqUrl);
    if (u.origin !== new URL(reqUrl).origin) return fallback;
    return u.pathname + u.search;
  } catch {
    return fallback;
  }
}

/**
 * 项目经理提交材料（文件或文字）。multipart/form-data：
 * - text: 文字内容（TEXT 类节点）
 * - file: 文件（FILE 类节点）
 * - note: 备注（选填）
 * - redirect: 提交后跳转地址（选填，默认回项目页）
 * 只追加新版本；首次提交时间只记录一次；提交后审核状态置为 PENDING。
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/deliverables/[id]/submit">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const deliverable = await prisma.deliverable.findUnique({ where: { id }, include: { project: true } });
  if (!deliverable) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
  if (!canAccessProject(session, deliverable.project)) return NextResponse.json({ error: "无权操作" }, { status: 403 });

  const fallback = `/pm/projects/${deliverable.projectId}`;
  let back = fallback;
  const fail = (msg: string) =>
    new NextResponse(null, { status: 303, headers: { Location: `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}` } });

  // 先按 Content-Length 拒绝明显超限的请求，避免把超大请求体整个读进内存
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 1_000_000) return fail("文件超过 50MB");

  const form = await req.formData();
  back = safeBack(String(form.get("redirect") ?? ""), req.url, fallback);
  const noteParsed = noteSchema.safeParse(String(form.get("note") ?? ""));
  if (!noteParsed.success) return fail(noteParsed.error.issues[0]?.message ?? "备注不合法");
  const note = noteParsed.data || null;

  if (deliverable.project.status === "TERMINATED" || deliverable.project.status === "COMPLETED") {
    return fail("项目已终止或已完成，不能再提交材料");
  }
  const assessment = await prisma.quarterAssessment.findUnique({
    where: { projectId_quarter: { projectId: deliverable.projectId, quarter: deliverable.quarter } },
    select: { finalizedAt: true },
  });
  if (assessment?.finalizedAt) {
    return fail("该季度已结算固化，不能再提交材料；如需补交请联系管理员撤销结算");
  }

  let textContent: string | null = null;
  let fileInfo: { relPath: string; fileName: string; size: number; mimeType: string } | null = null;

  if (deliverable.kind === "TIMELINE") {
    return fail("项目 timeline 请在项目的 timeline 页面维护，保存条目即视为提交");
  }
  if (deliverable.kind === "TEXT") {
    const parsed = textSchema.safeParse(String(form.get("text") ?? ""));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "文字内容不合法");
    textContent = parsed.data;
  } else {
    try {
      const file = await fileFromForm(form, session.uid, "deliverable", id);
      if (!file) return fail("请选择要上传的文件");
      const saved = await saveUpload(file, `${deliverable.projectId}/${deliverable.id}`);
      fileInfo = { ...saved, mimeType: file.type || "application/octet-stream" };
    } catch (e) {
      return fail(e instanceof Error ? e.message : "上传失败");
    }
  }

  const now = new Date();
  const submissionId = await prisma.$transaction(async (tx) => {
    // 首次提交时间只在为空时写入一次（并发提交也不会被后来的覆盖）
    await tx.deliverable.updateMany({ where: { id, firstSubmittedAt: null }, data: { firstSubmittedAt: now } });
    const max = await tx.submission.aggregate({ where: { deliverableId: id }, _max: { version: true } });
    const created = await tx.submission.create({
      data: {
        deliverableId: id,
        submittedById: session.uid,
        submittedAt: now,
        version: (max._max.version ?? 0) + 1,
        textContent,
        fileName: fileInfo?.fileName ?? null,
        filePath: fileInfo?.relPath ?? null,
        fileSize: fileInfo?.size ?? null,
        mimeType: fileInfo?.mimeType ?? null,
        note,
      },
    });
    await tx.deliverable.update({
      where: { id },
      data: {
        reviewStatus: "PENDING",
        reviewSource: null,
        reviewDeductionPct: null,
        reviewNote: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });
    return created.id;
  });

  // 返回后在后台跑 AI 审核（未配置 API 密钥或已关闭时直接跳过，留给管理员人工审核）
  after(async () => {
    try {
      await runAiReview(submissionId);
    } catch (e) {
      console.error("[ai-review]", e);
    }
  });

  return new NextResponse(null, { status: 303, headers: { Location: `${back}${back.includes("?") ? "&" : "?"}submitted=${deliverable.id}` } });
}
