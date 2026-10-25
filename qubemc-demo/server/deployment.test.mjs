import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedRequest} from './origin.mjs';
import {syncDiscord} from './project-discord.mjs';
import {messageId,messagesOf} from './nemoclaw-discord.mjs';
test('tunnel accepts only configured host and matching origin',()=>{
 process.env.COFLOOR_PUBLIC_ORIGIN='https://cofloor.qubemc.com';
 assert.equal(allowedRequest({headers:{host:'cofloor.qubemc.com',origin:'https://cofloor.qubemc.com'}}),true);
 assert.equal(allowedRequest({headers:{host:'cofloor.qubemc.com',origin:'https://evil.example'}}),false);
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
