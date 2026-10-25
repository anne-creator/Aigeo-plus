import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { authorizeUpload } from "@/lib/upload-access";
import { verifyUploadTicket } from "@/lib/upload-ticket";

export async function POST(req: Request) {
  try {
    const body = await req.json() as HandleUploadBody;
    const response = await handleUpload({
      request: req, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getSession();
        if (!session || !clientPayload || !isSameOriginRequest(req)) throw new Error("无权上传");
        const data = await verifyUploadTicket(clientPayload, session.uid);
        if (pathname !== data.pathname) throw new Error("文件路径不匹配");
        await authorizeUpload(session, data);
        return {
          maximumSizeInBytes: data.size, addRandomSuffix: false, allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return Response.json(response);
  } catch { return Response.json({ error: "上传授权失败，请重新登录或重选文件" }, { status: 400 }); }
}
