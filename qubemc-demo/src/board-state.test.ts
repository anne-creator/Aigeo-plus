import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardReducer, initialBoard, restoreBoard, validateTasks, waitingFor, columns } from './board-state.ts';
import type { BoardEvent, BoardTask, BoardState } from './board-state.ts';
const ids = new Set(['EMP-0254', 'EMP-0308', 'EMP-0350']);
const tasks: BoardTask[] = [
  { id: 'RB-01', title: 'Launch outline', ownerId: 'EMP-0254', due: '10:00 AM', status: 'ready', requirements: 'Prepare the outline', outputs: ['outline_v1'], dependencies: [] },
  { id: 'RB-02', title: 'Direction approval', ownerId: 'EMP-0308', due: '10:30 AM', status: 'ready', requirements: 'Approve the direction', outputs: ['Approval'], dependencies: ['RB-01'] },
];
const start = () => boardReducer(initialBoard, { type: 'start', runId: 'run-1' });
const event = (s: BoardState, e: BoardEvent) => boardReducer(s, { type: 'event', event: e, employeeIds: ids });
const planned = (): BoardEvent => ({ id: 'plan', runId: 'run-1', type: 'planned', tasks: structuredClone(tasks) });
const active = () => event(start(), planned());
const update = (s: BoardState, id: string, patch: Partial<BoardTask>, eventId: string) => event(s, { id: eventId, runId: 'run-1', type: 'task.updated', task: { ...s.tasks.find(t => t.id === id)!, ...patch } });
test('intake only assigns outline and pending approval; four columns preserve waiting state', () => {
  const s = active();
  assert.equal(s.phase, 'active'); assert.deepEqual(s.tasks.map(t => t.id), ['RB-01', 'RB-02']);
  assert.deepEqual(columns.map(c => s.tasks.filter(t => t.status === c.status).length), [2, 0, 0, 0]);
  assert.deepEqual(waitingFor(s.tasks[1], s.tasks), ['RB-01']);
});
test('rejects old three-task plans, unknown employees and invalid task details atomically', () => {
  for (const proposed of [
    [...tasks, { ...tasks[0], id: 'RB-03' }],
    [tasks[0], { ...tasks[1], ownerId: 'invented' }],
    [tasks[0], { ...tasks[1], requirements: undefined }],
    [tasks[0], { ...tasks[1], dependencies: [] }],
  ]) {
    const s = event(start(), { ...planned(), tasks: proposed } as BoardEvent);
    assert.ok(s.error); assert.deepEqual(s.tasks, []);
  }
});
test('review cannot advance until outline completes; blocked never means done', () => {
  let s = active();
  s = update(s, 'RB-02', { dependencies: [] }, 'remove-gate');
  assert.deepEqual(s.tasks[1].dependencies, ['RB-01']); assert.ok(s.error);
  s = update(s, 'RB-02', { status: 'working' }, 'early');
  assert.equal(s.tasks[1].status, 'ready'); assert.ok(s.error);
  s = update(s, 'RB-01', { status: 'working', blockedReason: 'Missing product facts' }, 'blocked');
  assert.equal(s.tasks[0].status, 'working');
  s = update(s, 'RB-01', { status: 'done' }, 'bad-done');
  assert.equal(s.tasks[0].status, 'working'); assert.ok(s.error);
  s = update(s, 'RB-01', { status: 'awaiting_review', blockedReason: undefined }, 'submitted');
  assert.deepEqual(columns.map(c => s.tasks.filter(t => t.status === c.status).length), [1, 0, 1, 0]);
  s = update(s, 'RB-01', { status: 'done' }, 'approved');
  assert.deepEqual(waitingFor(s.tasks[1], s.tasks), []);
  s = update(s, 'RB-02', { status: 'working' }, 'review-start');
  assert.equal(s.tasks[1].status, 'working'); assert.equal(s.error, undefined);
});
test('ignores duplicate, previous-run and unrelated legacy events', () => {
  const p = planned(), s = event(start(), p);
  assert.equal(event(s, p), s);
  assert.equal(event(s, { ...p, id: 'old', runId: 'old' }), s);
  assert.equal(event(s, { id: 'check', runId: 'run-1', type: 'checked' } as unknown as BoardEvent), s);
  assert.equal(event(s, { id: 'p', runId: 'run-1', type: 'progress', label: {} } as unknown as BoardEvent), s);
});
test('resumes valid state, rejects old/corrupt state, marks interrupted inference', () => {
  assert.deepEqual(restoreBoard(JSON.stringify(active()), ids), JSON.parse(JSON.stringify(active())));
  assert.deepEqual(restoreBoard('{oops', ids), initialBoard);
  assert.deepEqual(restoreBoard(JSON.stringify({ ...active(), version: 1 }), ids), initialBoard);
  assert.deepEqual(restoreBoard(JSON.stringify({ ...active(), tasks: [{ ...tasks[0], ownerId: 'wrong' }, tasks[1]] }), ids), initialBoard);
  assert.ok(restoreBoard(JSON.stringify(start()), ids).error);
});
test('dependencies reject cycles, duplicate IDs, missing tasks and downstream regression', () => {
  for (const invalid of [
    [{ ...tasks[0], dependencies: ['RB-02'] }, tasks[1]],
    [tasks[0], tasks[0]],
    [tasks[0], { ...tasks[1], dependencies: ['missing'] }],
  ]) assert.throws(() => validateTasks(invalid, ids));
  let s = active();
  s = update(s, 'RB-01', { status: 'done' }, 'd');
  s = update(s, 'RB-02', { status: 'working' }, 'w');
  const before = s.tasks;
  s = update(s, 'RB-01', { status: 'ready' }, 'regression');
  assert.deepEqual(s.tasks, before); assert.ok(s.error);
});
test('runtime failure preserves visible error without any fixture fallback', () => {
  const s = event(start(), { id: 'fail', runId: 'run-1', type: 'failed', message: 'Agent disconnected' });
  assert.equal(s.error, 'Agent disconnected'); assert.deepEqual(s.tasks, []);
});
