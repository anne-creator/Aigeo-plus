import { allowedRequest } from './origin.mjs';

export const SPEECH_URL = 'http://100.89.121.112:8004/v1/audio/speech';
const MAX_AUDIO = 20 * 1024 * 1024;

export function createSpeechMiddleware({ request = fetch, timeout = 180000 } = {}) {
  return async function speechMiddleware(req, res, next) {
    if (req.url !== '/api/speech') return next();
    const error = (status, message) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: message }));
    };
    if (!allowedRequest(req)) return error(403, 'Origin not allowed.');
    if (req.method !== 'POST') return error(405, 'POST is required.');
    if (!req.headers['content-type']?.startsWith('application/json')) return error(415, 'JSON is required.');
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    let timer;
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32768) return error(413, 'Speech request is too large.');
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return error(400, 'Invalid JSON.'); }
      if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 8000) return error(400, 'Speech text must contain 1 to 8000 characters.');
      timer = setTimeout(() => abort.abort(), timeout);
      // Native fetch uses the pinned private destination; redirects are never followed.
      const response = await request(SPEECH_URL, {
        method: 'POST', redirect: 'error', signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: body.text.trim(), voice: 'Ryan', response_format: 'wav' }),
      });
      if (!response.ok || !response.body) throw new Error('Speech failed');
      const reader = response.body.getReader();
      const audioChunks = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > MAX_AUDIO) throw new Error('Audio too large');
          audioChunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel(); }
      const audio = Buffer.concat(audioChunks);
      if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid WAV');
      if (!res.destroyed) {
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'Content-Length': audio.length });
        res.end(audio);
      }
    } catch {
      error(abort.signal.aborted ? 504 : 502, 'Local speech is unavailable. You can retry; project work continues.');
    } finally { clearTimeout(timer); }
  };
}

export const speechMiddleware = createSpeechMiddleware();
