// Opt-in integration test. Calls the live model through the local server.
import assert from 'node:assert/strict';
const base = process.env.COFLOOR_URL || 'http://127.0.0.1:5173';
async function post(action,body){
  const started=Date.now();
  const response=await fetch(`${base}/api/model/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(190000)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||`HTTP ${response.status}`);
  console.log(`${action}: ${((Date.now()-started)/1000).toFixed(1)}s`);
  return result;
}
const plan=await post('plan',{project:{id:'launch-01',title:'New product launch',brief:'Three social posts and one key visual. Approved brand template. Budget unchanged. Deliver by 4 PM.',deadline:'4:00 PM'}});
assert.equal(plan.tasks.length,3);
console.log('Real model assignments:',JSON.stringify(plan.tasks));
const state={tasks:plan.tasks.map(t=>({...t,status:'working'}))};
const normal=await post('check',{state,observation:''});
assert.equal(normal.hasIssue,false,'Missing updates must not be treated as an evidenced failure.');
const issue=await post('check',{state,observation:'At the visual production checkpoint, the supplier confirms approved product photography will arrive after the key visual deadline. An approved product render is available as an alternative.'});
assert.equal(issue.hasIssue,true);assert.equal(issue.issue.taskId,'visual');assert.ok(issue.message.length>0);
console.log('Real model issue:',JSON.stringify(issue));
state.issue=issue.issue;
const unresolved=await post('decision',{state,text:'I cannot finish by 3 PM. I do not have another plan yet.'});
assert.equal(unresolved.accepted,false,'An unresolved blocker cannot resume the task.');
const resolved=await post('decision',{state,text:'I will use the approved product render and deliver the first draft by 3 PM. I will check in at 2:30 PM.'});
assert.equal(resolved.accepted,true);assert.ok(resolved.commitment.length>0);
console.log('Real model decision:',JSON.stringify(resolved));
console.log('PASS: live planning, no-issue check, risk detection, unresolved reply, and commitment interpretation. Discord transport remains simulated.');
