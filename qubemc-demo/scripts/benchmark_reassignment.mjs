// Real local inference, isolated run stores, entirely mocked Discord delivery.
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
process.env.COFLOOR_DISABLE_BACKGROUND_WORKER='1';process.env.COFLOOR_DISCORD='off';
const root=join(homedir(),'cofloor','benchmarks');mkdirSync(root,{recursive:true});
const directory=mkdtempSync(join(root,'reassignment-'));
const baselineSource=realpathSync(process.env.BASELINE_APP||join(homedir(),'cofloor','current'));
// Copy source/data only: never import a baseline worker that can access live runs.
const baselineApp=join(directory,'baseline-app');mkdirSync(baselineApp);
for(const name of ['server','data'])cpSync(join(baselineSource,name),join(baselineApp,name),{recursive:true});
const baseline=await import(pathToFileURL(join(baselineApp,'server/project.mjs')));
const baselineModel=await import(pathToFileURL(join(baselineApp,'server/model.mjs')));
const {simulateReassignmentFlow}=await import('./reassignment_flow.mjs');
const {selectReassignmentWithDecision}=await import('../server/decision.mjs');
const {runNemoClawDecision}=await import('../server/nemoclaw-discord.mjs');
if(!process.env.REASSIGNMENT_FIXTURE)throw Error('REASSIGNMENT_FIXTURE must point to a clean initial run, outside live benchmark stores.');
const initialRun=JSON.parse(readFileSync(process.env.REASSIGNMENT_FIXTURE,'utf8'));
const records=[];
for(let trial=1;trial<=3;trial++){
 const order=trial%2?['baseline','d1']:['d1','baseline'];
 for(const variant of order){
  const calls=[];
  const result=await simulateReassignmentFlow({initialRun,storeDir:join(directory,variant+'-'+trial),runId:`${variant}-${trial}`,
   coordinatorFactory:variant==='baseline'?baseline.createCoordinator:undefined,
   call:async(...args)=>{if(variant!=='baseline')throw Error('D1 flow unexpectedly invoked Nemotron');const start=Date.now();const result=await baselineModel.chatJson(...args);calls.push({type:'nemotron',ms:Date.now()-start});return result;},
   selectReassignment:variant==='d1'?(payload,signal,validate)=>selectReassignmentWithDecision(payload,signal,runNemoClawDecision,validate):undefined,
  });
  const record={variant,trial,...result,calls};records.push(record);console.log(JSON.stringify({event:'trial',...record}));
 }
}
const times=variant=>records.filter(r=>r.variant===variant).map(r=>r.proposalMs).sort((a,b)=>a-b);
const old=times('baseline'),next=times('d1');
const gate={passed:records.every(r=>r.checksPassed)&&Math.max(...next)<Math.min(...old),baselineMedianMs:old[1],d1MedianMs:next[1],speedup:old[1]/next[1],realDiscordSent:0,transport:'mocked',inference:'real local models through NemoClaw',baselineSource};
writeFileSync(join(directory,'result.json'),JSON.stringify({gate,records},null,2));
console.log(JSON.stringify({event:'gate',directory,...gate}));
if(!gate.passed)process.exitCode=1;
