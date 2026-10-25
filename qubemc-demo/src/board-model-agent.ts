import type { BoardAdapter } from './redbull-agent';
import type { BoardTask } from './board-state';

export const boardModelAgent: BoardAdapter = {
  mode: 'live',
  async *start({ project, runId }, signal) {
    yield { id: crypto.randomUUID(), runId, type: 'progress', label: 'Analyzing the project document and feasible staff…' };
    const response = await fetch('/api/board/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
      signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Board model service is unavailable.');
    yield { id: crypto.randomUUID(), runId, type: 'planned', tasks: result.tasks as BoardTask[] };
    const status = await fetch('/api/discord/status', { signal }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (!status?.configured) {
      yield { id: crypto.randomUUID(), runId, type: 'notice', message: 'NemoClaw Discord is not configured; assignments have not been sent.' };
      return;
    }
    const dispatch = await fetch('/api/discord/board-dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId, tasks: result.tasks }), signal });
    const receipt = await dispatch.json().catch(() => ({}));
    yield { id: crypto.randomUUID(), runId, type: 'notice', message: dispatch.ok ? `${receipt.sent} assignments sent through NemoClaw Discord.` : `NemoClaw Discord dispatch failed: ${receipt.error || 'unknown error'}` };
  },
};
