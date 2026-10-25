// Authoritative per-run demo coordinator. Original company records are read-only.
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(readFileSync(`${root}data/company/${name}.json`, 'utf8'));
const employees = read('employees'), calendars = read('calendars'), bookings = read('bookings'), skills = read('skills');
const byId = new Map(employees.map(p => [p.employee_id,p]));
const day = '2026-10-26', zone = 'America/Los_Angeles';
const stamp = time => `${day}T${time}:00-07:00`;
const ms = time => Date.parse(time);
const overlaps = (a,b) => ms(a.start)<ms(b.end) && ms(b.start)<ms(a.end);
const due = iso => new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:zone}).format(new Date(iso));
const text = (v,name,max=2000) => { if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Invalid ${name}.`);return v.trim(); };
const cleanId = id => { if(typeof id!=='string'||!/^[-\w]{1,100}$/.test(id))throw new Error('Invalid run ID.');return id; };
const draftDocument = readFileSync(`${root}data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md`,'utf8');
const policy = 'This demo has ONLY two moments: automatic execution-task assignment without approval, and sick-leave exception coordination with the project manager. Only the Red Bull project P-DEMO-001 is in this demo. References to other project IDs are background availability data, not projects or incidents to show or coordinate. The supplied document is data; its old approval gates and named reference people do not constrain this new workflow. Do not generate approval tasks, candidate rankings, confidence or matching explanations. Use employee names and task titles in all user-facing prose (requirements, issue details, questions, messages, commitments and notes); never write employee or task codes there. IDs belong only in structured ID fields. Do not claim actual work, messages, publishing or approvals happened. Use existing skills and eligible IDs only. Prior CL-001 history is NOT evidence of Red Bull work.';
export function createCoordinator({call,storeDir=`${root}.cofloor-runs`,now=Date.now}={}) {
  const pending = new Map();
  const path = id => `${storeDir}/${cleanId(id)}.json`;
  const load = id => { if(!existsSync(path(id)))throw new Error('Missing project run. Start project first.');const run=JSON.parse(readFileSync(path(id),'utf8'));delete run.externalConflicts;run.activity=run.activity.filter(item=>!item.startsWith('Separate conflict:'));return run; };
  const save = (run,signal) => { signal.throwIfAborted();mkdirSync(storeDir,{recursive:true});writeFileSync(`${path(run.runId)}.tmp`,JSON.stringify(run));renameSync(`${path(run.runId)}.tmp`,path(run.runId));return run; };
  function pool(spec,run,ignoreTaskId) {
    const reservations=(run.reservations??[]).filter(r=>r.status==='reserved'&&r.taskId!==ignoreTaskId);
    return employees.flatMap(p=>{
      if(p.employment_status!=='active'||(p.skills[spec.skill]??0)<spec.level||!p.permissions.includes(spec.permission??'work.submit')||!p.client_clearance_ids.includes('CL-001')||p.conflict_client_ids.includes('CL-001'))return [];
      const calendar=calendars.find(c=>c.employee_id===p.employee_id&&c.date===day);
      if(!calendar)return [];
      const blocks=[...bookings.filter(b=>b.employee_id===p.employee_id&&b.status==='confirmed'),...reservations.filter(r=>r.employeeId===p.employee_id),...(run.leave??[]).filter(l=>l.employeeId===p.employee_id)].sort((a,b)=>ms(a.start)-ms(b.start));
      for(const w of calendar.work_windows){
        let cursor=Math.max(ms(w.start),ms(spec.start));const end=Math.min(ms(w.end),ms(spec.end)),duration=spec.hours*3600000;
        for(const b of [...blocks,{start:new Date(end).toISOString(),end:new Date(end).toISOString()}]){
          if(ms(b.end)<=cursor)continue;
          if(Math.min(ms(b.start),end)-cursor>=duration)return [{id:p.employee_id,name:p.name,role:p.job_title,skillLevel:p.skills[spec.skill],start:new Date(cursor).toISOString(),end:new Date(cursor+duration).toISOString()}];
          cursor=Math.max(cursor,ms(b.end));if(cursor>=end)break;
        }
      }
      return [];
    });
  }
  function specsFrom(result) {
    if(!Array.isArray(result.tasks)||result.tasks.length<2||result.tasks.length>12)throw new Error('Model returned invalid execution tasks.');
    const ids=new Set();
    const specs=result.tasks.map(t=>{
      const id=text(t.id,'task ID',40);if(ids.has(id))throw new Error('Model returned duplicate tasks.');ids.add(id);
      const title=text(t.title,'task title',120);if(/\b(approval|approve|sign.off)\b/i.test(title))throw new Error('Model returned an approval task.');
      if(!skills.some(s=>s.skill_id===t.skill)||!Number.isInteger(t.level)||t.level<3||t.level>5||!Number.isFinite(t.hours)||t.hours<0.25||t.hours>4)throw new Error(`Model returned invalid task skills or duration for ${id}: ${JSON.stringify({skill:t.skill,level:t.level,hours:t.hours})}`);
      if(!/^\d{2}:\d{2}$/.test(t.start)||!/^\d{2}:\d{2}$/.test(t.end))throw new Error('Model returned invalid task window.');
      const start=stamp(t.start),end=stamp(t.end);
      if(!Number.isFinite(ms(start))||ms(start)<ms(stamp('09:00'))||ms(end)>ms(stamp('16:00'))||ms(end)-ms(start)<t.hours*3600000)throw new Error('Model returned infeasible task timing.');
      if(['graphic_design','brand_design'].includes(t.skill) && (ms(start)<ms(stamp('13:00'))||ms(end)>ms(stamp('15:00'))))throw new Error('Model image task must fit the reference 13:00–15:00 window.');
      if(!Array.isArray(t.dependencies)||!t.dependencies.every(d=>typeof d==='string')||!Array.isArray(t.outputs)||!t.outputs.length)throw new Error('Model returned invalid task dependencies or outputs.');
      return {id,title,requirements:text(t.requirements,'task requirements'),outputs:t.outputs.map(o=>text(o,'deliverable',300)),dependencies:t.dependencies,skill:t.skill,level:t.level,hours:t.hours,start,end};
    });
    const sorted=[],visiting=new Set();
    function visit(t){if(sorted.includes(t))return;if(visiting.has(t.id))throw new Error('Model returned circular dependencies.');visiting.add(t.id);for(const id of t.dependencies){const parent=specs.find(s=>s.id===id);if(!parent)throw new Error('Model returned unknown dependency.');visit(parent);}visiting.delete(t.id);sorted.push(t);}
    specs.forEach(visit);
    if(!specs.some(s=>['graphic_design','brand_design'].includes(s.skill)))throw new Error('Model omitted the launch image task.');
    return sorted;
  }
  const reservation = (task,employeeId,window,version=1) => ({taskId:task.id,employeeId,start:window.start,end:window.end,status:'reserved',assignmentVersion:version});
  function effectiveSpec(spec,run) {
    const dependencyEnd=Math.max(ms(spec.start),...spec.dependencies.map(id=>ms(run.tasks.find(t=>t.id===id)?.end??spec.start)));
    return {...spec,start:new Date(dependencyEnd).toISOString()};
  }
  const publicRun=run=>{const {specs,...visible}=run;return JSON.parse(JSON.stringify(visible));};
  async function perform(action,input,signal) {
    signal.throwIfAborted();
    const runId=cleanId(input.runId);
    if(action==='plan'){
      if(input.project?.id!=='P-DEMO-001'||input.project?.workflowId!=='RED-BULL-X-LAUNCH-V1')throw new Error('Unknown preloaded project.');
      if(existsSync(path(runId)))return publicRun(load(runId));
      const productionWindows=[{skill:'social_copy',level:3,hours:1,start:'13:30',end:'14:30'},{skill:'graphic_design',level:4,hours:2,start:'13:00',end:'15:00'}];
      const feasibleProductionWindows=productionWindows.map(w=>({...w,eligibleCount:pool({...w,start:stamp(w.start),end:stamp(w.end)},{reservations:[],leave:[]}).length}));
      const draft=await call(`${policy} Read the complete brief for product facts and deliverables only. Create ONLY production execution tasks (for example writing copy/alt text and designing the launch image). NEVER create review, approval, publishing, archive, or coordination tasks; the project manager is selected separately. Ignore the old eight-node workflow. Return {"tasks":[{"id":"unique ID","title":"execution task","requirements":"specific brief","outputs":["deliverable"],"dependencies":[],"skill":"existing skill_id","level":3,"hours":1,"start":"09:00","end":"16:00"}]}. Plan only work needed to prepare the X launch package, including copy and image; do not execute release. All windows on Oct 26, 2026 PT; finish by 16:00. Use realistic template-adaptation durations, stagger dependencies, allow copy/design overlap. Prefer the supplied feasibleProductionWindows; only request skills and levels that have actual available staff. Avoid unnecessary supporting tasks. The launch-image task must use a window within 13:00–15:00 PT, as specified in the supplied scenario. Return tasks only, no owners yet.`,{document:draftDocument,skills,feasibleProductionWindows,businessDate:day,timezone:zone},signal);
      let specs;
      try { specs=specsFrom(draft);if(specs.some(s=>!pool(s,{reservations:[],leave:[]}).length))throw new Error('No feasible employees in one of the proposed windows or skill levels. Use feasibleProductionWindows.'); }
      catch(error) {
        const repaired=await call(`${policy} Repair the previous task proposal to satisfy the validation error. Return the SAME tasks JSON schema with id,title,requirements,outputs,dependencies,skill,level,hours,start,end. Skill must exactly match an existing skill_id. level is a JSON integer 3..5; hours is a JSON number 0.25..4. Windows use HH:mm from 09:00 to 16:00 on the business date. Remove any approval/review/publishing/archive tasks. Include copy and launch-image production; the image task window must be within 13:00–15:00 PT.`,{previousProposal:draft,validationError:error.message,skills,feasibleProductionWindows},signal);
        specs=specsFrom(repaired);
      }
      const run={version:3,runId,source:'live',projectOwnerId:'',tasks:[],specs,reservations:[],assignmentHistory:[],leave:[],messages:[],activity:[],injection:{status:'scheduled'},decisionIds:[]};
      const managerSpec={id:'project-owner',skill:'project_management',level:3,permission:'project.dispatch',start:stamp('09:00'),end:stamp('16:00'),hours:0.5};
      const managers=pool(managerSpec,run);const pools=specs.map(s=>({taskId:s.id,candidates:pool(s,run)}));
      if(!managers.length||pools.some(p=>!p.candidates.length))throw new Error('No feasible employee for one or more tasks.');
      const chosen=await call(`${policy} Choose one project manager and one owner per task from the supplied eligible candidates. Prefer distinct execution owners; the manager must not own the image task. Return {"projectOwnerId":"eligible manager ID","assignments":[{"taskId":"exact task ID","ownerId":"eligible candidate ID"}]}. No rankings or explanations.`,{tasks:specs,managers,pools},signal);
      const manager=managers.find(p=>p.id===chosen.projectOwnerId);if(!manager)throw new Error('Model selected an ineligible project manager.');
      run.projectOwnerId=manager.id;run.reservations.push(reservation(managerSpec,manager.id,manager));
      if(!Array.isArray(chosen.assignments)||chosen.assignments.length!==specs.length||new Set(chosen.assignments.map(a=>a.taskId)).size!==specs.length)throw new Error('Model returned incomplete assignments.');
      for(const spec of specs){
        const choice=chosen.assignments.find(a=>a.taskId===spec.id);
        const person=pool(effectiveSpec(spec,run),run).find(p=>p.id===choice?.ownerId);
        if(!person||(['graphic_design','brand_design'].includes(spec.skill)&&person.id===manager.id))throw new Error('Model selected an unavailable or conflicting employee.');
        const task={...spec,inputs:['RED_BULL_X_LAUNCH_DEMO.md','Supplied product facts','Packshot','Brand template'],ownerId:person.id,start:person.start,end:person.end,due:due(person.end),status:!spec.dependencies.length&&ms(person.start)<=ms(stamp('09:00'))?'working':'ready',assignmentVersion:1};
        run.tasks.push(task);run.assignmentHistory.push({taskId:task.id,ownerId:person.id,assignmentVersion:1});run.reservations.push(reservation(task,person.id,person));
      }
      run.enteredAt=now();run.injection.dueAt=run.enteredAt+5000;run.phase='in_project';run.activity.push('Live model assigned the project team. In project.');
      return publicRun(save(run,signal));
    }
    const run=load(runId);
    if(action==='check'){
      if(run.injection.status==='scheduled'){
        if(now()<run.injection.dueAt) return publicRun(run);
        const task=run.tasks.find(t=>['graphic_design','brand_design'].includes(t.skill)&&t.ownerId!==run.projectOwnerId)??run.tasks.find(t=>t.ownerId!==run.projectOwnerId);
        if(!task)throw new Error('No execution employee available for the sick-leave scenario.');
        const leave={id:`${runId}-sick`,employeeId:task.ownerId,taskId:task.id,start:stamp('13:00'),end:stamp('18:00'),reportedAt:stamp('10:32'),report:"I'm taking sick leave from 1–6 p.m. today and can't do this task. Please reassign it.",reason:'sick_leave',source:'injected_test_fact'};
        run.messages.push({id:leave.id,author:'employee',actorId:leave.employeeId,text:leave.report,delivery:'injected_fact'});
        run.leave.push(leave);run.injection={...run.injection,status:'injected',fact:leave};
        for(const t of run.tasks)if(t.ownerId===leave.employeeId&&overlaps(t,leave)&&t.status!=='done'){
          t.status='attention';t.blockedReason='Sick leave';
          for(const r of run.reservations)if(r.taskId===t.id&&r.status==='reserved')r.status='released';
        }
        run.activity.push(`Test fact: ${byId.get(leave.employeeId).name} reported sick leave. Affected reservations released.`);
        save(run,signal); // Persist the fact before inference; reload retries analysis, not injection.
      }
      if(run.issue)return publicRun(run);
      const result=await call(`${policy} Assess this sick-leave report against the actual assigned work. Return {"hasIssue":false} only if no work is affected; otherwise {"hasIssue":true,"issue":{"taskId":"affected task ID","title":"brief issue","detail":"impact","question":"decision needed from PROJECT MANAGER"},"message":"concise message to the project manager requesting immediate staffing or scheduling decision"}. Do not select or apply a replacement until the manager decides.`,{tasks:run.tasks,leave:run.leave,projectManager:{id:run.projectOwnerId,name:byId.get(run.projectOwnerId).name,role:byId.get(run.projectOwnerId).job_title}},signal);
      if(result.hasIssue===true){
        const task=run.tasks.find(t=>t.id===result.issue?.taskId&&t.status==='attention');if(!task)throw new Error('Model returned an invalid affected task.');
        run.issue={taskId:task.id,title:text(result.issue.title,'issue title',160),detail:text(result.issue.detail,'issue detail'),question:text(result.issue.question,'manager question'),recipientId:run.projectOwnerId,status:'awaiting'};
        run.messages.push({id:`${runId}-question`,actorId:run.projectOwnerId,author:'agent',text:text(result.message??result.issue.question,'manager message'),delivery:'simulated'});
      }else if(result.hasIssue!==false)throw new Error('Model returned invalid issue analysis.');
      else run.activity.push('Model found no actionable issue. Sick-leave tasks remain blocked.');
      run.injection.status='analyzed';return publicRun(save(run,signal));
    }
    if(action==='decision'){
      if(input.actorId!==run.projectOwnerId)throw new Error('Invalid decision actor. Use the project manager test identity.');
      const decisionId=text(input.decisionId,'decision ID',100);
      if(run.decisionIds.includes(decisionId))return publicRun(run);
      if(!run.issue||run.issue.status!=='awaiting')throw new Error('No pending project-manager decision.');
      const reply=text(input.text,'manager reply',4000);
      const affected=run.tasks.filter(t=>t.status==='attention');
      const alternatives=affected.map(task=>({taskId:task.id,candidates:pool(effectiveSpec(run.specs.find(s=>s.id===task.id),run),run,task.id),rescheduleCandidates:pool({...effectiveSpec(run.specs.find(s=>s.id===task.id),run),end:stamp('16:00')},run,task.id)}));
      const result=await call(`${policy} Interpret the project manager reply as a DECISION, not a proposal. There is NO approval or confirmation stage. ONLY IF the actual reply explicitly commands reassignment (for example "find a replacement and reassign the work"), choose an eligible replacement and return accepted:true with concrete updates. This example is NOT the actual reply. When the actual reply merely says thanks/noted/okay, return accepted:false and do not choose a replacement. Never ask for a second approval, explicit acceptance, or confirmation of that command. Acknowledgement alone is unresolved. A request to find/reassign a feasible replacement authorizes selecting one from alternatives. Never assign someone on sick leave. Return {"accepted":false,"note":"what still needs a decision"} or {"accepted":true,"commitment":"specific next action","updates":[{"taskId":"affected ID","ownerId":"eligible ID","start":"ISO timestamp","end":"ISO timestamp"}],"nextCheckIn":"only if explicitly provided"}. Include an update for every affected task. For rescheduling, time may extend to 16:00 PT on the same day only when the manager explicitly changes the timing; use rescheduleCandidates and preserve downstream deadlines; otherwise return accepted:false. Do not invent completion or decisions.`,{projectManagerId:run.projectOwnerId,reply,issue:run.issue,tasks:run.tasks,leave:run.leave,alternatives},signal);
      const reject=note=>{run.decisionIds.push(decisionId);run.messages.push({id:decisionId,author:'manager',actorId:run.projectOwnerId,text:reply,delivery:'test_input'});run.messages.push({id:`${decisionId}-answer`,author:'agent',actorId:run.projectOwnerId,text:note,delivery:'simulated'});return publicRun(save(run,signal));};
      if(/^(\s*(thanks?|thank you|noted|ok(?:ay)?|yes|got it|understood|收到|好的|知道了|了解|谢谢)[\s,，.!！。]*)+$/i.test(reply))return reject('Acknowledged. Please provide a staffing or timing decision; the affected task remains blocked.');
      if(result.accepted===false)return reject(text(result.note,'unresolved decision'));
      if(result.accepted!==true||!Array.isArray(result.updates)||result.updates.length!==affected.length||new Set(result.updates.map(u=>u.taskId)).size!==affected.length)throw new Error('Model returned an invalid decision.');
      const next=structuredClone(run);
      try{
        for(const u of result.updates){
          const task=next.tasks.find(t=>t.id===u.taskId&&t.status==='attention');if(!task)throw new Error('Invalid affected task update.');
          const spec=next.specs.find(s=>s.id===task.id);
          if(!Number.isFinite(ms(u.start))||!Number.isFinite(ms(u.end))||ms(u.end)-ms(u.start)!==spec.hours*3600000||ms(u.start)<ms(spec.start)||ms(u.end)>ms(stamp('16:00')))throw new Error('Invalid replacement timing.');
          const candidate=pool({...effectiveSpec(spec,next),start:u.start,end:u.end},next,task.id).find(p=>p.id===u.ownerId);
          if(!candidate||ms(candidate.start)!==ms(u.start)||ms(candidate.end)!==ms(u.end))throw new Error('No feasible replacement for the proposed decision.');
          for(const child of next.tasks.filter(t=>t.dependencies.includes(task.id)))if(ms(u.end)>ms(child.start))throw new Error('Invalid schedule: downstream deadline conflict.');
          const version=task.assignmentVersion+1;
          next.assignmentHistory??=[];next.assignmentHistory.push({taskId:task.id,previousOwnerId:task.ownerId,ownerId:u.ownerId,assignmentVersion:version,inputs:task.inputs,requirements:task.requirements,outputs:task.outputs});
          next.reservations.push(reservation(task,u.ownerId,u,version));
          Object.assign(task,{ownerId:u.ownerId,start:u.start,end:u.end,due:due(u.end),assignmentVersion:version,status:task.dependencies.length?'ready':'working',blockedReason:undefined,commitment:text(result.commitment,'decision commitment')});
        }
      }catch(error){return reject(`${error.message} The task remains blocked. Please choose another feasible staffing or timing decision.`);}
      next.issue.status='resolved';next.nextCheckIn=result.nextCheckIn?text(result.nextCheckIn,'next check-in',100):undefined;
      next.decisionIds.push(decisionId);next.messages.push({id:decisionId,author:'manager',actorId:next.projectOwnerId,text:reply,delivery:'test_input'},{id:`${decisionId}-answer`,author:'agent',actorId:next.projectOwnerId,text:text(result.commitment,'decision commitment'),delivery:'simulated'});
      next.activity.push(`Project manager decision applied. ${result.commitment}`);return publicRun(save(next,signal));
    }
    if(action==='state')return publicRun(run);
    throw new Error('Unknown project operation.');
  }
  return {pool,load,async analyze(action,input,signal){
    const id=cleanId(input.runId);const key=`${id}:${action}`;
    if(action==='state')return perform(action,input,signal);
    const existing=pending.get(key);
    if(existing){
      if(!existing.signal.aborted)return existing.promise;
      try{await existing.promise;}catch{ /* Resume a cancelled analysis from persisted facts. */ }
      signal.throwIfAborted();
      if(pending.get(key)===existing)pending.delete(key);
    }
    if([...pending.keys()].some(k=>k.startsWith(`${id}:`)))throw new Error('Model operation already running for this project.');
    const promise=perform(action,input,signal),entry={promise,signal};pending.set(key,entry);
    try{return await promise;}finally{if(pending.get(key)===entry)pending.delete(key);}
  }};
}
