import * as legacy from './agent';
import type { CompanyInput } from './state';
import type { DocumentProject } from './redbull-project';
import type { BoardEvent, BoardTask } from './board-state';

export type IntakeInput = { project: DocumentProject; company: CompanyInput; runId: string };
export interface BoardAdapter {
  mode: 'development' | 'live';
  start(input: IntakeInput, signal: AbortSignal): AsyncIterable<BoardEvent>;
  subscribe?(onEvent: (event: BoardEvent) => void): () => void;
}
declare global { interface Window { cofloorBoardAgent?: BoardAdapter } }
// Optional hooks preserve a separately supplied local-model integration without
// making that service part of this frontend feature or requiring it to exist.
const hooks = legacy as typeof legacy & { setModelConfigured?: (configured: boolean) => void };
export function configureRuntime(configured: boolean) { hooks.setModelConfigured?.(configured); }
export const hasRuntime = () => window.cofloorBoardAgent?.mode === 'live' || legacy.hasLiveAdapter();
export const referenceTasks: BoardTask[] = [
  { id: 'RB-01', title: 'Launch outline', ownerId: 'EMP-0254', due: '10:00 AM', status: 'ready',
    requirements: 'Write a one-page outline for the Red Bull Citrus Edition X launch: objective, audience, main message, visual direction, locked image headline, CTA and deliverables.',
    outputs: ['outline_v1'], dependencies: [] },
  { id: 'RB-02', title: 'Direction approval', ownerId: 'EMP-0308', due: '10:30 AM', status: 'ready',
    requirements: 'Review outline_v1 and approve the direction and locked image headline before any production tasks are created.',
    outputs: ['Approval of outline_v1 and locked image headline'], dependencies: ['RB-01'] },
];
export const referenceAgent: BoardAdapter = {
  mode: 'development',
  async *start({ runId }, signal) {
    if (signal.aborted) return;
    yield { id: crypto.randomUUID(), runId, type: 'progress', label: 'Loading document reference assignments…' };
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 650);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    yield { id: crypto.randomUUID(), runId, type: 'planned', tasks: structuredClone(referenceTasks) };
  },
};
export function getBoardAdapter(live: boolean): BoardAdapter {
  if (!live) return referenceAgent;
  if (window.cofloorBoardAgent) {
    if (window.cofloorBoardAgent.mode !== 'live') throw new Error('A live board agent is not connected.');
    return window.cofloorBoardAgent;
  }
  if (!legacy.hasLiveAdapter()) throw new Error('Local Agent is not connected. Install a live adapter before starting.');
  // The live integration must implement the documented Red Bull event contract.
  // Older three-workstream plans are rejected by the board's intake validation.
  return legacy.getAdapter(true) as unknown as BoardAdapter;
}
