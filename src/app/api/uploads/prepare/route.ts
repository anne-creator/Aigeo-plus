import { getSession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { cloudStorageEnabled } from "@/lib/files";
import { authorizeUpload } from "@/lib/upload-access";
import { issueUploadTicket, uploadRequestSchema } from "@/lib/upload-ticket";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!isSameOriginRequest(req)) return Response.json({ error: "无效请求" }, { status: 403 });
  try {
    const input = uploadRequestSchema.parse(await req.json());
    await authorizeUpload(session, input);
    if (!cloudStorageEnabled()) return Response.json({ enabled: false });
    return Response.json({ enabled: true, ...await issueUploadTicket(session.uid, input) });
  } catch { return Response.json({ error: "无法上传：请检查项目权限、文件格式和大小后重试" }, { status: 400 }); }
}
