import type { CompanyInput } from './state';
import type { DocumentProject } from './redbull-project';
import type { BoardEvent,BoardRun } from './board-state';
export type IntakeInput={project:DocumentProject;company:CompanyInput;runId:string};
export interface BoardAdapter {
  mode:'live';
  start(input:IntakeInput,signal:AbortSignal):AsyncIterable<BoardEvent>;
  request(action:'state'|'check'|'decision'|'event',input:Record<string,unknown>,signal:AbortSignal):Promise<BoardRun>;
}
declare global{interface Window{cofloorBoardAgent?:BoardAdapter}}
let configured=false;
export function configureRuntime(value:boolean){configured=value;}
export const hasRuntime=()=>window.cofloorBoardAgent?.mode==='live'||configured;
type PlanJob={runId:string;status:'queued'|'running'|'complete'|'failed';run?:BoardRun;error?:string};
const delay=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  signal.throwIfAborted();
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},2000);
  signal.addEventListener('abort',abort,{once:true});
});
async function post<T>(action:string,input:unknown,signal:AbortSignal):Promise<T>{
  const response=await fetch(`/api/model/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
  let result;try{result=await response.json();}catch{throw new Error(`The server returned an unreadable response (HTTP ${response.status}). Retry resumes the same project.`);}
  if(!response.ok)throw new Error(result.error??`Request failed (HTTP ${response.status}). Retry resumes the same project.`);return result;
}
async function waitForPlan(runId:string,signal:AbortSignal,initial?:PlanJob):Promise<BoardRun>{
  let job=initial;
  while(true){
    signal.throwIfAborted();
    job??=await post<PlanJob>('plan-status',{runId},signal);
    if(job.status==='complete'&&job.run)return job.run;
    if(job.status==='failed')throw new Error(job.error||'Allocation failed. Retry resumes this project.');
    await delay(signal);job=undefined;
  }
}
async function request(action:string,input:Record<string,unknown>,signal:AbortSignal):Promise<BoardRun>{
  if(action==='state')return waitForPlan(String(input.runId),signal);
  return post<BoardRun>(action,input,signal);
}
const liveAgent:BoardAdapter={mode:'live',request,
  async *start({project,runId},signal){
    yield {id:crypto.randomUUID(),runId,type:'progress',label:'Assigning your project team…'};
    const job=await post<PlanJob>('plan-start',{runId,project:{id:project.id,workflowId:project.workflowId}},signal);
    const run=await waitForPlan(runId,signal,job);
    yield {id:crypto.randomUUID(),runId,type:'snapshot',run};
  },
};
export function getBoardAdapter(_live=true):BoardAdapter{
  if(window.cofloorBoardAgent?.mode==='live')return window.cofloorBoardAgent;
  if(!configured)throw new Error('Local model is not configured. Connect the model service and retry.');
  return liveAgent;
}
