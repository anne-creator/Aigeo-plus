import type { AgentAdapter } from './agent';
import type { AgentEvent, Issue, Task } from './state';
const base = (runId: string) => ({ id: crypto.randomUUID(), runId });
const time = () => new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
async function request<T>(action: string, input: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/model/${action}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input), signal });
  let data;
  try { data = await response.json(); } catch { throw new Error('Local model service is not running. Start the project with npm run dev or npm start.'); }
  if (!response.ok) throw new Error(data.error || 'Model request failed.');
  return data;
}
// Real model inference; Discord transport is explicitly simulated until connected.
export const modelAgent: AgentAdapter = {
  mode: 'live', dispatchMode: 'simulated',
  async *start({ project, runId }, signal) {
    yield { ...base(runId), type:'progress', label:'Analyzing project and available staff…' };
    const data = await request<{tasks:Task[]}>('plan',{project},signal);
    yield { ...base(runId), type:'planned', tasks:data.tasks };
  },
  async *check({ state, observation }, signal) {
    yield { ...base(state.runId), type:'progress', label:'Checking current project facts…' };
    const data = await request<{hasIssue:boolean; issue:Issue; message:string}>('check',{state,observation},signal);
    if (!data.hasIssue) {
      yield { ...base(state.runId), type:'checked', at:time() };
      return;
    }
    yield { ...base(state.runId), type:'issue', issue:data.issue };
    // This event is a demo transport receipt, never a real Discord delivery claim.
    yield { ...base(state.runId), type:'sent', message:{id:crypto.randomUUID(),author:'agent',text:`[Discord demo · not sent] ${data.message}`,time:time(),delivery:'simulated'} };
  },
  async *receiveDecision({ state, text }, signal) {
    yield { ...base(state.runId), type:'reply', message:{id:crypto.randomUUID(),author:'worker',personId:state.tasks.find(t=>t.id===state.issue?.taskId)?.ownerId,text:`[Test reply] ${text}`,time:time(),delivery:'simulated'} };
    const data = await request<{accepted:boolean;commitment:string;nextCheckIn?:string;note?:string}>('decision',{state,text},signal);
    if (!data.accepted) {
      yield { ...base(state.runId), type:'pending', note:data.note || 'The issue still needs a decision.' };
      return;
    }
    yield { ...base(state.runId), type:'resolved', commitment:data.commitment,nextCheckIn:data.nextCheckIn };
  },
};
