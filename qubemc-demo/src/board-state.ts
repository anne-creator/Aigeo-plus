export type TaskStatus = 'ready' | 'working' | 'awaiting_review' | 'done';
export type BoardTask = {
  id: string; title: string; ownerId: string; due: string; status: TaskStatus;
  requirements: string; outputs: string[]; dependencies: string[]; blockedReason?: string;
};
export type BoardEvent = { id: string; runId: string } & (
  { type: 'progress'; label: string } | { type: 'planned'; tasks: BoardTask[] } |
  { type: 'task.updated'; task: BoardTask } | { type: 'failed'; message: string }
);
export type BoardState = {
  version: 2; runId: string; phase: 'idle' | 'planning' | 'active';
  tasks: BoardTask[]; seen: string[]; label: string; activity: string[]; error?: string;
};
export const initialBoard: BoardState = { version: 2, runId: '', phase: 'idle', tasks: [], seen: [], label: '', activity: [] };
export const columns: { status: TaskStatus; label: string; empty: string }[] = [
  { status: 'ready', label: 'To do', empty: 'No tasks waiting to start' },
  { status: 'working', label: 'In progress', empty: 'Work will appear here when it starts' },
  { status: 'awaiting_review', label: 'In review', empty: 'Submitted work will appear here' },
  { status: 'done', label: 'Done', empty: 'Completed tasks will appear here' },
];
export function isTask(value: unknown): value is BoardTask {
  if (!value || typeof value !== 'object') return false;
  const t = value as BoardTask;
  return ['id','title','ownerId','due','requirements'].every(k => typeof t[k as keyof BoardTask] === 'string' && Boolean(t[k as keyof BoardTask])) &&
    columns.some(c => c.status === t.status) && Array.isArray(t.outputs) && t.outputs.every(x => typeof x === 'string') &&
    Array.isArray(t.dependencies) && t.dependencies.every(x => typeof x === 'string') &&
    (t.blockedReason === undefined || typeof t.blockedReason === 'string');
}
export function waitingFor(task: BoardTask, tasks: BoardTask[]): string[] {
  return task.dependencies.filter(id => tasks.find(t => t.id === id)?.status !== 'done');
}
export function validateTasks(tasks: unknown, employeeIds: ReadonlySet<string>): asserts tasks is BoardTask[] {
  if (!Array.isArray(tasks) || !tasks.length || !tasks.every(isTask)) throw new Error('Agent returned invalid task details. No assignments were saved.');
  if (new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('Agent returned duplicate tasks.');
  for (const t of tasks) {
    if (!employeeIds.has(t.ownerId)) throw new Error(`Unknown employee ID: ${t.ownerId}. No assignments were saved.`);
    if (t.dependencies.some(id => id === t.id || !tasks.some(other => other.id === id))) throw new Error('Agent returned invalid task dependencies.');
    if (waitingFor(t, tasks).length && t.status !== 'ready') throw new Error('A task cannot advance before its dependencies complete.');
    if (t.blockedReason && t.status === 'done') throw new Error('A blocked task cannot be completed.');
  }
  const validatedTasks: BoardTask[] = tasks;
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('Agent returned circular task dependencies.');
    if (visited.has(id)) return;
    visiting.add(id); validatedTasks.find(t => t.id === id)!.dependencies.forEach(visit); visiting.delete(id); visited.add(id);
  }
  tasks.forEach(t => visit(t.id));
}
function validateScenarioGraph(tasks: BoardTask[]) {
  if (tasks.length !== 2 || !tasks.some(t => t.id === 'RB-01') || !tasks.some(t => t.id === 'RB-02')) throw new Error('Red Bull intake requires only RB-01 and RB-02. Update the runtime to the Red Bull contract.');
  const outline = tasks.find(t => t.id === 'RB-01')!, review = tasks.find(t => t.id === 'RB-02')!;
  if (outline.dependencies.length || review.dependencies.length !== 1 || review.dependencies[0] !== 'RB-01') throw new Error('Direction approval must depend on the launch outline.');
}
export function validateIntake(tasks: BoardTask[]) {
  validateScenarioGraph(tasks);
  if (tasks.some(t => t.status !== 'ready')) throw new Error('Intake must start with an outline and a direction approval waiting for that outline.');
}
export type BoardAction = { type: 'start'; runId: string } | { type: 'reset' } | { type: 'event'; event: BoardEvent; employeeIds: ReadonlySet<string> };
export function boardReducer(s: BoardState, a: BoardAction): BoardState {
  if (a.type === 'reset') return { ...initialBoard };
  if (a.type === 'start') return { ...initialBoard, phase: 'planning', runId: a.runId };
  const e = a.event;
  if (!e || typeof e.id !== 'string' || !e.id || e.runId !== s.runId || s.seen.includes(e.id)) return s;
  const next = { ...s, seen: [...s.seen, e.id] };
  try {
    switch (e.type) {
      case 'progress': return s.phase === 'planning' && typeof e.label === 'string' ? { ...next, label: e.label } : s;
      case 'failed': return typeof e.message === 'string' ? { ...next, error: e.message, activity: [...s.activity, e.message] } : s;
      case 'planned': {
        if (s.phase !== 'planning') return s;
        validateTasks(e.tasks, a.employeeIds); validateIntake(e.tasks);
        return { ...next, phase: 'active', tasks: e.tasks, error: undefined, activity: [...s.activity, 'Outline and direction approval assigned.'] };
      }
      case 'task.updated': {
        if (s.phase !== 'active' || !s.tasks.some(t => t.id === e.task.id)) return s;
        const tasks = s.tasks.map(t => t.id === e.task.id ? e.task : t);
        validateTasks(tasks, a.employeeIds); validateScenarioGraph(tasks);
        return { ...next, tasks, error: undefined, activity: [...s.activity, `${e.task.id} · ${columns.find(c => c.status === e.task.status)!.label}`] };
      }
      default: return s;
    }
  } catch (error) { return { ...next, error: error instanceof Error ? error.message : 'Invalid Agent result.' }; }
}
export function restoreBoard(raw: string | null, employeeIds: ReadonlySet<string>): BoardState {
  try {
    if (!raw) return { ...initialBoard };
    const s = JSON.parse(raw) as BoardState;
    if (s.version !== 2 || !['idle','planning','active'].includes(s.phase) || typeof s.runId !== 'string' || typeof s.label !== 'string' ||
      !Array.isArray(s.seen) || !s.seen.every(x => typeof x === 'string') || !Array.isArray(s.activity) || !s.activity.every(x => typeof x === 'string') ||
      (s.error !== undefined && typeof s.error !== 'string')) return { ...initialBoard };
    if (s.phase === 'active') { validateTasks(s.tasks, employeeIds); validateScenarioGraph(s.tasks); }
    else if (!Array.isArray(s.tasks) || s.tasks.length) return { ...initialBoard };
    return s.phase === 'planning' ? { ...s, error: 'This run was interrupted. Reset to start again.' } : s;
  } catch { return { ...initialBoard }; }
}
