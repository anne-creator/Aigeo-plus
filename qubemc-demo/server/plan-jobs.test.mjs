import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPlanJobs} from './plan-jobs.mjs';
const input=runId=>({runId,project:{id:'P-DEMO-001',workflowId:'RED-BULL-X-LAUNCH-V1'}});
const run=runId=>({runId,workflowMode:'discord-confirm-v1',tasks:[{id:'image'}],activity:[],specs:['private planning data']});
const fixture=()=>mkdtempSync(join(tmpdir(),'cofloor-jobs-'));
test('start acknowledges before inference, repeated starts deduplicate, completion is recoverable',async()=>{
 const dir=fixture();let release,calls=0;
 const jobs=createPlanJobs({storeDir:dir,plan:async i=>{calls++;await new Promise(r=>release=r);writeFileSync(join(dir,i.runId+'.json'),JSON.stringify(run(i.runId)));}});
 try{
  assert.equal(jobs.start(input('one')).status,'queued');
  await Promise.resolve();assert.equal(jobs.status('one').status,'running');
  jobs.start(input('one'));assert.equal(calls,1);
  release();await jobs.settled();
  assert.equal(jobs.status('one').status,'complete');assert.equal(jobs.status('one').run.specs,undefined);
  jobs.start(input('one'));assert.equal(calls,1);
  const restarted=createPlanJobs({storeDir:dir,plan:()=>assert.fail('must not replan')});
  assert.equal(restarted.start(input('one')).status,'complete');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('failed jobs retry the same ID, without leaking raw command errors',async()=>{
 const dir=fixture();let calls=0;
 const jobs=createPlanJobs({storeDir:dir,plan:async i=>{if(++calls===1)throw Error('secret command payload');writeFileSync(join(dir,i.runId+'.json'),JSON.stringify(run(i.runId)));}});
 try{jobs.start(input('one'));await jobs.settled();assert.equal(jobs.status('one').status,'failed');assert.doesNotMatch(jobs.status('one').error,/secret/);jobs.start(input('one'));await jobs.settled();assert.equal(calls,2);assert.equal(jobs.status('one').status,'complete');}finally{rmSync(dir,{recursive:true,force:true});}
});
test('process restart marks unfinished jobs interrupted; explicit retry resumes same ID',async()=>{
 const dir=fixture();mkdirSync(join(dir,'jobs'));writeFileSync(join(dir,'jobs','one.json'),JSON.stringify({runId:'one',status:'running'}));
 let calls=0;const jobs=createPlanJobs({storeDir:dir,plan:async i=>{calls++;writeFileSync(join(dir,i.runId+'.json'),JSON.stringify(run(i.runId)));}});
 try{assert.equal(jobs.status('one').status,'failed');assert.equal(calls,0);jobs.start(input('one'));await jobs.settled();assert.equal(calls,1);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('separate jobs wait in a bounded-concurrency planning queue',async()=>{
 const dir=fixture();const order=[];let release;
 const jobs=createPlanJobs({storeDir:dir,plan:async i=>{order.push(i.runId);if(i.runId==='one')await new Promise(r=>release=r);writeFileSync(join(dir,i.runId+'.json'),JSON.stringify(run(i.runId)));}});
 try{jobs.start(input('one'));jobs.start(input('two'));await Promise.resolve();assert.equal(jobs.status('two').status,'queued');assert.deepEqual(order,['one']);release();await jobs.settled();assert.deepEqual(order,['one','two']);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid project and path traversal cannot start a job',()=>{
 const dir=fixture(),jobs=createPlanJobs({storeDir:dir,plan:()=>assert.fail()});
 try{assert.throws(()=>jobs.start(input('../bad')),/Invalid/);assert.throws(()=>jobs.start({runId:'one',project:{}}),/Unknown/);assert.throws(()=>jobs.status('absent'),/Missing/);}finally{rmSync(dir,{recursive:true,force:true});}
});
