import type { BoardState, BoardTask } from '../board-state.ts';
export type Point = [number, number];
export type Pose = 'walk' | 'type' | 'read' | 'away';
export type Member = { id: string; name: string; role: string; home: string; pose: Pose; unavailable: boolean };
export type Move = { key: string; actorId: string; via: string[]; pose: Pose; carry: boolean; kind: 'assignment' | 'handoff' | 'leave' | 'escalation' };
export type Scene = { runId: string; mode: 'building' | 'floor'; members: Member[]; moves: Move[]; fallback: boolean };
type Directory = readonly { id: string; name: string; role: string }[];
// Corridor graph adapted from cofloor-deploy/src/motion.js; seats use live employee IDs.
export const nav: Record<string, Point> = {
  upper:[38,42],left:[42,48],center:[56,46],right:[61,53],lowerLeft:[44,61],lower:[56,62],lowerRight:[66,67],
  strategyDoor:[28,38],copyDoor:[37,36],designDoor:[57,36],reviewDoor:[35,48],clientDoor:[67,49],
  publishDoor:[40,66],projectDoor:[48,68],designAisle:[73,36],designNear:[64,34],socialAisle:[35,73],projectAisle:[53,76],
  reviewA:[30,56],reviewB:[35,56],clientHandoff:[72,53],publishHandoff:[33,76],archiveHandoff:[52,79],brief:[54,58],exit:[75,81],
  strategy:[20,37.2],copy:[43,29.2],design:[64,29.2],review:[33,55.2],client:[80,56.2],publish:[31,80.2],project:[55,84.2],
  spareA:[75,33.2],spareB:[84,37.2],spareC:[73,60.2],spareD:[24,36],spareE:[40,31],spareF:[61,32],
};
const links = [
  ['upper','left'],['upper','center'],['left','center'],['left','lowerLeft'],['center','right'],['right','lower'],['lowerLeft','lower'],['lower','lowerRight'],
  ['strategyDoor','upper'],['copyDoor','upper'],['designDoor','center'],['reviewDoor','left'],['clientDoor','right'],['publishDoor','lowerLeft'],['projectDoor','lower'],
  ['lowerRight','exit'],['brief','lower'],['reviewA','reviewDoor'],['reviewB','reviewDoor'],['clientHandoff','clientDoor'],['designAisle','designNear'],['designNear','designDoor'],
  ['socialAisle','publishDoor'],['publishHandoff','socialAisle'],['projectAisle','projectDoor'],['archiveHandoff','projectAisle'],
  ['strategy','strategyDoor'],['copy','copyDoor'],['design','designNear'],['review','reviewDoor'],['client','clientDoor'],['publish','socialAisle'],['project','projectAisle'],
  ['spareA','designAisle'],['spareB','designAisle'],['spareC','clientDoor'],['spareD','strategyDoor'],['spareE','copyDoor'],['spareF','designNear'],
];
const adjacency: Record<string,string[]> = {};
for(const [a,b] of links){(adjacency[a]??=[]).push(b);(adjacency[b]??=[]).push(a);}
export function pathBetween(start: string,end: string): string[] {
  if(start===end)return [];
  const queue=[start],previous=new Map<string,string|null>([[start,null]]);
  for(const from of queue)for(const to of adjacency[from]??[]){
    if(previous.has(to))continue;
    previous.set(to,from);queue.push(to);
    if(to===end){const path:string[]=[];let node:string|null=to;while(node&&node!==start){path.unshift(node);node=previous.get(node)??null;}return path;}
  }
  return [];
}
const roomFor = (task:BoardTask) => {
  const skill=task.skill??'';
  if(/design|visual|illustrat|photo/.test(skill))return 'design';
  if(/copy|writ|content/.test(skill))return 'copy';
  if(/strategy|research|market/.test(skill))return 'strategy';
  if(/review|creative_direction/.test(skill))return 'review';
  if(/social|publish/.test(skill))return 'publish';
  if(/account|client/.test(skill))return 'client';
  if(/project|manag|coordinat/.test(skill))return 'project';
  return null;
};
export function planScene(previous: BoardState|null, current: BoardState, directory:Directory, forceAmbient=false):Scene {
  const mode=current.phase==='active'&&current.tasks.length>0?'floor':'building';
  const scene:Scene={mode,runId:current.runId,members:[],moves:[],fallback:forceAmbient};
  if(mode==='building')return scene;
  const people=new Map(directory.map(p=>[p.id,p]));
  const sameRun=previous?.runId===current.runId&&previous?.phase==='active';
  const ids=[...new Set([current.projectOwnerId,...current.tasks.map(t=>t.ownerId),...(current.leave??[]).map(p=>p.employeeId),...(sameRun?previous.tasks.map(t=>t.ownerId):[])].filter((id):id is string=>Boolean(id)))];
  const seats=new Set<string>();
  const spare=['spareA','spareB','spareC','spareD','spareE','spareF','review','client','publish','strategy','copy','design','project'];
  for(const id of ids){
    const person=people.get(id),tasks=current.tasks.filter(t=>t.ownerId===id);
    const requested=id===current.projectOwnerId?'project':tasks.length?roomFor(tasks[0]):'spareA';
    if(!person||!requested)scene.fallback=true;
    const home=requested&&!seats.has(requested)?requested:spare.find(s=>!seats.has(s));
    if(!home){scene.fallback=true;continue;}
    seats.add(home);
    const unavailable=Boolean(current.leave?.some(p=>p.employeeId===id));
    const pose:Pose=unavailable?'away':tasks.some(t=>t.status==='working')?'type':'read';
    scene.members.push({id,name:person?.name??id,role:person?.role??'',home,pose,unavailable});
  }
  const members=new Map(scene.members.map(p=>[p.id,p]));
  const move=(key:string,id:string,via:string[],kind:Move['kind'],carry=false,pose?:Pose)=>{
    if(!members.has(id)||via.some(node=>!nav[node])){scene.fallback=true;return;}
    scene.moves.push({key,actorId:id,via,kind,carry,pose:pose??members.get(id)!.pose});
  };
  for(const task of current.tasks){
    const before=sameRun?previous.tasks.find(t=>t.id===task.id):undefined;
    const owner=members.get(task.ownerId);
    if(!owner){scene.fallback=true;continue;}
    if(!before||before.ownerId!==task.ownerId||before.assignmentVersion!==task.assignmentVersion){
      if(before&&before.ownerId!==task.ownerId&&members.get(before.ownerId)?.unavailable)move(`${task.id}:${task.assignmentVersion}:out`,before.ownerId,['exit'],'leave',false,'away');
      if(!owner.unavailable)move(`${task.id}:${task.assignmentVersion}:assign`,owner.id,['brief',owner.home],'assignment',true);
    }
    if(task.status==='attention'&&before?.status!=='attention'&&current.projectOwnerId){
      if(owner.unavailable)move(`${task.id}:${task.assignmentVersion}:leave`,owner.id,['exit'],'leave',false,'away');
      const manager=members.get(current.projectOwnerId);
      if(manager)move(`${task.id}:${task.assignmentVersion}:escalate`,manager.id,['brief',manager.home],'escalation',true);
    }
    // A delivery animation is only scheduled after the actual snapshot says done.
    if(before&&before.status!=='done'&&task.status==='done'&&!owner.unavailable){
      const next=current.tasks.filter(t=>t.dependencies.includes(task.id));
      for(const child of next){const recipient=members.get(child.ownerId);if(recipient&&!recipient.unavailable)move(`${task.id}:done:${child.id}`,owner.id,[recipient.home,owner.home],'handoff',true);else scene.fallback=true;}
    }
  }
  if(current.error)scene.fallback=true;
  if(scene.fallback)scene.moves=[];
  return scene;
}
