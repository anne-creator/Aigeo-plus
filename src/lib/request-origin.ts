/** Next.js may construct req.url with an internal hostname behind a reverse proxy. */
export function isSameOriginRequest(req: Request) {
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host") || new URL(req.url).host;
    return ["http:", "https:"].includes(origin.protocol) && origin.host === host;
  } catch { return false; }
}
