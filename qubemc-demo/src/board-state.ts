export type TaskStatus = 'ready' | 'working' | 'attention' | 'done';
export type BoardTask = {
  id: string; title: string; ownerId: string; due: string; status: TaskStatus;
  requirements: string; outputs: string[]; dependencies: string[]; blockedReason?: string;
  start: string; end: string; skill: string; assignmentVersion: number; commitment?: string; inputs?:string[];
};
export type Reservation = {taskId:string;employeeId:string;start:string;end:string;status:'reserved'|'released';assignmentVersion:number};
export type BoardRun = {
  version:3;runId:string;source:'live';phase:'in_project';projectOwnerId:string;tasks:BoardTask[];
  channelId:string;proposal?:{version:number;status:'pending'|'applied'|'invalid'|'unavailable';updates:{taskId:string;ownerId:string;start:string;end:string}[]};
  enteredAt:number;injection:{status:'waiting'|'received'|'analyzed';fact?:{employeeId:string;taskId:string;start:string;end:string}};
  reservations:Reservation[];leave:{employeeId:string;start:string;end:string}[];
  messages:{id:string;author:'agent'|'manager'|'employee';actorId:string;text:string;channelId?:string;mentionIds?:string[];delivery:'pending_transport'|'test_input'|'received_event'}[];
  activity:string[];issue?:{taskId:string;title:string;detail:string;question:string;recipientId:string;status:'awaiting'|'resolved'};nextCheckIn?:string;
};
export type BoardState = Omit<Partial<BoardRun>,'phase'> & {version:3;runId:string;phase:'idle'|'planning'|'active';tasks:BoardTask[];activity:string[];messages:BoardRun['messages'];seen:string[];label:string;error?:string;operation:'idle'|'setup'|'checking'|'deciding'};
export const initialBoard:BoardState={version:3,runId:'',phase:'idle',tasks:[],activity:[],messages:[],seen:[],label:'',operation:'idle'};
export const columns:{status:TaskStatus;label:string;empty:string}[]=[
  {status:'ready',label:'To do',empty:'No pending tasks'}, {status:'working',label:'In progress',empty:'No active tasks'},
  {status:'attention',label:'Needs attention',empty:'No issues'}, {status:'done',label:'Done',empty:'No completed tasks'},
];
export function waitingFor(task:BoardTask,tasks:BoardTask[]){return task.dependencies.filter(id=>tasks.find(t=>t.id===id)?.status!=='done');}
export function validateTasks(tasks:unknown,ids:ReadonlySet<string>):asserts tasks is BoardTask[]{
  if(!Array.isArray(tasks)||!tasks.length||tasks.length>12)throw new Error('Invalid model tasks.');
  const unique=new Set();
  for(const t of tasks){
    if(!t||!['id','title','ownerId','requirements','due','start','end','skill'].every(k=>typeof t[k]==='string'&&t[k].length)||!ids.has(t.ownerId)||unique.has(t.id)||!columns.some(c=>c.status===t.status)||!Number.isInteger(t.assignmentVersion)||t.assignmentVersion<1||!Array.isArray(t.outputs)||!t.outputs.every((x:unknown)=>typeof x==='string')||!Array.isArray(t.dependencies)||!t.dependencies.every((x:unknown)=>typeof x==='string'))throw new Error('Invalid task or unknown employee ID.');
    unique.add(t.id);
    if(t.blockedReason&&t.status==='done')throw new Error('Blocked task cannot complete.');
  }
  const visiting=new Set<string>(),visited=new Set<string>();
  function visit(id:string){if(visiting.has(id))throw new Error('Circular task dependency.');if(visited.has(id))return;visiting.add(id);const t=(tasks as BoardTask[]).find(t=>t.id===id);if(!t)throw new Error('Unknown dependency.');t.dependencies.forEach(visit);visiting.delete(id);visited.add(id);}
  tasks.forEach(t=>visit(t.id));
  for(const t of tasks)if(waitingFor(t,tasks).length&&['working','done'].includes(t.status))throw new Error('Task dependencies are not complete.');
}
export function validateRun(run:BoardRun,ids:ReadonlySet<string>){
  validateTasks(run.tasks,ids);
  if(run.version!==3||run.source!=='live'||run.phase!=='in_project'||!ids.has(run.projectOwnerId)||!Number.isFinite(run.enteredAt)||!run.injection||typeof run.channelId!=='string'||!['waiting','received','analyzed'].includes(run.injection.status)||!Array.isArray(run.messages)||!run.messages.every(m=>typeof m.text==='string'&&['agent','manager','employee'].includes(m.author))||!Array.isArray(run.activity)||!run.activity.every(x=>typeof x==='string'))throw new Error('Invalid live project state.');
}
export type BoardEvent={id:string;runId:string}&({type:'snapshot';run:BoardRun}|{type:'progress';label:string}|{type:'failed';message:string});
export type BoardAction={type:'start';runId:string}|{type:'reset'}|{type:'operation';operation:BoardState['operation']}|{type:'event';event:BoardEvent;employeeIds:ReadonlySet<string>};
export function boardReducer(s:BoardState,a:BoardAction):BoardState{
  if(a.type==='reset')return {...initialBoard};
  if(a.type==='start')return {...initialBoard,runId:a.runId,phase:'planning',operation:'setup'};
  if(a.type==='operation')return {...s,operation:a.operation,error:undefined};
  const e=a.event;if(e.runId!==s.runId||s.seen.includes(e.id))return s;
  const next={...s,seen:[...s.seen,e.id]};
  if(e.type==='failed')return {...next,error:e.message,operation:'idle'};
  if(e.type==='progress')return {...next,label:e.label};
  if(e.type==='snapshot')try{if(e.run.runId!==s.runId)throw new Error('Wrong run.');validateRun(e.run,a.employeeIds);return {...next,...e.run,phase:'active',operation:'idle',error:undefined};}catch(error){return {...next,error:error instanceof Error?error.message:'Invalid model result.',operation:'idle'};}
  return s;
}
export function restoreBoard(raw:string|null,ids:ReadonlySet<string>):BoardState{
  try{if(!raw)return {...initialBoard};const s=JSON.parse(raw) as BoardState;if(s.version!==3||typeof s.runId!=='string')return {...initialBoard};
    if(s.phase==='active'){validateRun({...s,phase:'in_project'} as BoardRun,ids);const {externalConflicts,...current}=s as BoardState & {externalConflicts?:unknown};return {...current,activity:current.activity.filter(item=>!item.startsWith('Separate conflict:')),operation:'idle',error:undefined};}
    if(s.phase==='planning')return {...initialBoard,runId:s.runId,phase:'planning',error:'Setup was interrupted. Reset to start a new allocation.',operation:'idle'};
    return {...initialBoard};
  }catch{return {...initialBoard};}
}
