import type { AgentEvent, CompanyInput, ProjectInput, Snapshot } from './state';
import { company, demoOwners } from './data';
export interface AgentAdapter {
  mode: 'development' | 'live';
  subscribe?(onEvent: (event: AgentEvent) => void): () => void;
  start(input: { project: ProjectInput; company: CompanyInput; runId: string }, signal: AbortSignal): AsyncIterable<AgentEvent>;
  check(input: { project: ProjectInput; company: CompanyInput; state: Snapshot; observation: string }, signal: AbortSignal): AsyncIterable<AgentEvent>;
  receiveDecision(input: { state: Snapshot; text: string }, signal: AbortSignal): AsyncIterable<AgentEvent>;
}
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
  const done = () => { signal.removeEventListener('abort', abort); resolve(); };
  const timer = setTimeout(done, ms);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
});
const base = (runId: string) => ({ id: crypto.randomUUID(), runId });
const time = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
// Development fixtures only. Replace this adapter with the local runtime, not UI code.
export const mockAgent: AgentAdapter = {
  mode: 'development',
  async *start({ runId }, signal) {
    yield { ...base(runId), type: 'progress', label: 'Reading your brief…' };
    await pause(1000, signal);
    yield { ...base(runId), type: 'progress', label: 'Putting the right team together…' };
    await pause(1400, signal);
    yield { ...base(runId), type: 'planned', tasks: [
      { id: 'copy', title: 'Social copy', ownerId: demoOwners.copy, due: '1:00 PM', status: 'ready' },
      { id: 'visual', title: 'Key visual', ownerId: demoOwners.visual, due: '3:00 PM', status: 'ready' },
      { id: 'lead', title: 'Project coordination', ownerId: demoOwners.lead, due: '4:00 PM', status: 'ready' },
    ] };
  },
  async *check({ state }, signal) {
    const task = state.tasks.find(t => t.id === 'visual');
    const owner = company.people.find(p => p.id === task?.ownerId);
    if (!owner) throw new Error('The task owner is not in the imported employee directory.');
    yield { ...base(state.runId), type: 'progress', label: 'Checking the latest update…' };
    await pause(1100, signal);
    yield { ...base(state.runId), type: 'issue', issue: { taskId: 'visual', title: 'Product photography delayed', detail: 'Product photography is arriving late. The 3 PM visual is at risk.', question: 'Can you use the approved product render for the first draft and keep the 3 PM delivery?' } };
    await pause(900, signal);
    yield { ...base(state.runId), type: 'sent', message: { id: crypto.randomUUID(), author: 'agent', text: `${owner.name.split(' ')[0]}, product photography is delayed. Can you use the approved product render for the first draft and keep the 3 PM delivery?`, time: time() } };
  },
  async *receiveDecision({ state, text }, signal) {
    yield { ...base(state.runId), type: 'reply', message: { id: crypto.randomUUID(), author: 'worker', personId: state.tasks.find(t => t.id === state.issue?.taskId)?.ownerId, text, time: time() } };
    await pause(900, signal);
    yield { ...base(state.runId), type: 'resolved', commitment: 'First draft with approved render · 3:00 PM', nextCheckIn: '2:30 PM' };
  },
};
// No protocol is assumed. A future local adapter implements AgentAdapter.
// Choosing live without an injected runtime fails explicitly; it never falls back to mock.
declare global {
  interface Window {
    cofloorAgent?: AgentAdapter;
    /** @deprecated Install new integrations as window.cofloorAgent. */
    qubemcAgent?: AgentAdapter;
  }
}
const liveAdapter = () => window.cofloorAgent ?? window.qubemcAgent;
export const hasLiveAdapter = () => liveAdapter()?.mode === 'live';
export function getAdapter(live: boolean): AgentAdapter {
  if (!live) return mockAgent;
  const adapter = liveAdapter();
  if (adapter?.mode !== 'live') throw new Error('Local Agent is not connected. Add the local runtime adapter before starting a live run.');
  return adapter;
}
