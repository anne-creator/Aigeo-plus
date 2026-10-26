import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentQuestions,selectOwnersWithDecision} from './decision.mjs';
import {runNemoClawDecision} from './nemoclaw-discord.mjs';
const payload={tasks:[{id:'copy',title:'Write copy'}],managers:[{id:'manager',skillLevel:5}],pools:[{taskId:'copy',candidates:[{id:'writer',skillLevel:4}]}]};
const response={model:'coo-decision',answers:{manager:{type:'choice',choice:'manager'},task_0:{type:'choice',choice:'writer'}},usage:{input_tokens:100,output_tokens:2}};
test('D1 receives bounded eligible choices and returns validated assignments',async()=>{
 const result=await selectOwnersWithDecision(payload,new AbortController().signal,async(body)=>{
  assert.deepEqual(Object.keys(body.questions.manager.criteria),['manager']);assert.deepEqual(Object.keys(body.questions.task_0.criteria),['writer']);return {result:response,inferenceMs:40};
 });
 assert.deepEqual(result.assignments,[{taskId:'copy',ownerId:'writer'}]);assert.equal(result.decisionMetrics.model,'coo-decision');assert.equal(result.decisionMetrics.inferenceMs,40);
});
test('unknown D1 choices and unexpected models fail closed',async()=>{
 for(const result of [{...response,model:'other'},{...response,answers:{...response.answers,task_0:{type:'choice',choice:'outside-pool'}}}])await assert.rejects(selectOwnersWithDecision(payload,new AbortController().signal,async()=>({result})),/Model/);
 assert.throws(()=>assignmentQuestions({...payload,managers:[]}),/No eligible/);
});
test('decision call is executed inside NemoClaw and pins private D1 endpoint',async()=>{
 await runNemoClawDecision(assignmentQuestions(payload),new AbortController().signal,async(executable,args,options)=>{
  assert.equal(executable,'nemoclaw');assert.ok(args.includes('node'));assert.ok(args.includes('exec'));
  const script=args[args.indexOf('-e')+1];assert.ok(script.includes('http://100.89.121.112:8001/v1/systemone'));assert.ok(script.includes("redirect:'error'"));assert.ok(options.signal);return {stdout:JSON.stringify({result:response,inferenceMs:20})};
 });
});

test('joint replacement plans exclude overlapping assignments and validate every option',async()=>{
 const {feasibleReplacementPlans}=await import('./decision.mjs');
 const candidate=id=>({id,start:'2026-10-26T20:00:00Z',end:'2026-10-26T22:00:00Z'});
 let checked=0;
 const plans=feasibleReplacementPlans([{taskId:'a',candidates:[candidate('x'),candidate('y')]},{taskId:'b',candidates:[candidate('x'),candidate('y')]}],updates=>{checked++;assert.notEqual(updates[0].ownerId,updates[1].ownerId);});
 assert.equal(plans.length,2);assert.equal(checked,2);
});
test('reassignment D1 chooses only prevalidated plans and supports explicit review',async()=>{
 const {selectReassignmentWithDecision}=await import('./decision.mjs');
 const input={tasks:[{id:'a',title:'Launch Image'}],leave:[{employeeId:'alex'}],managerRevision:'Choose another designer',alternatives:[{taskId:'a',candidates:[{id:'replacement',name:'Designer',start:'2026-10-26T20:00:00Z',end:'2026-10-26T22:00:00Z'}]}]};
 let checked=0;const validate=()=>{checked++;};
 const execute=choice=>async body=>{assert.equal(body.state.managerRevision,input.managerRevision);assert.ok(body.questions.reassignment.criteria.plan_0);return {result:{model:'coo-decision',answers:{reassignment:{type:'choice',choice}}},inferenceMs:25};};
 const result=await selectReassignmentWithDecision(input,new AbortController().signal,execute('plan_0'),validate);
 assert.equal(result.feasible,true);assert.equal(result.updates[0].ownerId,'replacement');assert.equal(checked,2);
 assert.equal((await selectReassignmentWithDecision(input,new AbortController().signal,execute('needs_review'),validate)).feasible,false);
 await assert.rejects(selectReassignmentWithDecision(input,new AbortController().signal,execute('made-up'),validate),/ineligible/);
 const empty=await selectReassignmentWithDecision({...input,alternatives:[{taskId:'a',candidates:[]}]},new AbortController().signal,()=>assert.fail('must not invoke model'),validate);
 assert.equal(empty.feasible,false);
});
