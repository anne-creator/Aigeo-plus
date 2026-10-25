import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

for (const relative of ['../.env.local', '../../../.env']) {
  try { loadEnvFile(fileURLToPath(new URL(relative, import.meta.url))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function nemoclawSettings() {
  let mapping = {};
  if (process.env.NEMOCLAW_EMPLOYEE_MAP) {
    try { mapping = JSON.parse(process.env.NEMOCLAW_EMPLOYEE_MAP); }
    catch { throw new Error('NEMOCLAW_EMPLOYEE_MAP must be a JSON object.'); }
  }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('NEMOCLAW_EMPLOYEE_MAP must be a JSON object.');
  const channelId = process.env.NEMOCLAW_DISCORD_CHANNEL_ID;
  const sandbox = process.env.NEMOCLAW_SANDBOX || 'cofloor';
  const sshTarget = process.env.NEMOCLAW_SSH_TARGET || '';
  const sshControlPath = process.env.NEMOCLAW_SSH_CONTROL_PATH || '';
  return { channelId, sandbox, sshTarget, sshControlPath, mapping, configured: Boolean(/^\d+$/.test(channelId ?? '') && /^[a-zA-Z0-9_-]+$/.test(sandbox) && (!sshTarget || /^[a-zA-Z0-9_.@-]+$/.test(sshTarget)) && Object.keys(mapping).length) };
}
