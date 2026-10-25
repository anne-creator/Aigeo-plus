import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { reducer, restore } from './state';
import type { AgentEvent, Person } from './state';
import { company, project } from './data';
import { getAdapter } from './agent';
import './style.css';
const storageKey = 'qubemc-demo-v1';
const Arrow = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7"/></svg>;
function Avatar({person,small=false}:{person?:Person;small?:boolean}) {return <span className={`avatar ${person?.color ?? 'mint'} ${small?'small':''}`}>{person?.initials ?? '?'}</span>}
function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => {try{return restore(localStorage.getItem(storageKey))}catch{return restore(null)}});
  const [controls,setControls] = useState(false);
  const [live,setLive] = useState(() => {try{return localStorage.getItem('qubemc-mode')==='live'}catch{return false}});
  const [saved,setSaved] = useState(true);
  const controller = useRef<AbortController|null>(null);
  const running = useRef(false);
  const worker = company.people.find(p=>p.id===state.tasks.find(t=>t.id===state.issue?.taskId)?.ownerId);
  useEffect(()=> {try{localStorage.setItem(storageKey,JSON.stringify(state));setSaved(true)}catch{setSaved(false)}},[state]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=> {try{localStorage.setItem('qubemc-mode',live?'live':'development')}catch{}},[live]);
  useEffect(()=> {if(!live)return;try{return getAdapter(true).subscribe?.(event=>dispatch({type:'event',event}))}catch{}},[live]);
  async function run(operation:(signal:AbortSignal)=>AsyncIterable<AgentEvent>, runId:string) {
    if(running.current)return;
    running.current=true;const abort=new AbortController();controller.current=abort;
    try {for await(const event of operation(abort.signal)){if(!abort.signal.aborted)dispatch({type:'event',event})}}
    catch(error){if(!abort.signal.aborted)dispatch({type:'event',event:{id:crypto.randomUUID(),runId,type:'failed',message:error instanceof Error?error.message:'Something went wrong. Please retry.'}})}
    finally {if(controller.current===abort){running.current=false;controller.current=null}}
  }
  function start(){if(running.current)return;const runId=crypto.randomUUID();dispatch({type:'start',runId});void run(signal=>getAdapter(live).start({project,company,runId},signal),runId)}
  function check(){if(running.current||state.phase!=='monitoring')return;dispatch({type:'check'});setControls(false);void run(signal=>getAdapter(live).check({project,company,state,observation:live?'': 'Approved product photography will arrive after the visual production checkpoint.'},signal),state.runId)}
  function reply(){if(running.current||state.phase!=='awaiting')return;dispatch({type:'reply-start'});setControls(false);void run(signal=>getAdapter(live).receiveDecision({state,text:'Yes — I’ll use the approved render. First draft by 3 PM, and I’ll check in at 2:30.'},signal),state.runId)}
  function reset(){controller.current?.abort();controller.current=null;running.current=false;dispatch({type:'reset'});setControls(false)}
  const planning=state.phase==='planning';
  const started=state.tasks.length>0;
  const execution=started&&state.phase!=='assigned';
  const problem=['notifying','awaiting','interpreting'].includes(state.phase);
  const resumed=state.phase==='resumed';
  const busy=['planning','analyzing','notifying','interpreting'].includes(state.phase)&&!state.error;
  return <div className="app">
    <header><a href="#" className="brand" aria-label="QubeMC home"><span className="brand-mark">q<span>·</span></span>QubeMC</a><div className="header-right"><span className="mode"><i/>{live?(window.qubemcAgent?.mode==='live'?'Local Agent':'Local Agent disconnected'):'Development · Mock'}</span><div className="control-wrap"><button className="menu-button" aria-label="Demo controls" aria-expanded={controls} onClick={()=>setControls(!controls)}>•••</button>{controls&&<div className="control-panel"><span className="eyebrow">DEMO CONTROLS</span><button onClick={()=>{if(state.phase==='assigned'){dispatch({type:'monitor'});setControls(false)}}} disabled={state.phase!=='assigned'}>Skip to project in progress <Arrow/></button><button onClick={check} disabled={state.phase!=='monitoring'}>{live?'Check latest project state':'Inject delayed photography'} <Arrow/></button><button onClick={reply} disabled={state.phase!=='awaiting'||live}>Simulate worker reply <Arrow/></button><label className="live-toggle"><input type="checkbox" checked={live} disabled={state.phase!=='idle'} onChange={e=>setLive(e.target.checked)}/>Use local runtime</label><small>{live?'Requires an installed local Agent adapter.':'Synthetic company data. Model & Discord not connected.'}</small><button onClick={reset} className="reset-button">Reset demo ↺</button></div>}</div></div></header>
    <main>
      <div className="project-top"><div className="breadcrumb">WORKSPACE <span>/</span> NEW PRODUCT LAUNCH</div><div className="date">PROJECT 001 <span>↗</span></div></div>
      <section className="hero"><div><div className="eyebrow">{execution?'PROJECT / IN PROGRESS':'PROJECT / SETUP'}</div><h1>{resumed?'Project updated':problem?'Decision needed':execution?'Project in progress':'Product launch'}</h1></div><div className={`project-status ${problem?'amber':''}`}><span className="eyebrow">DEADLINE</span><span className="deadline">4:00 <small>PM</small></span><div className="deadline-foot"><span className="status-tag"><i/>{problem?'Needs attention':resumed?'In progress':execution?'In progress':started?'Assigned':'Ready'}</span></div></div></section>
      {state.error&&<div role="alert" className="error"><span>{state.error}</span><button onClick={reset}>Reset & retry ↗</button></div>}
      {!saved&&<div role="status" className="storage-note">Browser storage is unavailable. This session will not survive a refresh.</div>}
      <div className={`workspace ${started?'has-team':''}`}>
        <section className="work-area" aria-label="Project tasks">
          <div className="section-top"><h2>{started?'Tasks':'Project brief'}</h2><span className="subtle">{started?`${state.tasks.length} workstreams`:'THE BRIEF'}</span></div>
          {!started?<div className="brief-card"><div className="brief-top"><span className="file-icon">↗</span><span>{project.file}</span><span className="file-type">BRIEF</span></div><h3>New product launch</h3><div className="deliverables"><span>3 social posts</span><span>1 key visual</span></div><div className="asset-list">{project.assets.map(a=><span key={a}><b>✓</b>{a}</span>)}</div><div className="brief-bottom"><button className="primary" onClick={start} disabled={planning}>{planning&&!state.error?<><span className="spinner"/>Arranging your team</>:<>Start Project<Arrow/></>}</button></div></div>:<div className="task-list">{state.tasks.map((task,i)=>{const person=company.people.find(p=>p.id===task.ownerId);const affected=task.id===state.issue?.taskId;return <article key={task.id} className={`task-card ${affected&&problem?'needs-attention':''} ${affected&&resumed?'resolved':''}`}><div className="task-number">0{i+1}</div><div className="task-content"><div className="task-heading"><h3>{task.title}</h3><span className={`task-status ${task.status}`}>{task.status==='attention'?'Needs attention':task.status==='working'?'In progress':'Assigned'}</span></div><div className="task-owner"><Avatar person={person}/><div><strong>{person?.name??task.ownerId}</strong><span>{person?.role??'Project team'}</span></div><div className="task-due"><span>DUE TODAY</span><strong>{task.due}</strong></div></div>{task.commitment&&<div className="commitment"><span>✓</span>{task.commitment}</div>}</div></article>})}</div>}
          {planning&&!state.error&&<div role="status" aria-live="polite" className="working-label"><span className="pulse"/>{state.label||'Starting your project…'}</div>}
          {started&&<div className="work-footer"><span className="mini-check">✓</span><span>{resumed?(state.nextCheckIn?`Next check-in · ${state.nextCheckIn}`:'Updated'):state.phase==='assigned'?'Assigned':'In progress'}</span>{state.phase==='assigned'&&<button className="text-button" onClick={()=>dispatch({type:'monitor'})}>View project in progress <Arrow/></button>}</div>}
        </section>
        <aside className="side-area">
          {!execution?<><div className="section-top"><h2>Company</h2></div><div className="company-card"><div className="company-stat">{company.people.length.toLocaleString()}<span>Employees</span></div><div className="dot-field" aria-hidden="true">{Array.from({length:216},(_,i)=><i key={i} className={started&&[24,57,99,128,163,188].includes(i)?'highlight':''}/>)}</div><div className="company-bottom"><span>{company.departments.length} departments</span><span>Synthetic dataset</span></div></div></>:<><div className="section-top"><h2>{state.issue?'Discord':'Monitoring'}</h2><span className="subtle">{state.issue?'DISCORD':'PROJECT PULSE'}</span></div><div className={`conversation ${problem?'attention-border':''}`}>
          <div className="channel"><span className="discord-icon">◧</span><strong># product-launch</strong><span className="channel-dot"/></div>
          {!state.issue?<div className="watch"><div className={`watch-symbol ${busy?'rotating':''}`}>✳</div><h3>{state.phase==='analyzing'?'Analyzing':'Monitoring'}</h3><p>{state.phase==='analyzing'?state.label:'No issues detected'}</p></div>:<><div className="issue-summary"><span className={`eyebrow ${resumed?'green-text':'amber-text'}`}>{resumed?'✓ DECISION RECEIVED':'↗ NEEDS A DECISION'}</span><h3>{resumed?'Decision received':state.issue.title}</h3><p>{resumed?state.tasks.find(t=>t.id===state.issue?.taskId)?.commitment:state.issue.detail}</p></div><div className="messages" aria-live="polite">{state.messages.map(m=><div key={m.id} className="message"><span className={m.author==='agent'?'agent-avatar':'worker-avatar'}>{m.author==='agent'?'q':worker?.initials??'W'}</span><div><div className="message-meta"><strong>{m.author==='agent'?'QubeMC':worker?.name??'Team member'}</strong>{m.author==='agent'&&<span className="bot-tag">AGENT</span>}<time>{m.time}</time></div><p>{m.text}</p></div></div>)}{state.phase==='notifying'&&<div className="waiting"><span className="spinner"/>Preparing the notification…</div>}{state.phase==='awaiting'&&<div className="waiting"><span className="pulse amber-pulse"/>Waiting for {worker?.name.split(' ')[0]??'the worker'}’s decision</div>}{state.phase==='interpreting'&&<div className="waiting"><span className="spinner"/>Updating the next step…</div>}{resumed&&<div className="reply-received">✓ Decision recorded{state.nextCheckIn?` · check-in ${state.nextCheckIn}`:''}</div>}</div></>}
          </div></>}
        </aside>
      </div>
      <footer><span>{live?'LOCAL AGENT RUNTIME':'DEVELOPMENT · MODEL & DISCORD NOT CONNECTED'}</span><span>QUBEMC</span></footer>
    </main>
  </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
