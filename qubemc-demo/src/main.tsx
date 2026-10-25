import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardReducer, columns, restoreBoard, waitingFor } from './board-state';
import type { BoardEvent, BoardTask } from './board-state';
import { company, project } from './redbull-project';
import { configureRuntime, getBoardAdapter, hasRuntime } from './redbull-agent';
import './kanban.css';

const employeeIds = new Set(company.people.map(p => p.id));
const storageKey = `cofloor-board-v2:${company.source?.datasetId}:${project.workflowId}`;
const modeKey = `${storageKey}:mode`;
const businessDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: project.timezone }).format(new Date(`${project.businessDate}T12:00:00-07:00`));
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
function Icon({ name, size = 20 }: { name: 'grid' | 'arrow' | 'file' | 'clock' | 'activity' | 'close' | 'chevron'; size?: number }) {
  const paths = { grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', arrow: 'M5 12h14 M13 6l6 6-6 6', file: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6', clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', activity: 'M3 12h4l3-8 4 16 3-8h4', close: 'M6 6l12 12 M18 6L6 18', chevron: 'M9 5l7 7-7 7' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function Avatar({ id }: { id: string }) {
  const p = company.people.find(person => person.id === id);
  return <span className={`avatar ${p?.color ?? 'mint'}`} aria-hidden="true">{p?.initials ?? '?'}</span>;
}
function TaskCard({ task, tasks, onOpen }: { task: BoardTask; tasks: BoardTask[]; onOpen: () => void }) {
  const person = company.people.find(p => p.id === task.ownerId);
  const waiting = waitingFor(task, tasks);
  return <button className={`board-card ${task.blockedReason ? 'is-blocked' : ''}`} onClick={onOpen} aria-label={`${task.id}: ${task.title}, assigned to ${person?.name}`}>
    <div className="card-top"><span className="task-id">{task.id}</span><Icon name="chevron" size={15}/></div>
    <h3>{task.title}</h3>
    <p className="card-description">{task.requirements}</p>
    {waiting.length > 0 && <span className="dependency-tag"><span className="tag-dot"/>{task.id === 'RB-02' ? 'Waiting for outline' : `Waiting for ${waiting.join(', ')}`}</span>}
    {task.blockedReason && <span className="blocked-tag">Blocked · {task.blockedReason}</span>}
    <div className="card-deliverable"><Icon name="file" size={14}/><span>{task.outputs[0] ?? 'Deliverable pending'}</span></div>
    <div className="card-footer"><span className="card-person"><Avatar id={task.ownerId}/><span>{person?.name ?? task.ownerId}</span></span><span className="card-due"><Icon name="clock" size={13}/>{task.due}</span></div>
  </button>;
}
function Drawer({ titleId, children, onClose }: { titleId: string; children: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const previous = trigger.current;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="detail-drawer" aria-labelledby={titleId} onCancel={onClose} onClose={onClose} onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }} onClick={e => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  }}><button className="drawer-close icon-button" aria-label="Close details" onClick={onClose}><Icon name="close"/></button>{children}</dialog>;
}
function App() {
  const [state, dispatch] = useReducer(boardReducer, undefined, () => restoreBoard(read(storageKey), employeeIds));
  const [live, setLive] = useState(() => read(modeKey) === 'live');
  const [saved, setSaved] = useState(true);
  const [controls, setControls] = useState(false);
  const [activity, setActivity] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [, updateRuntimeStatus] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  const started = state.phase === 'active';
  const planning = state.phase === 'planning';
  const selected = state.tasks.find(t => t.id === selectedId);
  const emit = (event: BoardEvent) => dispatch({ type: 'event', event, employeeIds });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); localStorage.setItem(modeKey, live ? 'live' : 'development'); setSaved(true); }
    catch { setSaved(false); }
  }, [state, live]);
  useEffect(() => () => controller.current?.abort(), []);
  // Read-only discovery for the NemoClaw backend harness.
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/board/status', { signal: abort.signal }).then(r => r.ok ? r.json() : null).then(data => {
      configureRuntime(Boolean(data?.configured)); updateRuntimeStatus(n => n + 1);
    }).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!live || !started) return;
    try { return getBoardAdapter(true).subscribe?.(emit); } catch { /* Start surfaces connection errors. */ }
  }, [live, started, state.runId]);
  async function start() {
    if (running.current) return;
    const runId = crypto.randomUUID(), abort = new AbortController();
    running.current = true; controller.current = abort; setControls(false);
    dispatch({ type: 'start', runId });
    try {
      let receivedResult = false;
      for await (const event of getBoardAdapter(live).start({ project, company, runId }, abort.signal)) {
        if (event.type === 'planned' || event.type === 'failed') receivedResult = true;
        if (!abort.signal.aborted) emit(event);
      }
      if (!receivedResult && !abort.signal.aborted) throw new Error('Agent finished without returning an intake plan.');
    } catch (error) {
      if (!abort.signal.aborted) emit({ id: crypto.randomUUID(), runId, type: 'failed', message: error instanceof Error ? error.message : 'Agent request failed.' });
    } finally { if (controller.current === abort) { running.current = false; controller.current = null; } }
  }
  function reset() {
    controller.current?.abort(); controller.current = null; running.current = false;
    dispatch({ type: 'reset' }); setControls(false); setSelectedId(null); setActivity(false);
  }
  return <div className="app-shell">
    <header className="topbar"><a href="#" className="brand" aria-label="CoFloor home"><span className="brand-symbol"><Icon name="grid" size={18}/></span>CoFloor</a><div className="topbar-divider"/><span className="workspace-name">Bridgewell Creative</span><span className="workspace-label">WORKSPACE</span><div className="topbar-actions"><span className={`runtime-pill ${live ? 'live' : ''}`}><span className="status-dot"/>{live ? (hasRuntime() ? 'Live agent' : 'Agent disconnected') : 'Reference demo'}</span><div className="settings-wrap"><button className="icon-button" aria-label="Project settings" aria-expanded={controls} onClick={() => setControls(!controls)}>•••</button>{controls && <div className="settings-panel"><strong>Project settings</strong><label><input type="checkbox" checked={live} disabled={state.phase !== 'idle'} onChange={e => setLive(e.target.checked)}/>Use live agent</label><p>{live ? 'Requires a runtime supporting the Red Bull intake contract.' : 'Assignments use the document’s reference people. No model inference or Discord delivery.'}</p><button className="secondary-button" onClick={reset}>Reset project</button></div>}</div></div></header>
    <main className="dashboard">
      <nav className="breadcrumb" aria-label="Breadcrumb"><span>Projects</span><Icon name="chevron" size={13}/><span>Red Bull X launch</span></nav>
      <section className="project-heading"><div><div className="project-kicker"><span className="project-emblem">RB</span><span>{project.id}</span><span className="neutral-pill">{started ? 'Active' : 'Project setup'}</span></div><h1>{project.title}<span className="heading-suffix">X launch</span></h1><p>One post. One launch image. A coordinated team.</p></div><div className="deadline-block"><span>CLIENT APPROVAL</span><strong>{project.deadline}<small> PT</small></strong><p>{businessDate}</p></div></section>
      <div className="project-meta"><span><Icon name="clock" size={15}/>Simulated business date · Oct 26</span><span>Release <strong>{project.releaseTime} PT</strong></span><span>Closeout <strong>{project.closeoutTime} PT</strong></span><span className="company-summary"><strong>{company.people.length.toLocaleString()}</strong> employees<span className="meta-dot"/>{company.departments.length} departments</span></div>
      <div className="view-bar"><span className="view-tab"><Icon name="grid" size={16}/>{started ? 'Task board' : 'Project brief'}</span><span className="view-spacer"/>{started && <button className="quiet-button" onClick={() => setDocumentOpen(true)}><Icon name="file" size={16}/>Brief</button>}<button className={`quiet-button ${activity ? 'selected' : ''}`} aria-expanded={activity} aria-controls="project-activity" onClick={() => setActivity(!activity)}><Icon name="activity" size={16}/>Activity</button></div>
      {state.error && <div className="error-banner" role="alert"><span>{state.error}</span><button onClick={reset}>Reset & retry</button></div>}
      {!saved && <p className="storage-warning" role="status">Browser storage is unavailable. This session will not survive a refresh.</p>}
      <div className={`content-layout ${activity ? 'with-activity' : ''}`}>
        <section className="main-content" aria-label={started ? 'Task board' : 'Project brief'}>
          {!started ? <div className="intake-layout"><article className="brief-panel"><div className="section-eyebrow">CLIENT REQUEST</div><h2>A new flavor, ready for launch.</h2><p className="brief-description">{project.brief}</p><div className="brief-deliverables"><h3>Deliverables</h3><div>{project.deliverables.map(d => <span key={d}>{d}</span>)}</div></div><div className="source-document"><span className="document-symbol"><Icon name="file" size={22}/></span><div><strong>Project requirements</strong><span>{project.file}</span></div><button className="quiet-button" onClick={() => setDocumentOpen(true)}>View original<Icon name="chevron" size={15}/></button></div><div className="brief-actions"><span>{live ? 'Ready for the connected agent' : 'Reference assignments · no model inference'}</span><button className="primary-button" onClick={() => void start()} disabled={planning}>{planning ? (state.error ? 'Reset to retry' : <><span className="spinner"/>Preparing tasks</>) : <>Start project<Icon name="arrow" size={18}/></>}</button></div>{planning && !state.error && <p className="planning-label" role="status">{state.label || 'Preparing project…'}</p>}</article><aside className="intake-note"><div className="section-eyebrow">START WITH DIRECTION</div><div className="step-number">01</div><h3>Outline first.<br/>Production follows.</h3><p>A strategist prepares the launch outline. The Creative Director then approves the direction and image headline.</p><div className="note-rule"/><p>Copy and design tasks are created after approval, using the approved outline.</p><span className="small-caption">Fictional client engagement · synthetic company data</span></aside></div> : <>
            <div className="board-caption"><span><strong>{state.tasks.length} tasks</strong><span className="meta-dot"/>{state.tasks.filter(t => t.status === 'done').length} completed</span><span>{live ? 'Updated by agent events' : 'Document reference assignments'}</span></div>
            <div className="kanban-scroll" role="region" aria-label="Kanban board" tabIndex={0}><div className="kanban-board">{columns.map(column => {
              const tasks = state.tasks.filter(t => t.status === column.status);
              return <section className={`kanban-column column-${column.status}`} key={column.status} aria-label={`${column.label}: ${tasks.length} tasks`}><div className="column-heading"><span className="column-indicator"/><h2>{column.label}</h2><span className="column-count">{tasks.length}</span></div><div className="column-content">{tasks.length ? tasks.map(task => <TaskCard key={task.id} task={task} tasks={state.tasks} onOpen={() => setSelectedId(task.id)}/>) : <div className="column-empty"><span className="empty-mark">—</span><p>{column.empty}</p></div>}</div></section>;
            })}</div></div><p className="board-footnote">{live ? 'Tasks move as the agent reports progress.' : 'Reference demo · connect an agent for live progress updates.'}</p>
          </>}
        </section>
        {activity && <aside className="activity-panel" id="project-activity"><div className="activity-heading"><h2>Project activity</h2><button className="icon-button" aria-label="Close activity" onClick={() => setActivity(false)}><Icon name="close" size={17}/></button></div><span className="activity-mode">{live ? 'Agent events' : 'Reference demo'}</span>{state.activity.length ? <ol>{state.activity.map((item, i) => <li key={i}><span className="timeline-dot"/><p>{item}</p></li>)}</ol> : <p className="activity-empty">Project updates will appear here.</p>}<div className="activity-notice">{live ? 'Only events from the connected runtime are shown.' : 'No model inference or Discord delivery has taken place.'}</div></aside>}
      </div>
      <footer><span>CoFloor<span className="meta-dot"/>Project coordination</span><span>{live ? 'Connected runtime results only' : 'Reference demo · simulated engagement'}</span></footer>
    </main>
    {selected && <Drawer titleId="task-detail-title" onClose={() => setSelectedId(null)}><div className="section-eyebrow">TASK DETAILS · {selected.id}</div><h2 id="task-detail-title">{selected.title}</h2><span className="detail-status">{columns.find(c => c.status === selected.status)?.label}</span><div className="detail-person"><Avatar id={selected.ownerId}/><div><strong>{company.people.find(p => p.id === selected.ownerId)?.name}</strong><span>{company.people.find(p => p.id === selected.ownerId)?.role}</span></div></div><dl className="task-facts"><div><dt>Deadline</dt><dd>{businessDate} · {selected.due} PT</dd></div><div><dt>Employee</dt><dd>{selected.ownerId}</dd></div></dl><h3>Requirements</h3><p>{selected.requirements}</p><h3>Deliverables</h3><ul>{selected.outputs.map(output => <li key={output}>{output}</li>)}</ul><h3>Dependencies</h3>{selected.dependencies.length ? <ul>{selected.dependencies.map(id => <li key={id}>{id} · {state.tasks.find(t => t.id === id)?.title} — {state.tasks.find(t => t.id === id)?.status === 'done' ? 'Complete' : 'Waiting'}</li>)}</ul> : <p>No dependencies. Ready to start.</p>}{selected.blockedReason && <p className="blocked-tag">Blocked · {selected.blockedReason}</p>}<button className="secondary-button drawer-document" onClick={() => { setSelectedId(null); setDocumentOpen(true); }}>View project requirements<Icon name="file" size={16}/></button></Drawer>}
    {documentOpen && <Drawer titleId="document-title" onClose={() => setDocumentOpen(false)}><div className="section-eyebrow">ORIGINAL DOCUMENT</div><h2 id="document-title">Project requirements</h2><p className="document-filename">{project.file}</p><a className="secondary-button download-link" download={project.file} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(project.document.content)}`}>Download Markdown<Icon name="file" size={16}/></a><pre className="document-content">{project.document.content}</pre></Drawer>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
