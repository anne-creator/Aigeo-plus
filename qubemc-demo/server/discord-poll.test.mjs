import test from 'node:test';
import assert from 'node:assert/strict';
import {pollDiscordRuns} from './discord-poll.mjs';
const run=(id,after)=>({runId:id,discordAfter:after,transport:'discord',workflowMode:'discord-confirm-v1',injection:{status:'waiting'},messages:[]});
test('one shared channel read starts at the oldest cursor without losing pagination',async()=>{
 const batch={messages:[{id:'101'}]},reads=[],synced=[];
 await pollDiscordRuns([run('one','100'),run('two','200'),run('new',undefined)],{channel:'channel',read:async args=>{reads.push(args);return batch;},sync:async(id,result)=>synced.push([id,result])});
 assert.equal(reads.length,1);assert.equal(reads[0][reads[0].indexOf('--after')+1],'100');assert.equal(synced.length,3);assert.ok(synced.every(([,result])=>result===batch));
});
test('resolved runs do not poll; unsent intake can sync without a read',async()=>{
 let reads=0,syncs=0;const resolved={...run('done','100'),injection:{status:'analyzed'}};
 await pollDiscordRuns([resolved],{read:()=>reads++,sync:()=>syncs++});assert.equal(reads,0);assert.equal(syncs,0);
 await pollDiscordRuns([run('new')],{read:()=>reads++,sync:async(_,batch)=>{syncs++;assert.deepEqual(batch,{messages:[]});}});assert.equal(reads,0);assert.equal(syncs,1);
});
