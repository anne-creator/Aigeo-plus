import type { CompanyInput } from './state';
import type { DocumentProject } from './redbull-project';
import type { BoardEvent,BoardRun } from './board-state';
export type IntakeInput={project:DocumentProject;company:CompanyInput;runId:string};
export interface BoardAdapter {
  mode:'live';
  start(input:IntakeInput,signal:AbortSignal):AsyncIterable<BoardEvent>;
  request(action:'state'|'check'|'decision',input:Record<string,unknown>,signal:AbortSignal):Promise<BoardRun>;
}
declare global{interface Window{cofloorBoardAgent?:BoardAdapter}}
let configured=false;
export function configureRuntime(value:boolean){configured=value;}
export const hasRuntime=()=>window.cofloorBoardAgent?.mode==='live'||configured;
async function request(action:string,input:unknown,signal:AbortSignal):Promise<BoardRun>{
  const response=await fetch(`/api/model/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
  let result;try{result=await response.json();}catch{throw new Error('Local model service is unavailable.');}
  if(!response.ok)throw new Error(result.error??'Model request failed.');return result;
}
const liveAgent:BoardAdapter={mode:'live',request,
  async *start({project,runId},signal){
    yield {id:crypto.randomUUID(),runId,type:'progress',label:'Assigning your project team…'};
    const run=await request('plan',{runId,project:{id:project.id,workflowId:project.workflowId}},signal);
    yield {id:crypto.randomUUID(),runId,type:'snapshot',run};
  },
};
export function getBoardAdapter(_live=true):BoardAdapter{
  if(window.cofloorBoardAgent?.mode==='live')return window.cofloorBoardAgent;
  if(!configured)throw new Error('Local model is not configured. Connect the model service and retry.');
  return liveAgent;
}
