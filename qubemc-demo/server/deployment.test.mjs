import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedRequest} from './origin.mjs';
import {syncDiscord,ALEX_LEAVE_TEXT} from './project-discord.mjs';
import {messageId,messagesOf} from './nemoclaw-discord.mjs';
test('tunnel accepts only configured host and matching origin',()=>{
 process.env.COFLOOR_PUBLIC_ORIGIN='https://dashboard.example.test';
 assert.equal(allowedRequest({headers:{host:'dashboard.example.test',origin:'https://dashboard.example.test'}}),true);
 assert.equal(allowedRequest({headers:{host:'dashboard.example.test',origin:'https://evil.example'}}),false);
 assert.equal(allowedRequest({headers:{host:'evil.example'}}),false);
 delete process.env.COFLOOR_PUBLIC_ORIGIN;
});
test('native OpenClaw envelopes are parsed',()=>{
 assert.equal(messageId({payload:{result:{messageId:'123'}}}),'123');
 assert.deepEqual(messagesOf({payload:{messages:[]}}),[]);
});
test('live dispatch persists receipt and accepts only mapped manager direct reply',async()=>{
 process.env.COFLOOR_DISCORD='live';process.env.NEMOCLAW_DISCORD_CHANNEL_ID='1563992893704773742';process.env.COFLOOR_DISCORD_MANAGER_ID='123456789012345678';
 let sends=0,decisions=0; const saves=[];
 const run={runId:'test',messages:[{id:'q',author:'agent',text:'Reassign?',delivery:'simulated'}],issue:{status:'awaiting'}};
 const command=async args=>args[0]==='send'?(sends++,{payload:{messageId:'100'}}):{payload:{messages:[
 {id:'101',author:{id:'other'},content:'Replace',message_reference:{message_id:'100'}},
 {id:'102',author:{id:'123456789012345678'},content:'Replace',message_reference:{message_id:'999'}},
 {id:'103',author:{id:'123456789012345678'},content:'Replace',message_reference:{message_id:'100'}}]}};
 const decide=async input=>{decisions++;assert.equal(input.decisionId,'discord-103');run.issue.status='resolved';return run;};
 await syncDiscord(run,{save:r=>saves.push(structuredClone(r)),decide,command});
 await syncDiscord(run,{save:()=>{},decide,command});
 assert.equal(sends,1);assert.equal(decisions,1);assert.equal(saves[0].messages[0].delivery,'sending');assert.equal(run.messages[0].delivery,'sent');
 delete process.env.COFLOOR_DISCORD;delete process.env.COFLOOR_DISCORD_MANAGER_ID;delete process.env.NEMOCLAW_DISCORD_CHANNEL_ID;
});

test('resolved notifications do not request another decision',async()=>{
 process.env.COFLOOR_DISCORD='live';process.env.NEMOCLAW_DISCORD_CHANNEL_ID='1563992893704773742';process.env.COFLOOR_DISCORD_MANAGER_ID='123456789012345678';
 try {
  const run={runId:'resolved',issue:{status:'resolved'},messages:[{author:'agent',text:'Replacement assigned.',delivery:'simulated'}]};
  let content;
  await syncDiscord(run,{save:()=>{},decide:()=>{throw Error('must not process a resolved decision')},command:async args=>{assert.equal(args[0],'send');content=args[args.indexOf('--message')+1];return {payload:{messageId:'200'}}}});
  assert.match(content,/No further reply is needed/);assert.doesNotMatch(content,/Reply directly/);
 }finally{delete process.env.COFLOOR_DISCORD;delete process.env.NEMOCLAW_DISCORD_CHANNEL_ID;delete process.env.COFLOOR_DISCORD_MANAGER_ID;}
});
test('Discord confirmation binds to the current proposal and ignores superseded receipts',async()=>{
 process.env.COFLOOR_DISCORD='live';process.env.NEMOCLAW_DISCORD_CHANNEL_ID='1563992893704773742';process.env.COFLOOR_DISCORD_MANAGER_ID='123456789012345678';
 try {
  const run={runId:'confirm',channelId:'redbull-project',projectOwnerId:'EMP-0148',proposal:{version:2},issue:{status:'awaiting'},discordAfter:'100',messages:[{author:'agent',delivery:'sent',discordMessageId:'100',proposalVersion:1},{author:'agent',text:'Confirm replacement.',delivery:'pending_transport'}]};
  const decisions=[];
  const command=async args=>args[0]==='send'?{payload:{messageId:'200'}}:{payload:{messages:[
   {id:'201',author:{id:'123456789012345678'},content:'confirm',message_reference:{message_id:'100'}},
   {id:'202',author:{id:'123456789012345678'},content:'confirm',message_reference:{message_id:'200'}}]}};
  await syncDiscord(run,{save:()=>{},command,decide:async input=>{decisions.push(input);run.issue.status='resolved';return run;}});
  assert.equal(decisions.length,1);assert.equal(decisions[0].proposalVersion,2);assert.equal(decisions[0].channelId,'redbull-project');assert.equal(decisions[0].decisionId,'discord-202');
  assert.equal(run.messages[1].delivery,'sent');assert.equal(run.messages[1].proposalVersion,2);
 }finally{delete process.env.COFLOOR_DISCORD;delete process.env.NEMOCLAW_DISCORD_CHANNEL_ID;delete process.env.COFLOOR_DISCORD_MANAGER_ID;}
});

