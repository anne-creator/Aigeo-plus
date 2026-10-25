import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCoordinator} from './project.mjs';
const signal=()=>new AbortController().signal;
const drafts=[{id:'copy',title:'Write X launch copy',requirements:'Write the X post and alt text.',outputs:['copy_v1','alt text'],dependencies:[],skill:'social_copy',level:3,hours:1,start:'13:30',end:'14:30'},
{id:'image',title:'Create launch image',requirements:'Create the 1600x900 image from packshot and template.',outputs:['image.png','editable source'],dependencies:[],skill:'graphic_design',level:4,hours:2,start:'13:00',end:'15:00'}];
function fixture(){const storeDir=mkdtempSync(join(tmpdir(),'cofloor-test-'));let time=100000;const counts={draft:0,assign:0,check:0,decision:0};
 const call=async(prompt,payload)=>{
  if(prompt.includes('Read the complete brief')){counts.draft++;assert.ok(payload.document.includes('Red Bull'));return {tasks:structuredClone(drafts)};}
  if(prompt.includes('Choose one project manager')){counts.assign++;return {projectOwnerId:payload.managers[0].id,assignments:payload.pools.map(p=>({taskId:p.taskId,ownerId:p.candidates.find(c=>c.id!==payload.managers[0].id).id}))};}
  if(prompt.includes('Assess this sick-leave')){counts.check++;const t=payload.tasks.find(t=>t.status==='attention');return {hasIssue:true,issue:{taskId:t.id,title:'Sick leave',detail:'Image delivery blocked.',question:'How should we cover this work?'},message:'Please decide how to cover the image task.'};}
  counts.decision++;counts.lastReply=payload.reply;
  if(payload.alternatives.some(p=>!p.candidates.length))return {accepted:false,note:'No feasible replacement. A new timing decision is required.'};
  if(payload.reply==='Noted')return {accepted:false,note:'Please provide a staffing or timing decision.'};
  const updates=payload.alternatives.map(p=>{const c=p.candidates[0];return {taskId:p.taskId,ownerId:c.id,start:c.start,end:c.end};});
  if(payload.reply==='Use sick worker')updates[0].ownerId=payload.leave[0].employeeId;
  return {accepted:true,commitment:'Replacement assigned with original brief and deadline.',updates};
 };
 const service=createCoordinator({call,storeDir,now:()=>time});return {service,counts,storeDir,advance:()=>time+=5001,close:()=>rmSync(storeDir,{recursive:true,force:true})};}
