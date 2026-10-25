import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { analyze } from './model.mjs';
import { nemoclawSettings } from './config.mjs';

const runFile = promisify(execFile);
const pending = new Map();
const dispatched = new Map();
const listeners = new Set();
const history = [];
const event = (runId, type, fields = {}) => ({ id: randomUUID(), runId, type, ...fields });
const emit = item => {
  history.push(item);
  if (history.length > 200) history.shift();
  for (const client of listeners) client.write(`data: ${JSON.stringify(item)}\n\n`);
};
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const sshArgs = (target, controlPath, command) => ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', ...(controlPath ? ['-o', `ControlPath=${controlPath}`] : []), target,
  '. "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; sg docker -c ' + quote('PATH="$HOME/.local/bin:$PATH" NEMOCLAW_DISABLE_TELEMETRY=1 ' + command.map(quote).join(' '))];

export async function probeNemoClaw(runner = runFile) {
  const { sandbox, sshTarget, sshControlPath } = nemoclawSettings();
  const command = ['nemoclaw', sandbox, 'status'];
  try {
    await runner(sshTarget ? 'ssh' : 'nemoclaw', sshTarget
      ? sshArgs(sshTarget, sshControlPath, command)
      : command.slice(1), { timeout: 12_000, maxBuffer: 1024 * 1024, env: { ...process.env, NEMOCLAW_DISABLE_TELEMETRY: '1' } });
    return true;
  } catch { return false; }
}

// Discord credentials and traffic stay inside the NemoClaw-managed sandbox.
export async function openclawMessage(args, runner = runFile) {
  const { sandbox, sshTarget, sshControlPath } = nemoclawSettings();
  const command = ['nemoclaw', sandbox, 'exec', '--', 'openclaw', 'message', ...args];
  const executable = sshTarget ? 'ssh' : 'nemoclaw';
  const argv = sshTarget
    ? sshArgs(sshTarget, sshControlPath, command)
    : command.slice(1);
  let stdout;
  try { ({ stdout } = await runner(executable, argv, { timeout: 45_000, maxBuffer: 1024 * 1024, env: { ...process.env, NEMOCLAW_DISABLE_TELEMETRY: '1' } })); }
  catch { throw new Error('NemoClaw message command failed. Check the sandbox, Discord channel, and SSH connection.'); }
  try {
    const result = JSON.parse(stdout);
    if (result?.ok === false) throw new Error('NemoClaw reported a delivery failure.');
    return result;
  } catch (error) {
    if (error?.message === 'NemoClaw reported a delivery failure.') throw error;
    throw new Error('NemoClaw returned an unreadable message result.');
  }
}

export async function runNemoClawAgent(prompt, runId, signal, runner = runFile) {
  if (typeof prompt !== 'string' || prompt.length > 150_000 || !/^[a-zA-Z0-9-]{1,80}$/.test(runId)) throw new Error('Invalid NemoClaw agent request.');
  const { sandbox, sshTarget, sshControlPath } = nemoclawSettings();
  const command = ['nemoclaw', sandbox, 'exec', '--', 'openclaw', 'agent', '--agent', 'main', '--session-key', `cofloor-${runId}`, '--message', prompt, '--timeout', '180', '--json'];
  const executable = sshTarget ? 'ssh' : 'nemoclaw';
  const argv = sshTarget
    ? sshArgs(sshTarget, sshControlPath, command)
    : command.slice(1);
  let stdout;
  try { ({ stdout } = await runner(executable, argv, { timeout: 210_000, signal, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, NEMOCLAW_DISABLE_TELEMETRY: '1' } })); }
  catch { throw new Error('NemoClaw agent turn failed. Check the sandbox and inference route.'); }
  let result;
  try { result = JSON.parse(stdout); } catch { throw new Error('NemoClaw returned unreadable agent output.'); }
  if (result?.ok === false || result?.status === 'error') throw new Error('NemoClaw agent did not complete the plan.');
  const text = result?.final ?? result?.payloads?.map(item => item.text).filter(Boolean).join('\n') ?? result?.result?.payloads?.map(item => item.text).filter(Boolean).join('\n');
  if (typeof text !== 'string' || !text.trim()) throw new Error('NemoClaw agent returned no final answer.');
  return text;
}

function messageId(result) {
  const id = result?.id ?? result?.messageId ?? result?.message_id ?? result?.message?.id ?? result?.result?.id ?? result?.result?.messageId;
  if (!/^\d+$/.test(String(id ?? ''))) throw new Error('NemoClaw did not confirm a Discord message ID.');
  return String(id);
}
function messagesOf(result) {
  const messages = Array.isArray(result) ? result : result?.messages ?? result?.result?.messages ?? result?.data?.messages;
  if (!Array.isArray(messages)) throw new Error('NemoClaw returned an unreadable Discord message list.');
  return messages;
}
function requireMapping(ownerId) {
  const settings = nemoclawSettings();
  if (!settings.configured) throw new Error('NemoClaw Discord settings are incomplete.');
  const userId = settings.mapping[ownerId];
  if (!/^\d+$/.test(String(userId ?? ''))) throw new Error(`No Discord user ID is mapped for ${ownerId}.`);
  return { settings, userId: String(userId) };
}

