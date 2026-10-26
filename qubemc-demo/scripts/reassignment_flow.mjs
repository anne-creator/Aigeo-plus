import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createCoordinator} from '../server/project.mjs';
import {ALEX_LEAVE_TEXT} from '../server/project-discord.mjs';

// Real coordinator and receipt validation, with an in-memory Discord transport.
export async function simulateReassignmentFlow({initialRun,storeDir,runId,call,selectReassignment,coordinatorFactory=createCoordinator}){
 const settings={COFLOOR_DISABLE_BACKGROUND_WORKER:'1',COFLOOR_DISCORD:'live',NEMOCLAW_DISCORD_CHANNEL_ID:'111111111111111111',NEMOCLAW_DISCORD_SERVER_ID:'222222222222222222',COFLOOR_DISCORD_ALEX_ID:'333333333333333333',COFLOOR_DISCORD_MANAGER_ID:'444444444444444444'};
 const previous=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]]));Object.assign(process.env,settings);
 try{
  assert.equal(initialRun.leave.length,0,'benchmark needs a clean initial allocation');
  const initial=structuredClone(initialRun);
  Object.assign(initial,{runId,transport:'discord',messages:[],eventIds:[],decisionIds:[],narrationEvents:[],activity:[],injection:{status:'waiting'}});
  for(const key of ['proposal','issue','confirmation','discordAfter','discordError'])delete initial[key];
  mkdirSync(storeDir,{recursive:true});writeFileSync(join(storeDir,runId+'.json'),JSON.stringify(initial));
  let nextId=1000000000000000000n;const inbox=[],sends=[];
  const message=(author,content,replyTo,bot=false)=>({id:String(++nextId),author:{id:author,bot},content,message_reference:{message_id:replyTo},timestamp:new Date().toISOString()});
  const command=async args=>{
   if(args[0]==='send'){const msg=message('555555555555555555',args[args.indexOf('--message')+1],null,true);inbox.push(msg);sends.push(msg);return {payload:{messageId:msg.id}};}
   assert.equal(args[0],'read');const after=args[args.indexOf('--after')+1];return {payload:{messages:inbox.filter(m=>BigInt(m.id)>BigInt(after))}};
  };
  const service=coordinatorFactory({storeDir,call,selectReassignment,discordCommand:command});
  const signal=()=>AbortSignal.timeout(240000);
  const sync=()=>service.analyze('state',{runId},signal());
  const start=Date.now();let run=await sync();const intake=run.messages.find(m=>m.kind==='intake');assert.equal(intake.delivery,'sent');
  const oldTask=run.tasks.find(t=>t.ownerId==='EMP-0329');assert.ok(oldTask);
  inbox.push(message('666666666666666666',ALEX_LEAVE_TEXT,intake.discordMessageId));
  await sync();assert.equal(service.load(runId).leave.length,0,'wrong author must be ignored');
  const leave=message(settings.COFLOOR_DISCORD_ALEX_ID,ALEX_LEAVE_TEXT,intake.discordMessageId);inbox.push(leave);
  const leaveStart=Date.now();run=await sync();
  assert.equal(run.tasks.find(t=>t.id===oldTask.id).ownerId,'EMP-0329','proposal must not apply before confirmation');
  assert.equal(run.proposal.status,'pending');
  // Current baseline may need a second poll to flush; the candidate flushes immediately.
  let pollsToProposal=1;
  if(!run.messages.find(m=>m.id===`${runId}-proposal-1`&&m.delivery==='sent')){pollsToProposal++;run=await sync();}
  const proposal=run.messages.find(m=>m.id===`${runId}-proposal-1`);assert.equal(proposal.delivery,'sent');
  const proposalMs=Date.now()-leaveStart;
  assert.ok(proposal.text.includes('Reply confirm'));assert.ok(proposal.text.includes('deadline'));
  inbox.push(message(settings.COFLOOR_DISCORD_ALEX_ID,ALEX_LEAVE_TEXT,intake.discordMessageId));
  inbox.push(message(settings.COFLOOR_DISCORD_ALEX_ID,'confirm',proposal.discordMessageId));
  inbox.push(message(settings.COFLOOR_DISCORD_MANAGER_ID,'confirm',intake.discordMessageId));
  run=await sync();assert.equal(run.proposal.version,1);assert.equal(run.proposal.status,'pending');assert.equal(run.leave.length,1);
  const confirm=message(settings.COFLOOR_DISCORD_MANAGER_ID,'confirm',proposal.discordMessageId);inbox.push(confirm);
  const confirmStart=Date.now();run=await sync();
  if(!run.messages.some(m=>m.id===`discord-${confirm.id}-answer`&&m.delivery==='sent'))run=await sync();
  const confirmMs=Date.now()-confirmStart;assert.equal(run.proposal.status,'applied');assert.equal(run.confirmation.source,'discord');assert.equal(run.issue.status,'resolved');
  const changed=run.tasks.find(t=>t.id===oldTask.id);assert.notEqual(changed.ownerId,'EMP-0329');assert.equal(changed.assignmentVersion,2);assert.deepEqual(changed.outputs,oldTask.outputs);assert.equal(changed.due,oldTask.due);
  for(const task of initial.tasks.filter(t=>t.id!==oldTask.id))assert.deepEqual(run.tasks.find(t=>t.id===task.id),task);
  inbox.push(message(settings.COFLOOR_DISCORD_MANAGER_ID,'confirm',proposal.discordMessageId));await sync();
  assert.equal(service.load(runId).tasks.find(t=>t.id===oldTask.id).assignmentVersion,2);
  assert.equal(sends.length,3,'exactly one intake, one proposal, one completion');
  assert.equal(run.messages.filter(m=>m.author==='employee').length,1,'no fabricated employee acceptance');
  return {runId,proposalMs,confirmMs,pollsToProposal,totalMs:Date.now()-start,replacementOwner:changed.ownerId,decision:run.proposal.decision??null,mockDiscordSends:sends.length,checksPassed:true};
 }finally{for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
