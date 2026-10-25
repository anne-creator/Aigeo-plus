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
await new Promise(resolve=>setTimeout(resolve,Math.max(0,plan.injection.dueAt-Date.now())));
const checked=await post('check');assert.equal(checked.leave.length,1);assert.equal(checked.issue.recipientId,plan.projectOwnerId);assert.equal(checked.issue.status,'awaiting');
const oldOwner=checked.tasks.find(t=>t.id===checked.issue.taskId).ownerId;
const vague=await post('decision',{actorId:plan.projectOwnerId,decisionId:crypto.randomUUID(),text:'Thanks, noted.'});assert.equal(vague.issue.status,'awaiting');
const resolved=await post('decision',{actorId:plan.projectOwnerId,decisionId:crypto.randomUUID(),text:'Find a qualified available replacement for the employee on sick leave and reassign all affected work. Keep the same deliverables and deadlines. Transfer the complete task brief.'});
assert.equal(resolved.issue.status,'resolved');const task=resolved.tasks.find(t=>t.id===resolved.issue.taskId);assert.notEqual(task.ownerId,oldOwner);assert.equal(task.assignmentVersion,2);
console.log('PASS: live allocation, five-second sick leave, PM question, unresolved acknowledgement, validated replacement.',{oldOwner,newOwner:task.ownerId});
console.log('Discord delivery and manager input are explicitly simulated.');
