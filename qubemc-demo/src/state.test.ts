import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reducer, restore } from './state.ts';
const start = () => reducer(initialState, { type: 'start', runId: 'run-1' });
test('ignores stale results and duplicate events', () => {
  const s = start();
  assert.equal(reducer(s, { type: 'event', event: { id:'1', runId:'old', type:'planned', tasks:[] } }), s);
  const event = { id:'1', runId:'run-1', type:'planned' as const, tasks:[{ id:'visual', title:'Visual', ownerId:'alex', due:'3 PM', status:'ready' as const }] };
  const assigned = reducer(s, { type:'event', event });
  assert.equal(assigned.tasks.length, 1);
  assert.equal(reducer(assigned, { type:'event', event }), assigned);
});
test('cannot resume before actual reply and keeps original owner', () => {
  let s = reducer(start(), { type:'event', event:{ id:'1',runId:'run-1',type:'planned',tasks:[{ id:'visual',title:'Visual',ownerId:'alex',due:'3 PM',status:'ready' }] } });
  s = reducer(s, {type:'monitor'}); s = reducer(s, {type:'check'});
  s = reducer(s, {type:'event',event:{id:'2',runId:'run-1',type:'issue',issue:{taskId:'visual',title:'Late',detail:'Late photo',question:'Use render?'}}});
  assert.equal(s.phase,'notifying');
  s = reducer(s, {type:'event',event:{id:'3',runId:'run-1',type:'sent',message:{id:'m',author:'agent',text:'Use render?',time:'now'}}});
  const early = reducer(s, {type:'event',event:{id:'early',runId:'run-1',type:'resolved',commitment:'3 PM'}});
  assert.equal(early.phase,'awaiting');
  s = reducer(s,{type:'reply-start'});
  s = reducer(s,{type:'event',event:{id:'4',runId:'run-1',type:'reply',message:{id:'r',author:'worker',text:'Yes, 3 PM',time:'now'}}});
  s = reducer(s,{type:'event',event:{id:'5',runId:'run-1',type:'resolved',commitment:'3 PM'}});
  assert.equal(s.phase,'resumed'); assert.equal(s.tasks[0].ownerId,'alex');
  assert.equal(restore(JSON.stringify(s)).phase, s.phase);
  assert.deepEqual(restore(JSON.stringify(s)).tasks, s.tasks);
});
test('storage corruption resets safely; interrupted inference is never completed', () => {
  assert.deepEqual(restore('{oops'),initialState);
  assert.deepEqual(restore('{"version":2}'),initialState);
  const restored = restore(JSON.stringify(start()));
  assert.equal(restored.phase,'planning'); assert.ok(restored.error);
});
