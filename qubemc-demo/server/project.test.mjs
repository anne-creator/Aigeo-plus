import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCoordinator} from './project.mjs';
const signal=()=>new AbortController().signal;
const drafts=[{id:'copy',title:'Write X launch copy',requirements:'Write the X post and alt text.',outputs:['copy_v1','alt text'],dependencies:[],skill:'social_copy',level:3,hours:1,start:'13:30',end:'14:30'},
{id:'image',title:'Create launch image',requirements:'Create the 1600x900 image from packshot and template.',outputs:['image.png','editable source'],dependencies:[],skill:'graphic_design',level:4,hours:2,start:'13:00',end:'15:00'}];
function fixture(){
 const storeDir=mkdtempSync(join(tmpdir(),'cofloor-test-'));let time=100000;const counts={proposal:0};
 const call=async(prompt,payload)=>{
  if(prompt.includes('Read the complete brief'))return {tasks:structuredClone(drafts)};
  if(prompt.includes('Choose one project manager'))return {projectOwnerId:payload.managers[0].id,assignments:payload.pools.map(p=>({taskId:p.taskId,ownerId:p.candidates.find(c=>c.id!==payload.managers[0].id).id}))};
  counts.proposal++;
  if(payload.alternatives.some(p=>!p.candidates.length))return {feasible:false,message:'No available replacement. Please review the schedule.'};
  return {feasible:true,message:'Please confirm the proposed cover.',updates:payload.alternatives.map(p=>{const c=p.candidates[0];return {taskId:p.taskId,ownerId:c.id,start:c.start,end:c.end};})};
 };
 const service=createCoordinator({call,storeDir,now:()=>time});return {service,counts,storeDir,advance:()=>time+=100000,close:()=>rmSync(storeDir,{recursive:true,force:true})};
}
const input=runId=>({runId,project:{id:'P-DEMO-001',workflowId:'RED-BULL-X-LAUNCH-V1'}});
const event=runId=>({runId,event:{id:'alex-leave',type:'sick_leave',channelId:'redbull-project',actorId:'EMP-0329',text:"I'm taking sick leave from 1–6 p.m. today. Please reassign my task.",start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T18:00:00-07:00',reportedAt:'2026-10-26T10:32:00-07:00'}});
const decision=(run,text='confirm',id='confirm-1')=>({runId:run.runId,actorId:run.projectOwnerId,channelId:run.channelId,proposalVersion:run.proposal.version,decisionId:id,text});
const invoke=(f,action,input)=>f.service.analyze(action,input,signal());
test('initial allocation fixes Alex, waits indefinitely for a group event',async()=>{const f=fixture();try{
 const p=await invoke(f,'plan',input('wait'));assert.equal(p.tasks.find(t=>t.id==='image').ownerId,'EMP-0329');
 f.advance();const run=await invoke(f,'check',{runId:'wait'});assert.equal(run.injection.status,'waiting');assert.equal(run.leave.length,0);assert.equal(run.messages.length,0);assert.equal(f.counts.proposal,0);
}finally{f.close();}});
test('Alex event releases reservations, proposes without assigning, deduplicates after reload',async()=>{const f=fixture();try{
 const p=await invoke(f,'plan',input('event'));const run=await invoke(f,'event',event('event'));
 assert.equal(run.leave.length,1);assert.equal(run.proposal.status,'pending');assert.equal(run.issue.recipientId,p.projectOwnerId);
 assert.equal(run.tasks.find(t=>t.id==='image').ownerId,'EMP-0329');assert.equal(run.tasks.find(t=>t.id==='image').assignmentVersion,1);
 assert.equal(run.reservations.find(r=>r.taskId==='image').status,'released');assert.equal(run.messages[1].channelId,run.messages[0].channelId);assert.deepEqual(run.messages[1].mentionIds,[p.projectOwnerId]);
 assert.deepEqual(await invoke(f,'event',event('event')),run);assert.equal(f.counts.proposal,1);
 const reload=createCoordinator({call:()=>{throw Error('unexpected inference')},storeDir:f.storeDir});assert.deepEqual(await reload.analyze('state',{runId:'event'},signal()),run);
}finally{f.close();}});
test('only manager confirmation applies exact proposed list once',async()=>{const f=fixture();try{
 await invoke(f,'plan',input('confirm'));const r=await invoke(f,'event',event('confirm'));
 await assert.rejects(invoke(f,'decision',{...decision(r),actorId:'EMP-0329'}),/actor/);
 await assert.rejects(invoke(f,'decision',{...decision(r),proposalVersion:0}),/stale/);
 const noted=await invoke(f,'decision',decision(r,'Noted','noted'));assert.equal(noted.proposal.status,'pending');
 const next=await invoke(f,'decision',decision(r));const task=next.tasks.find(t=>t.id==='image');
 assert.equal(task.ownerId,r.proposal.updates[0].ownerId);assert.equal(task.assignmentVersion,2);assert.equal(next.proposal.status,'applied');assert.deepEqual(task.inputs,r.tasks.find(t=>t.id==='image').inputs);assert.deepEqual(next.tasks.find(t=>t.id==='copy'),r.tasks.find(t=>t.id==='copy'));
 assert.deepEqual(await invoke(f,'decision',decision(r)),next);
}finally{f.close();}});
test('revision needs new confirmation; invalid actor/channel never creates leave',async()=>{const f=fixture();try{
 await invoke(f,'plan',input('revision'));const e=event('revision');
 await assert.rejects(invoke(f,'event',{...e,event:{...e.event,actorId:'wrong'}}),/Invalid/);
 await assert.rejects(invoke(f,'event',{...e,event:{...e.event,channelId:'wrong'}}),/Invalid/);
 const r=await invoke(f,'event',e);const next=await invoke(f,'decision',decision(r,'Please reconsider the staffing','revision'));
 assert.equal(next.proposal.version,2);assert.equal(next.tasks.find(t=>t.id==='image').ownerId,'EMP-0329');await assert.rejects(invoke(f,'decision',decision(r)),/stale/);
}finally{f.close();}});
test('availability lost before confirm leaves all updates unapplied',async()=>{const f=fixture();try{
 await invoke(f,'plan',input('busy'));const r=await invoke(f,'event',event('busy'));const stored=f.service.load('busy');const spec=stored.specs.find(t=>t.id==='image');
 for(const person of f.service.pool(spec,stored,'image'))stored.leave.push({employeeId:person.id,start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T18:00:00-07:00'});
 writeFileSync(join(f.storeDir,'busy.json'),JSON.stringify(stored));const next=await invoke(f,'decision',decision(r));
 assert.equal(next.proposal.status,'unavailable');assert.equal(next.tasks.find(t=>t.id==='image').ownerId,'EMP-0329');assert.equal(next.tasks.find(t=>t.id==='image').assignmentVersion,1);
}finally{f.close();}});
test('new run isolates old leave and confirmation; aborted setup never saves',async()=>{const f=fixture();try{
 await invoke(f,'plan',input('old'));await invoke(f,'event',event('old'));const next=await invoke(f,'plan',input('new'));
 assert.equal(next.leave.length,0);assert.equal(next.injection.status,'waiting');assert.equal(next.messages.length,0);
 const aborted=new AbortController();aborted.abort();await assert.rejects(f.service.analyze('plan',input('cancelled'),aborted.signal));assert.throws(()=>f.service.load('cancelled'),/Missing/);
}finally{f.close();}});