const input=id=>({runId:id,project:{id:'P-DEMO-001',workflowId:'RED-BULL-X-LAUNCH-V1'}});
test('setup persists dynamic tasks and deduplicates, early check does not inject',async()=>{const f=fixture();try{
 const p=await f.service.analyze('plan',input('run1'),signal());assert.equal(p.tasks.length,2);assert.equal(p.phase,'in_project');assert.ok(p.projectOwnerId);assert.equal(p.specs,undefined);assert.equal(p.injection.dueAt,105000);
 assert.deepEqual(await f.service.analyze('plan',input('run1'),signal()),p);assert.equal(f.counts.draft,1);
 const early=await f.service.analyze('check',{runId:'run1'},signal());assert.equal(early.injection.status,'scheduled');assert.equal(f.counts.check,0);
}finally{f.close();}});
test('leave injected once, reservation released, project manager receives issue, reload is idempotent',async()=>{const f=fixture();try{
 const p=await f.service.analyze('plan',input('run2'),signal());f.advance();const run=await f.service.analyze('check',{runId:'run2'},signal());
 assert.equal(run.leave.length,1);assert.equal(run.leave[0].start,'2026-10-26T13:00:00-07:00');assert.equal(run.leave[0].end,'2026-10-26T18:00:00-07:00');assert.equal(run.issue.recipientId,p.projectOwnerId);assert.equal(run.issue.taskId,'image');assert.equal(run.tasks.find(t=>t.id==='image').status,'attention');assert.equal(run.reservations.find(r=>r.taskId==='image').status,'released');
 const reloaded=createCoordinator({call:()=>{throw Error('must not call again')},storeDir:f.storeDir});assert.deepEqual(await reloaded.analyze('check',{runId:'run2'},signal()),run);assert.equal(f.counts.check,1);
}finally{f.close();}});
test('PM identity, vague/invalid replies stay blocked; replacement preserves brief and versions',async()=>{const f=fixture();try{
 const p=await f.service.analyze('plan',input('run3'),signal());f.advance();const issue=await f.service.analyze('check',{runId:'run3'},signal());const original=issue.tasks.find(t=>t.id==='image');
 await assert.rejects(f.service.analyze('decision',{runId:'run3',actorId:'wrong',text:'Replace',decisionId:'d0'},signal()),/actor/);
 for(const [i,text] of ['Noted','Use sick worker'].entries()){const r=await f.service.analyze('decision',{runId:'run3',actorId:p.projectOwnerId,text,decisionId:'d'+i},signal());assert.equal(r.issue.status,'awaiting');assert.equal(r.tasks.find(t=>t.id==='image').ownerId,original.ownerId);}
 const args={runId:'run3',actorId:p.projectOwnerId,text:'Replace',decisionId:'resolved'};const r=await f.service.analyze('decision',args,signal());const next=r.tasks.find(t=>t.id==='image');
 assert.equal(r.issue.status,'resolved');assert.notEqual(next.ownerId,original.ownerId);assert.equal(next.assignmentVersion,2);assert.equal(next.requirements,original.requirements);assert.deepEqual(next.outputs,original.outputs);assert.equal(next.due,original.due);assert.equal(next.status,'working');assert.equal(r.assignmentHistory.at(-1).assignmentVersion,2);assert.equal(r.externalConflicts,undefined);assert.equal(r.tasks.find(t=>t.id==='copy').ownerId,p.tasks.find(t=>t.id==='copy').ownerId);
 assert.deepEqual(await f.service.analyze('decision',args,signal()),r);assert.equal(f.counts.decision,3);
}finally{f.close();}});
test('reset run has no old leave or messages; aborted setup never saves',async()=>{const f=fixture();try{
 await f.service.analyze('plan',input('old'),signal());f.advance();await f.service.analyze('check',{runId:'old'},signal());
 const next=await f.service.analyze('plan',input('new'),signal());assert.equal(next.leave.length,0);assert.equal(next.injection.status,'scheduled');assert.equal(next.messages.length,0);
 const aborted=new AbortController();aborted.abort();await assert.rejects(f.service.analyze('plan',input('cancelled'),aborted.signal));assert.throws(()=>f.service.load('cancelled'),/Missing/);
}finally{f.close();}});

test('no available alternative leaves task blocked without fabricated assignment',async()=>{const f=fixture();try{
 const p=await f.service.analyze('plan',input('no-staff'),signal());f.advance();await f.service.analyze('check',{runId:'no-staff'},signal());
 const stored=f.service.load('no-staff'),task=stored.tasks.find(t=>t.status==='attention'),spec=stored.specs.find(s=>s.id===task.id);
 for(const person of f.service.pool(spec,stored,task.id))stored.leave.push({employeeId:person.id,start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T18:00:00-07:00'});
 writeFileSync(join(f.storeDir,'no-staff.json'),JSON.stringify(stored));
 const next=await f.service.analyze('decision',{runId:'no-staff',actorId:p.projectOwnerId,decisionId:'no-alt',text:'Replace'},signal());
 assert.equal(next.issue.status,'awaiting');assert.equal(next.tasks.find(t=>t.id===task.id).ownerId,task.ownerId);assert.equal(next.tasks.find(t=>t.id===task.id).assignmentVersion,1);
}finally{f.close();}});

test('short reassign command uses pending issue context and preserves original reply',async()=>{
 const f=fixture();try{
  const run=await f.service.analyze('plan',input('short-command'),signal());f.advance();
  await f.service.analyze('check',{runId:run.runId},signal());
  const result=await f.service.analyze('decision',{runId:run.runId,actorId:run.projectOwnerId,text:'reassign',decisionId:'discord-short'},signal());
  assert.equal(result.issue.status,'resolved');
  assert.match(f.counts.lastReply,/reassign all affected work/);
  assert.equal(result.messages.find(m=>m.id==='discord-short').text,'reassign');
 }finally{f.close();}
});
