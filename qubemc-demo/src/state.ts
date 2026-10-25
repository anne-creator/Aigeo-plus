export type Person = { id: string; name: string; role: string; initials: string; department: string; skills: string[]; availableHours: number; color: string; departmentId?: string; skillLevels?: Partial<Record<string, number>>; permissions?: string[]; availabilityDate?: string; timezone?: string };
export type Task = { id: string; title: string; ownerId: string; due: string; status: 'ready' | 'working' | 'attention'; commitment?: string };
export type ProjectInput = { id: string; title: string; brief: string; deadline: string; file: string; assets: string[] };
export type CompanyInput = {
  people: Person[];
  departments: string[];
  source?: {
    datasetId: string; companyName: string; isSynthetic: boolean;
    referenceTime: string; referenceDate: string; timezone: string;
    directory: string; resources: Record<string, string>;
  };
};
export type Issue = { taskId: string; title: string; detail: string; question: string };
export type Message = { id: string; author: 'agent' | 'worker'; personId?: string; text: string; time: string };
export type Phase = 'idle' | 'planning' | 'assigned' | 'monitoring' | 'analyzing' | 'notifying' | 'awaiting' | 'interpreting' | 'resumed';
export type AgentEvent = { id: string; runId: string } & (
  { type: 'progress'; label: string } | { type: 'planned'; tasks: Task[] } |
  { type: 'issue'; issue: Issue } | { type: 'sent'; message: Message } |
  { type: 'reply'; message: Message } | { type: 'resolved'; commitment: string; nextCheckIn?: string } |
  { type: 'failed'; message: string }
);
export type Snapshot = { version: 1; runId: string; phase: Phase; tasks: Task[]; issue?: Issue; messages: Message[]; seen: string[]; label: string; nextCheckIn?: string; error?: string };
export const initialState: Snapshot = { version: 1, runId: '', phase: 'idle', tasks: [], messages: [], seen: [], label: '' };
export type Action = { type: 'reset' } | { type: 'start'; runId: string } | { type: 'monitor' } | { type: 'check' } | { type: 'reply-start' } | { type: 'event'; event: AgentEvent };
export function reducer(s: Snapshot, a: Action): Snapshot {
  if (a.type === 'reset') return { ...initialState };
  if (a.type === 'start') return { ...initialState, runId: a.runId, phase: 'planning' };
  if (a.type === 'monitor') return s.phase === 'assigned' ? { ...s, phase: 'monitoring', tasks: s.tasks.map(t => ({ ...t, status: 'working' })) } : s;
  if (a.type === 'check') return s.phase === 'monitoring' ? { ...s, phase: 'analyzing', error: undefined } : s;
  if (a.type === 'reply-start') return s.phase === 'awaiting' ? { ...s, phase: 'interpreting', error: undefined } : s;
  const e = a.event;
  if (e.runId !== s.runId || s.seen.includes(e.id)) return s;
  const next = { ...s, seen: [...s.seen, e.id], error: undefined };
  switch (e.type) {
    case 'progress': return { ...next, label: e.label };
    case 'planned': return s.phase === 'planning' ? { ...next, phase: 'assigned', tasks: e.tasks } : s;
    case 'issue': return (s.phase === 'analyzing' || s.phase === 'monitoring') ? { ...next, phase: 'notifying', issue: e.issue, tasks: s.tasks.map(t => t.id === e.issue.taskId ? { ...t, status: 'attention' } : t) } : s;
    case 'sent': return s.phase === 'notifying' ? { ...next, phase: 'awaiting', messages: [...s.messages, e.message] } : s;
    case 'reply': return (s.phase === 'interpreting' || s.phase === 'awaiting') ? { ...next, phase: 'interpreting', messages: [...s.messages, e.message] } : s;
    case 'resolved': return s.phase === 'interpreting' && s.messages.some(m => m.author === 'worker') ? { ...next, phase: 'resumed', nextCheckIn: e.nextCheckIn, tasks: s.tasks.map(t => t.id === s.issue?.taskId ? { ...t, status: 'working', commitment: e.commitment } : t) } : s;
    case 'failed': return { ...next, error: e.message };
  }
}
export function restore(raw: string | null): Snapshot {
  if (!raw) return { ...initialState };
  try {
    const s = JSON.parse(raw) as Snapshot;
    const phases: Phase[] = ['idle','planning','assigned','monitoring','analyzing','notifying','awaiting','interpreting','resumed'];
    if (s.version !== 1 || !phases.includes(s.phase) || !Array.isArray(s.tasks) || !Array.isArray(s.messages) || !Array.isArray(s.seen) || typeof s.runId !== 'string' || s.tasks.some(t => !t || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.ownerId !== 'string' || !['ready','working','attention'].includes(t.status)) || s.messages.some(m => !m || typeof m.text !== 'string')) return { ...initialState };
    if (['planning','analyzing','notifying','interpreting'].includes(s.phase)) return { ...s, error: 'This run was interrupted. Reset to start again.' };
    return s;
  } catch { return { ...initialState }; }
}
