import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatePools, validatePlan, parseModelJson, analyze, modelMiddleware } from './model.mjs';
const pools = candidatePools();
const plan = { tasks:pools.map(p=>({id:p.id,title:p.deliverable,ownerId:p.candidates[0].id})) };
test('staff pools meet skill, permission, clearance and contiguous booking constraints',()=>{
  assert.equal(pools.length,3);
  assert.ok(pools.every(p=>p.candidates.length>0));
  for(const p of pools)for(const c of p.candidates){
    assert.ok(c.skillLevel>=p.level);assert.ok(c.freeHours>=p.hours);
    assert.equal(Date.parse(c.window[1])-Date.parse(c.window[0]),p.hours*3600000);
  }
});
test('plan accepts only known eligible employees with unique IDs',()=>{
  assert.equal(validatePlan(plan,pools).length,3);
  assert.throws(()=>validatePlan({tasks:plan.tasks.map((t,i)=>i===0?{...t,ownerId:'EMP-NONEXISTENT'}:t)},pools));
  assert.throws(()=>validatePlan({tasks:[plan.tasks[0],plan.tasks[0],plan.tasks[2]]},pools));
});
test('invalid final content fails without fabricated output',()=>{
  assert.deepEqual(parseModelJson('```json\n{"hasIssue":false}\n```'),{hasIssue:false});
  assert.throws(()=>parseModelJson('not json'));
});
test('analysis preserves no-issue and unresolved-worker decisions',async()=>{
  const state={tasks:validatePlan(plan,pools),issue:{taskId:'visual',title:'Late photo',question:'Use render?'}};
  assert.deepEqual(await analyze('check',{state,observation:''},new AbortController().signal,async()=>({hasIssue:false})),{hasIssue:false});
  assert.deepEqual(await analyze('decision',{state,text:'I still cannot deliver.'},new AbortController().signal,async()=>({accepted:false,note:'No feasible commitment yet.'})),{accepted:false,note:'No feasible commitment yet.'});
  await assert.rejects(analyze('check',{state,observation:'late'},new AbortController().signal,async()=>({hasIssue:true,issue:{taskId:'invented'}})));
});
test('status never returns credentials; foreign requests are rejected',()=>{
  let status,body;
  const res={destroyed:false,writeHead(s){status=s},end(text){body=JSON.parse(text)}};
  modelMiddleware({url:'/api/model/status',method:'GET'},res,()=>{});
  assert.equal(status,200);assert.deepEqual(Object.keys(body).sort(),['configured','discord','model']);
  modelMiddleware({url:'/api/model/plan',method:'POST',headers:{host:'127.0.0.1:5173',origin:'https://unrelated.example'}},res,()=>{});
  assert.equal(status,403);
});
test('document setup requires a run ID before inference',async()=>{
  let called=false;
  await assert.rejects(analyze('plan',{project:{workflowId:'RED-BULL-X-LAUNCH-V1',document:{content:'Document'}}},new AbortController().signal,async()=>{called=true;return {}}),/Missing run ID/);
  assert.equal(called,false);
});
