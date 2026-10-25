import { allowedRequest } from './origin.mjs';

const upstream = process.env.COFLOOR_FACE_URL || 'http://127.0.0.1:8766';
const maxBody = 12 * 1024 * 1024;

function send(res, status, data) {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

export async function faceMiddleware(req, res, next) {
  if (!req.url?.startsWith('/api/face/')) return next();
  if (!allowedRequest(req)) return send(res, 403, { error: 'Origin not allowed.' });
  const status = req.method === 'GET' && req.url === '/api/face/status';
  const recognize = req.method === 'POST' && req.url === '/api/face/recognize';
  if (!status && !recognize) return send(res, 404, { error: 'Unknown face operation.' });
  if (recognize && !req.headers['content-type']?.startsWith('application/json')) {
    return send(res, 415, { error: 'JSON is required.' });
  }
  try {
    let body;
    if (recognize) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBody) return send(res, 413, { error: 'Image request too large.' });
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const response = await fetch(`${upstream}/${status ? 'health' : 'recognize'}`, {
      method: status ? 'GET' : 'POST',
      headers: recognize ? { 'Content-Type': 'application/json' } : {},
      body,
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    send(res, response.status, result);
  } catch {
    send(res, 503, { error: 'Face service unavailable on the Spark.' });
  }
}
