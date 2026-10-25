import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCoordinator} from './project.mjs';
const signal=()=>new AbortController().signal;
const drafts=[{id:'copy',title:'Write X launch copy',requirements:'Write the X post and alt text.',outputs:['copy_v1','alt text'],dependencies:[],skill:'social_copy',level:3,hours:1,start:'13:30',end:'14:30'},
{id:'image',title:'Create launch image',requirements:'Create the 1600x900 image from packshot and template.',outputs:['image.png','editable source'],dependencies:[],skill:'graphic_design',level:4,hours:2,start:'13:00',end:'15:00'}];
function fixture(options={}){
 const storeDir=mkdtempSync(join(tmpdir(),'cofloor-test-'));let time=100000;const counts={proposal:0};
 const call=async(prompt,payload)=>{
  if(prompt.includes('Read the complete brief'))return {tasks:structuredClone(drafts)};
  if(prompt.includes('Choose one project manager'))return {projectOwnerId:payload.managers[0].id,assignments:payload.pools.map(p=>({taskId:p.taskId,ownerId:p.candidates.find(c=>c.id!==payload.managers[0].id).id}))};
  counts.proposal++;
  if(payload.alternatives.some(p=>!p.candidates.length))return {feasible:false,message:'No available replacement. Please review the schedule.'};
  return {feasible:true,message:'Please confirm the proposed cover.',updates:payload.alternatives.map(p=>{const c=p.candidates[0];return {taskId:p.taskId,ownerId:c.id,start:c.start,end:c.end};})};
 };
 const service=createCoordinator({call,storeDir,now:()=>time,...options});return {service,counts,storeDir,advance:()=>time+=100000,close:()=>rmSync(storeDir,{recursive:true,force:true})};
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
 assert.equal(next.proposal.status,'unavailable');assert.equal(next.narrationEvents.some(e=>['confirmed','resumed'].includes(e.kind)),false);assert.equal(next.tasks.find(t=>t.id==='image').ownerId,'EMP-0329');assert.equal(next.tasks.find(t=>t.id==='image').assignmentVersion,1);
}finally{f.close();}});
test('new run isolates old leave and confirmation; aborted setup never saves',async()=>{const f=fixture();try{
 await invoke(f,'plan',input('old'));await invoke(f,'event',event('old'));const next=await invoke(f,'plan',input('new'));
 assert.equal(next.leave.length,0);assert.equal(next.injection.status,'waiting');assert.equal(next.messages.length,0);
 const aborted=new AbortController();aborted.abort();await assert.rejects(f.service.analyze('plan',input('cancelled'),aborted.signal));assert.throws(()=>f.service.load('cancelled'),/Missing/);
}finally{f.close();}});

test('narration persists the entire allocation, leave, proposal and test-confirmation timeline',async()=>{
 const f=fixture();try{
  const allocated=await invoke(f,'plan',input('narration'));
  assert.deepEqual(allocated.narrationEvents.map(e=>e.kind),['allocated']);
  assert.match(allocated.narrationEvents[0].text,/Red Bull Citrus Edition/);
  assert.match(allocated.narrationEvents[0].text,/Alex Morgan/);
  assert.doesNotMatch(allocated.narrationEvents[0].text,/EMP-\d/);
  const proposed=await invoke(f,'event',event('narration'));
  assert.deepEqual(proposed.narrationEvents.map(e=>e.kind),['allocated','leave','proposal']);
  assert.match(proposed.narrationEvents[1].text,/1:00 PM to 6:00 PM Pacific/);
  assert.match(proposed.narrationEvents[2].text,/Create launch image/);
  assert.match(proposed.narrationEvents[2].text,/awaiting/);
  const applied=await invoke(f,'decision',{...decision(proposed),discordReceipt:{source:'discord'}});
  assert.deepEqual(applied.narrationEvents.map(e=>e.kind),['allocated','leave','proposal','confirmed','resumed']);
  assert.equal(applied.confirmation.source,'test');
  assert.match(applied.narrationEvents[3].text,/local test/);assert.doesNotMatch(applied.narrationEvents[3].text,/Discord/);
  assert.deepEqual(applied.narrationEvents.map(e=>e.sequence),[1,2,3,4,5]);
  const reload=createCoordinator({storeDir:f.storeDir});
  assert.deepEqual((await reload.analyze('state',{runId:'narration'},signal())).narrationEvents,applied.narrationEvents);
  assert.deepEqual((await invoke(f,'decision',decision(proposed))).narrationEvents,applied.narrationEvents);
 }finally{f.close();}
});

test('Discord receipt and applied confirmation narration are saved atomically after authenticated current-proposal reply',async()=>{
 const keys=['COFLOOR_DISCORD','NEMOCLAW_DISCORD_CHANNEL_ID','COFLOOR_DISCORD_MANAGER_ID','COFLOOR_DISCORD_ALEX_ID'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{COFLOOR_DISCORD:'live',NEMOCLAW_DISCORD_CHANNEL_ID:'1563992893704773742',COFLOOR_DISCORD_MANAGER_ID:'123456789012345678',COFLOOR_DISCORD_ALEX_ID:'575848990005002241'});
 let incoming=[],sent=100;
 const f=fixture({discordCommand:async args=>args[0]==='send'?{payload:{messageId:String(sent++)}}:{payload:{messages:incoming}}});
 try{
  await invoke(f,'plan',input('discord-narration'));
  await invoke(f,'state',{runId:'discord-narration'});
  incoming=[{id:'200',author:{id:process.env.COFLOOR_DISCORD_ALEX_ID},content:"I'm taking sick leave from 1–6 p.m. today and can't do this task. Please reassign it.",message_reference:{message_id:'100'},timestamp:'2026-10-26T17:32:00Z'}];
  const proposed=await invoke(f,'state',{runId:'discord-narration'});
  assert.equal(proposed.proposal.status,'pending');
  incoming=[];
  const delivered=await invoke(f,'state',{runId:'discord-narration'});
  assert.deepEqual(delivered.narrationEvents.map(e=>e.kind),['allocated','leave','proposal','sent']);
  const target=delivered.messages.find(m=>m.id==='discord-narration-proposal-1').discordMessageId;
  incoming=[
   {id:'201',author:{id:'other'},content:'confirm',message_reference:{message_id:target}},
   {id:'202',author:{id:process.env.COFLOOR_DISCORD_MANAGER_ID},content:'confirm',message_reference:{message_id:'100'}},
  ];
  const rejected=await invoke(f,'state',{runId:'discord-narration'});
  assert.equal(rejected.proposal.status,'pending');assert.equal(rejected.confirmation,undefined);
  incoming=[{id:'203',author:{id:process.env.COFLOOR_DISCORD_MANAGER_ID},content:'confirm',message_reference:{message_id:target},timestamp:'2026-10-26T17:35:00Z'}];
  const applied=await invoke(f,'state',{runId:'discord-narration'});
  assert.equal(applied.proposal.status,'applied');assert.equal(applied.confirmation.source,'discord');
  assert.equal(applied.confirmation.discordMessageId,'203');assert.equal(applied.confirmation.replyToMessageId,target);assert.equal(applied.confirmation.proposalVersion,1);
  assert.deepEqual(applied.narrationEvents.map(e=>e.kind),['allocated','leave','proposal','sent','confirmed','resumed']);
  assert.match(applied.narrationEvents.at(-2).text,/confirmed the reassignment in Discord/);
  assert.deepEqual(f.service.load('discord-narration').confirmation,applied.confirmation);
  assert.deepEqual((await invoke(f,'state',{runId:'discord-narration'})).narrationEvents,applied.narrationEvents);
 }finally{f.close();for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