export async function sendDecisionRequest({ runId, state, issue, message, projectTitle }, command = openclawMessage) {
  if (typeof runId !== 'string' || runId !== state?.runId || !Array.isArray(state.tasks) || !state.tasks.some(task => task.id === issue?.taskId)) throw new Error('Invalid Discord decision request.');
  if (typeof message !== 'string' || !message.trim() || message.length > 1500) throw new Error('Invalid Discord message.');
  const ownerId = state.tasks.find(task => task.id === issue.taskId).ownerId;
  const { settings, userId } = requireMapping(ownerId);
  const content = `<@${userId}> — CoFloor needs a decision for ${String(projectTitle || 'the project').slice(0, 100)}.\n${message.trim()}\nReply directly to this message.`;
  const sent = await command(['send', '--channel', 'discord', '--target', `channel:${settings.channelId}`, '--message', content, '--json']);
  const id = messageId(sent);
  pending.set(runId, { state: { ...state, issue }, ownerId, userId, messageId: id, after: id, processing: false });
  return { id, author: 'agent', text: content, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), delivery: 'sent' };
}

export async function dispatchBoard({ runId, tasks }, command = openclawMessage) {
  if (typeof runId !== 'string' || !runId || !Array.isArray(tasks) || tasks.length !== 2 || new Set(tasks.map(t => t.id)).size !== 2 || !tasks.every(t => ['RB-01','RB-02'].includes(t.id) && typeof t.requirements === 'string' && t.requirements.length <= 1000)) throw new Error('Invalid board dispatch.');
  const previous = dispatched.get(runId) ?? new Map();
  if (previous.size === 2) return { sent: 0, duplicate: true, receipts: [...previous].map(([taskId, messageId]) => ({ taskId, messageId })) };
  const receipts = [];
  for (const task of tasks) {
    if (previous.has(task.id)) continue;
    const { settings, userId } = requireMapping(task.ownerId);
    const content = `<@${userId}> — CoFloor assigned ${task.id}: ${task.title}. Due ${task.due}.\n${task.requirements}${task.dependencies?.length ? `\nStarts after ${task.dependencies.join(', ')} is complete.` : ''}`;
    const result = await command(['send', '--channel', 'discord', '--target', `channel:${settings.channelId}`, '--message', content, '--json']);
    const id = messageId(result);
    previous.set(task.id, id);
    dispatched.set(runId, previous);
    receipts.push({ taskId: task.id, messageId: id });
  }
  return { sent: receipts.length, receipts };
}

export async function pollNemoClaw(command = openclawMessage) {
  const settings = nemoclawSettings();
  if (!settings.configured) return;
  for (const [runId, item] of pending) {
    if (item.processing) continue;
    item.processing = true;
    try {
      const result = await command(['read', '--channel', 'discord', '--target', `channel:${settings.channelId}`, '--after', item.after, '--limit', '100', '--json']);
      const messages = messagesOf(result).toSorted((a,b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
      for (const message of messages) {
        if (!/^\d+$/.test(String(message.id))) continue;
        item.after = String(message.id);
        if (message.message_reference?.message_id !== item.messageId || String(message.author?.id) !== item.userId || message.author?.bot || !message.content?.trim()) continue;
        const reply = { id: String(message.id), author: 'worker', personId: item.ownerId, text: message.content.trim(), time: new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), delivery: 'received' };
        emit({ id: `discord-${message.id}`, runId, type: 'reply', message: reply });
        const result = await analyze('decision', { state: item.state, text: reply.text }, new AbortController().signal);
        if (result.accepted) {
          emit(event(runId, 'resolved', { commitment: result.commitment, nextCheckIn: result.nextCheckIn }));
          pending.delete(runId);
          break;
        }
        emit(event(runId, 'pending', { note: result.note }));
      }
    } catch (error) {
      emit(event(runId, 'failed', { message: error instanceof Error ? error.message : 'NemoClaw reply check failed.' }));
      pending.delete(runId);
    } finally { item.processing = false; }
  }
}
setInterval(() => { void pollNemoClaw(); }, 5_000).unref();

export function nemoclawMiddleware(req, res, next) {
  if (!req.url?.startsWith('/api/discord/')) return next();
  const send = (code, body) => { if (!res.destroyed) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); } };
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) return send(403, { error: 'Origin not allowed.' });
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Origin not allowed.' });
  if (req.method === 'GET' && req.url === '/api/discord/status') return send(200, { configured: nemoclawSettings().configured, transport: 'nemoclaw' });
  if (req.method === 'GET' && req.url === '/api/discord/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    listeners.add(res);
    for (const item of history) res.write(`data: ${JSON.stringify(item)}\n\n`);
    const keepalive = setInterval(() => res.write(': keepalive\n\n'), 20_000);
    req.on('close', () => { listeners.delete(res); clearInterval(keepalive); });
    return;
  }
  if (req.method !== 'POST' || !['/api/discord/send','/api/discord/board-dispatch'].includes(req.url)) return send(404, { error: 'Unknown Discord operation.' });
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON is required.' });
  let body = '', size = 0;
  req.on('data', chunk => { size += chunk.length; if (size > 65536) { send(413, { error: 'Request too large.' }); req.destroy(); } else body += chunk; });
  req.on('end', async () => {
    if (size > 65536) return;
    try {
      const input = JSON.parse(body);
      send(200, req.url === '/api/discord/send' ? { message: await sendDecisionRequest(input) } : await dispatchBoard(input));
    } catch (error) {
      const message = error instanceof Error && /^(NemoClaw |No Discord |Invalid )/.test(error.message) ? error.message : 'NemoClaw Discord delivery failed.';
      send(502, { error: message });
    }
  });
}
