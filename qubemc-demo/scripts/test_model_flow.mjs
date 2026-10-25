// Opt-in live inference test using only the fictional project and synthetic staff.
import assert from 'node:assert/strict';
const base=process.env.COFLOOR_URL||'http://127.0.0.1:5173',runId=`smoke-${crypto.randomUUID()}`;
async function post(action,input={}){
 const response=await fetch(`${base}/api/model/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,...input}),signal:AbortSignal.timeout(190000)});
 const run=await response.json();if(!response.ok)throw new Error(run.error);return run;
}
const plan=await post('plan',{project:{id:'P-DEMO-001',workflowId:'RED-BULL-X-LAUNCH-V1'}});
assert.equal(plan.source,'live');assert.equal(plan.phase,'in_project');assert.ok(plan.tasks.length>=2);assert.ok(plan.projectOwnerId);
console.log('Live allocation:',plan.tasks.map(t=>({task:t.id,owner:t.ownerId,due:t.due})), 'Project manager:',plan.projectOwnerId);
assert.equal((await post('check')).leave.length,0);
// Explicit test event at the adapter boundary; production never synthesizes it.
const checked=await post('event',{event:{id:crypto.randomUUID(),type:'sick_leave',actorId:'EMP-0329',channelId:plan.channelId,text:"I'm taking sick leave from 1–6 p.m. today. Please reassign my task.",start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T18:00:00-07:00',reportedAt:'2026-10-26T10:32:00-07:00'}});
assert.equal(checked.proposal.status,'pending');
const oldOwner=checked.tasks.find(t=>t.id===checked.issue.taskId).ownerId;
assert.equal(oldOwner,'EMP-0329');
const reply={actorId:plan.projectOwnerId,channelId:plan.channelId,proposalVersion:checked.proposal.version};
const vague=await post('decision',{...reply,decisionId:crypto.randomUUID(),text:'Noted'});assert.equal(vague.issue.status,'awaiting');
const resolved=await post('decision',{...reply,decisionId:crypto.randomUUID(),text:'confirm'});
assert.equal(resolved.issue.status,'resolved');const task=resolved.tasks.find(t=>t.id===resolved.issue.taskId);assert.notEqual(task.ownerId,oldOwner);assert.equal(task.assignmentVersion,2);
console.log('PASS: live allocation, explicit Alex event, pending reassignment list, manager confirm, validated replacement.');
console.log('Discord transport is not exercised; this test submits local adapter events.');
