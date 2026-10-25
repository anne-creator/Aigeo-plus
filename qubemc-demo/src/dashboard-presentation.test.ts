import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard } from './board-state.ts';
import type { BoardState, BoardTask } from './board-state';
import { dashboardStage, canRevealProject, observeBoard, emptyObservation } from './dashboard-presentation.ts';
const task = (id: string, extra: Partial<BoardTask> = {}): BoardTask => ({id, title:id,ownerId:'writer',status:'ready',due:'4:00 PM',start:'13:00',end:'14:00',requirements:'Write copy',outputs:['copy'],dependencies:[],skill:'social_copy',assignmentVersion:1,...extra});
const active = (tasks: BoardTask[], runId='one'): BoardState => ({...initialBoard,phase:'active',runId,tasks});

test('assignment waits for valid allocation and scene completion; errors remain in setup', () => {
  assert.equal(dashboardStage(initialBoard,''),'global');
  const planning: BoardState = {...initialBoard,phase:'planning',runId:'one'};
  assert.equal(dashboardStage(planning,''),'assigning');
  assert.equal(dashboardStage({...planning,error:'Unavailable'},''),'setup-error');
  const state = active([task('a')]);
  assert.equal(dashboardStage(state,''),'entering');
  assert.equal(dashboardStage(state,'one'),'project');
  assert.equal(canRevealProject(planning,'one',''),false);
  assert.equal(canRevealProject(state,'old',''),false);
  assert.equal(canRevealProject(state,'one',''),true);
  assert.equal(canRevealProject(state,'one','one'),false); // Refresh must not reopen a manually hidden panel.
  assert.equal(canRevealProject(active([]),'one',''),false);
  assert.equal(dashboardStage(active([task('a')],'two'),'one'),'entering');
});
test('initial allocation creates one summary; repeated or reordered snapshots do not invent changes', () => {
  const state=active([task('a'),task('b')]);
  const first=observeBoard(emptyObservation,state,1000);
  assert.equal(first.entries.length,1);assert.equal(first.entries[0].kind,'ready');assert.equal(first.entries[0].count,2);
  const repeat=observeBoard(first,structuredClone(state),2000);
  assert.deepEqual(repeat.entries,first.entries);assert.equal(repeat.syncedAt,2000);
  assert.deepEqual(observeBoard(repeat,{...state,tasks:[...state.tasks].reverse()},3000).entries,first.entries);
});
test('pending proposal never claims an owner change; applied assignment and task progress are observed', () => {
  const first=observeBoard(emptyObservation,active([task('a')]),1000);
  const pending={...active([task('a')]),proposal:{version:1,status:'pending' as const,updates:[{taskId:'a',ownerId:'replacement',start:'13:00',end:'14:00'}]}};
  assert.deepEqual(observeBoard(first,pending,2000).entries,first.entries);
  const applied=observeBoard(first,active([task('a',{ownerId:'replacement',assignmentVersion:2,status:'working'})]),3000);
  assert.deepEqual(applied.entries.slice(0,2).map(e=>e.kind),['owner','status']);
  assert.equal(applied.entries[0].previousOwnerId,'writer');assert.equal(applied.entries[0].ownerId,'replacement');
  const done=observeBoard(applied,active([task('a',{ownerId:'replacement',assignmentVersion:2,status:'done'})]),4000);
  assert.equal(done.entries[0].status,'done');
});
test('blockers, clearing, schedule changes and new tasks are reported; feed is limited to five', () => {
  let observation=observeBoard(emptyObservation,active([task('a')]),1000);
  observation=observeBoard(observation,active([task('a',{status:'attention',blockedReason:'Leave'})]),2000);
  assert.ok(observation.entries.some(e=>e.kind==='blocked'));
  observation=observeBoard(observation,active([task('a',{status:'working',due:'3:00 PM',end:'15:00'}),task('b')]),3000);
  assert.ok(observation.entries.some(e=>e.kind==='unblocked'));
  assert.ok(observation.entries.some(e=>e.kind==='schedule'));
  assert.ok(observation.entries.some(e=>e.kind==='created'));
  assert.equal(observation.entries.length,5);
  assert.equal(new Set(observation.entries.map(e=>e.id)).size,5);
});
test('reset and a new run clear old task changes; observation owns its baseline', () => {
  const state=active([task('a')]);const previous=observeBoard(emptyObservation,state,1000);
  state.tasks[0].ownerId='replacement';
  assert.equal(observeBoard(previous,state,2000).entries[0].kind,'owner');
  const reset=observeBoard(previous,{...initialBoard,phase:'planning',runId:'two'},3000);
  assert.deepEqual(reset.entries,[]);assert.equal(reset.syncedAt,0);
  const next=observeBoard(previous,active([task('b')],'two'),4000);
  assert.equal(next.entries.length,1);assert.equal(next.entries[0].kind,'ready');
});


test('all changed cards highlight even when the feed keeps only five entries', () => {
  const tasks=Array.from({length:8},(_,i)=>task(String(i)));
  const first=observeBoard(emptyObservation,active(tasks),1000);
  const updated=active(tasks.map(t=>({...t,status:'working' as const})));
  const changed=observeBoard(first,updated,2000);
  assert.equal(changed.entries.length,5);
  assert.equal(changed.changedTaskIds.length,8);
  assert.deepEqual(observeBoard(changed,updated,3000).changedTaskIds,[]);
});
