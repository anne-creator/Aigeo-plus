import type { BoardState, BoardTask } from './board-state';

export type DashboardStage = 'global' | 'assigning' | 'setup-error' | 'entering' | 'project';
export function dashboardStage(state: BoardState, readyRun: string): DashboardStage {
  if (state.phase === 'planning') return state.error ? 'setup-error' : 'assigning';
  if (state.phase === 'active') return readyRun === state.runId ? 'project' : 'entering';
  return 'global';
}
export function canRevealProject(state: BoardState, completedRun: string, revealedRun: string) {
  return state.phase === 'active' && state.tasks.length > 0 && state.runId === completedRun && completedRun !== revealedRun;
}
export type TaskChange = {
  id: string; kind: 'ready' | 'created' | 'status' | 'owner' | 'blocked' | 'unblocked' | 'schedule';
  taskId?: string; title: string; status?: BoardTask['status']; ownerId?: string; previousOwnerId?: string;
  observedAt: number; count?: number;
};
export type BoardObservation = {runId: string; tasks: BoardTask[]; entries: TaskChange[]; syncedAt: number; revision: number; changedTaskIds: string[]};
export const emptyObservation: BoardObservation = {runId: '', tasks: [], entries: [], syncedAt: 0, revision: 0, changedTaskIds: []};
export function observeBoard(previous: BoardObservation, state: BoardState, observedAt: number): BoardObservation {
  if (state.phase !== 'active') return {...emptyObservation, runId: state.runId};
  const first = previous.runId !== state.runId || !previous.tasks.length;
  const revision = first ? 1 : previous.revision + 1;
  const changes: TaskChange[] = [];
  function add(change: Omit<TaskChange, 'id' | 'observedAt'>) {
    changes.push({...change, id: `${state.runId}:${revision}:${changes.length}`, observedAt});
  }
  if (first) add({kind: 'ready', title: 'Team ready', count: state.tasks.length});
  else for (const task of state.tasks) {
    const old = previous.tasks.find(t => t.id === task.id);
    if (!old) { add({kind: 'created', taskId: task.id, title: task.title}); continue; }
    const base = {taskId: task.id, title: task.title};
    if (old.ownerId !== task.ownerId) add({...base, kind: 'owner', ownerId: task.ownerId, previousOwnerId: old.ownerId});
    if (old.status !== task.status) add({...base, kind: 'status', status: task.status});
    if (task.blockedReason && task.blockedReason !== old.blockedReason) add({...base, kind: 'blocked'});
    if (old.blockedReason && !task.blockedReason) add({...base, kind: 'unblocked'});
    if (old.start !== task.start || old.end !== task.end || old.due !== task.due) add({...base, kind: 'schedule'});
  }
  return {runId: state.runId, tasks: state.tasks.map(t => ({...t})), revision, syncedAt: observedAt, changedTaskIds: [...new Set(changes.flatMap(change => change.taskId ? [change.taskId] : []))],
    entries: [...changes, ...(first ? [] : previous.entries)].slice(0, 5)};
}
