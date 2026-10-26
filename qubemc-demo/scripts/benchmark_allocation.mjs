// Isolated real-model benchmark: no Discord sends and no changes to live project runs.
import {mkdtempSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
process.env.COFLOOR_DISCORD='off';
const {createCoordinator}=await import('../server/project.mjs');
const {chatJson}=await import('../server/model.mjs');
const {selectOwnersWithDecision}=await import('../server/decision.mjs');
const {runNemoClawDecision}=await import('../server/nemoclaw-discord.mjs');
const base=join(homedir(),'cofloor','benchmarks');mkdirSync(base,{recursive:true});
const storeDir=mkdtempSync(join(base,'fast-'));
const stages=[];
const coordinator=createCoordinator({storeDir,cache:true,
 call:async(...args)=>{const started=Date.now();const result=await chatJson(...args);stages.push({stage:'nemotron-plan',ms:Date.now()-started});return result;},
 selectOwners:async(payload,signal)=>{const result=await selectOwnersWithDecision(payload,signal,runNemoClawDecision);stages.push({stage:'d1-selection',...result.decisionMetrics});return result;},
});
const measurements=[];
for(const runId of ['benchmark-cold','benchmark-warm']){
 const start=Date.now();
 const run=await coordinator.analyze('plan',{runId,project:{id:'P-DEMO-001',workflowId:'RED-BULL-X-LAUNCH-V1'}},AbortSignal.timeout(600000));
 measurements.push({runId,ms:Date.now()-start,allocation:run.allocation,tasks:run.tasks.length});
 console.log(JSON.stringify({event:'completed',...measurements.at(-1)}));
}
if(measurements[0].allocation.cacheHit||!measurements[1].allocation.cacheHit)throw Error('Benchmark did not exercise cold and warm paths');
console.log(JSON.stringify({event:'summary',storeDir,stages,measurements,speedup:measurements[0].ms/Math.max(1,measurements[1].ms)}));
