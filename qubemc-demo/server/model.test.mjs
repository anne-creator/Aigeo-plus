import {localModelUrl, SPARK_LLM_URL, inferenceMode} from './local-inference.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatePools, validatePlan, parseModelJson, analyze, modelMiddleware, chatJson } from './model.mjs';
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
  assert.equal(status,200);assert.deepEqual(Object.keys(body).sort(),['configured','discord','harness','model']);
  modelMiddleware({url:'/api/model/plan',method:'POST',headers:{host:'127.0.0.1:5173',origin:'https://unrelated.example'}},res,()=>{});
  assert.equal(status,403);
});
test('document setup requires a run ID before inference',async()=>{
  let called=false;
  await assert.rejects(analyze('plan',{project:{workflowId:'RED-BULL-X-LAUNCH-V1',document:{content:'Document'}}},new AbortController().signal,async()=>{called=true;return {}}),/Missing run ID/);
  assert.equal(called,false);
});

test('inference endpoints reject public hosts, credentials and alternate routes',()=>{
 assert.equal(localModelUrl(),SPARK_LLM_URL);
 for(const url of ['https://cloud.example/v1/chat/completions','http://100.89.121.112.evil.example:8000/v1/chat/completions','http://user:secret@100.89.121.112:8000/v1/chat/completions','http://100.89.121.112:8001/v1/chat/completions',SPARK_LLM_URL+'?redirect=cloud'])assert.throws(()=>localModelUrl(url),/local Spark/);
 const previous=process.env.COFLOOR_INFERENCE;
 try{delete process.env.COFLOOR_INFERENCE;assert.equal(inferenceMode(),'nemoclaw');process.env.COFLOOR_INFERENCE='cloud';assert.throws(()=>inferenceMode(),/mode/);}finally{if(previous===undefined)delete process.env.COFLOOR_INFERENCE;else process.env.COFLOOR_INFERENCE=previous;}
});
test('explicit direct mode uses Tailscale without gateway credentials or redirect fallback',async()=>{
 const previous={mode:process.env.COFLOOR_INFERENCE,url:process.env.MODEL_API_URL};
 try{
  process.env.COFLOOR_INFERENCE='local';delete process.env.MODEL_API_URL;
  const result=await chatJson('Return JSON',{},new AbortController().signal,async(url,options)=>{
   assert.equal(url,SPARK_LLM_URL);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);
   return new Response('data: '+JSON.stringify({choices:[{delta:{content:'{"local":true}'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n');
  });assert.deepEqual(result,{local:true});
  process.env.MODEL_API_URL='https://cloud.example/v1/chat/completions';
  await assert.rejects(chatJson('Return JSON',{},new AbortController().signal,()=>{throw Error('must not fetch');}),/local Spark/);
 }finally{for(const [key,value] of [['COFLOOR_INFERENCE',previous.mode],['MODEL_API_URL',previous.url]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