test('real Alex reply is authenticated, scoped to the intake message, and delivered once',async()=>{
 process.env.COFLOOR_DISCORD='live';process.env.NEMOCLAW_DISCORD_CHANNEL_ID='1563992893704773742';process.env.COFLOOR_DISCORD_MANAGER_ID='123456789012345678';process.env.COFLOOR_DISCORD_ALEX_ID='575848990005002241';
 try{
  const run={runId:'alex',channelId:'redbull-project',projectOwnerId:'EMP-0148',tasks:[{title:'Image',ownerId:'EMP-0329',due:'3:00 PM'}],messages:[],injection:{status:'waiting'}};
  let calls=0,sent=0;
  const make=(id,author,target,content=ALEX_LEAVE_TEXT)=>({id,author:{id:author},content,message_reference:{message_id:target},timestamp:'2026-10-25T22:00:00Z'});
  const command=async args=>{
   if(args[0]==='send'){sent++;const text=args[args.indexOf('--message')+1];assert.match(text,/<@575848990005002241>/);assert.match(text,/Project team assigned/);assert.match(text,/Image: Alex Morgan; due 3:00 PM/);assert.doesNotMatch(text,/sick leave|reassign|Waiting for Alex|reply directly|Decision recorded/i);assert.equal(text.includes(ALEX_LEAVE_TEXT),false);return {payload:{messageId:'100'}};}
   return {payload:{messages:[make('101','123456789012345678','100'),make('102','575848990005002241','other'),make('103','575848990005002241','100','I am not taking sick leave.'),make('104','575848990005002241','100')]}};
  };
  const receiveEvent=async input=>{calls++;assert.equal(input.event.actorId,'EMP-0329');assert.equal(input.event.id,'discord-104');assert.equal(input.event.text,ALEX_LEAVE_TEXT);assert.equal(input.event.reportedAt,'2026-10-26T10:32:00-07:00');run.injection.status='analyzed';run.messages.push({id:input.event.id,author:'employee',text:input.event.text});return run;};
  await syncDiscord(run,{save:()=>{},receiveEvent,command});
  await syncDiscord(run,{save:()=>{},receiveEvent,command});
  assert.equal(sent,1);assert.equal(calls,1);assert.equal(run.messages.at(-1).delivery,'received');assert.equal(run.messages.at(-1).discordAuthorId,'575848990005002241');
 }finally{delete process.env.COFLOOR_DISCORD;delete process.env.NEMOCLAW_DISCORD_CHANNEL_ID;delete process.env.COFLOOR_DISCORD_MANAGER_ID;delete process.env.COFLOOR_DISCORD_ALEX_ID;}
});
test('failed inference cannot overwrite an already persisted leave event',async()=>{
 process.env.COFLOOR_DISCORD='live';process.env.NEMOCLAW_DISCORD_CHANNEL_ID='1563992893704773742';process.env.COFLOOR_DISCORD_MANAGER_ID='123456789012345678';process.env.COFLOOR_DISCORD_ALEX_ID='575848990005002241';
 try{
  const run={runId:'recover',channelId:'redbull-project',messages:[{kind:'intake',discordMessageId:'100',delivery:'sent'}],injection:{status:'waiting'},discordAfter:'100'};
  let persisted=structuredClone(run);
  const command=async()=>({payload:{messages:[{id:'101',author:{id:'575848990005002241'},content:ALEX_LEAVE_TEXT,message_reference:{message_id:'100'}}]}});
  await syncDiscord(run,{command,save:r=>persisted=structuredClone(r),reload:()=>structuredClone(persisted),receiveEvent:async()=>{persisted.injection.status='received';persisted.leave=[{employeeId:'EMP-0329'}];throw Error('Model timed out');}});
  assert.equal(persisted.injection.status,'received');assert.equal(persisted.leave.length,1);assert.ok(persisted.discordError);
 }finally{delete process.env.COFLOOR_DISCORD;delete process.env.NEMOCLAW_DISCORD_CHANNEL_ID;delete process.env.COFLOOR_DISCORD_MANAGER_ID;delete process.env.COFLOOR_DISCORD_ALEX_ID;}
});
