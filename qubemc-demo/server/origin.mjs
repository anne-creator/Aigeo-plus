export function allowedRequest(req) {
  const host = req.headers.host || '';
  const local = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
  const publicOrigin = process.env.COFLOOR_PUBLIC_ORIGIN;
  const expected = local ? `http://${host}` : publicOrigin;
  if (!expected) return false;
  try { if (new URL(expected).host !== host) return false; } catch { return false; }
  return !req.headers.origin || req.headers.origin === expected;
}
