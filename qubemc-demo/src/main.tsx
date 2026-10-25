import { NarrationQueue, browserVoiceDriver } from './narration';
import type { VoiceView } from './narration';
import { VoiceNarration } from './VoiceNarration';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardReducer, columns, initialBoard, waitingFor } from './board-state';
import type { BoardEvent, BoardTask } from './board-state';
import { createDisplayLabels } from './display';
import { company, project } from './redbull-project';
import { configureRuntime, getBoardAdapter, hasRuntime } from './redbull-agent';
import { bindDashboardWheel } from './dashboard-gesture';
import './kanban.css';
import './dashboard-focus.css';
import { AllocationAnimation } from './AllocationAnimation';
import { dashboardStage, canRevealProject, observeBoard, emptyObservation } from './dashboard-presentation';
import { ProjectScene } from './scene/ProjectScene';

const employeeIds = new Set(company.people.map(p => p.id));
const storageKey = `cofloor-board-v3-live:${company.source?.datasetId}:${project.workflowId}`;
const modeKey = `${storageKey}:mode`;
const requestedRun = new URLSearchParams(window.location.search).get('run') || '';
const sharedRun = /^[-\w]{1,100}$/.test(requestedRun) ? requestedRun : '';
const businessDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: project.timezone }).format(new Date(`${project.businessDate}T12:00:00-07:00`));
type IconName = 'grid' | 'arrow' | 'file' | 'clock' | 'activity' | 'close' | 'chevron' | 'home' | 'users' | 'camera' | 'chart' | 'settings' | 'collapse' | 'check';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    arrow: 'M5 12h14 M13 6l6 6-6 6', file: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6',
    clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    activity: 'M3 12h4l3-8 4 16 3-8h4', close: 'M6 6l12 12 M18 6L6 18', chevron: 'M9 5l7 7-7 7',
    home: 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    camera: 'M3 7h4l2-3h6l2 3h4v13H3z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    chart: 'M4 20V10 M12 20V4 M20 20v-7', settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
    collapse: 'M4 9l8 8 8-8', check: 'M5 12l4 4L19 6',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function Avatar({ id }: { id: string }) {
  const p = company.people.find(person => person.id === id);
  return <span className={`avatar ${p?.color ?? 'mint'}`} aria-hidden="true">{p?.initials ?? '?'}</span>;
}
function TaskCard({ task, tasks, changed, onOpen }: { task: BoardTask; tasks: BoardTask[]; changed: boolean; onOpen: () => void }) {
  const person = company.people.find(p => p.id === task.ownerId);
  const waiting = waitingFor(task, tasks);
  const labels = createDisplayLabels(company.people, tasks);
  return <button className={`board-card ${task.blockedReason ? 'is-blocked' : ''} ${changed ? 'recently-changed' : ''}`} onClick={onOpen} aria-label={`${labels.text(task.title)}, assigned to ${labels.person(task.ownerId)}`}>
    <div className="card-top"><span aria-hidden="true"/><Icon name="chevron" size={13}/></div>
    <h3>{labels.text(task.title)}</h3>
    <span className="card-person task-owner"><Avatar id={task.ownerId}/><span>{person?.name ?? 'Team member'}</span></span>
    {(waiting.length > 0 || task.blockedReason) && <span className={`task-marker ${task.blockedReason ? 'blocked-tag' : 'dependency-tag'}`} title={task.blockedReason ? labels.text(task.blockedReason) : `Waiting for ${waiting.map(labels.task).join(', ')}`}><Icon name="clock" size={11}/>{task.blockedReason ? 'Blocked' : `${waiting.length} ${waiting.length === 1 ? 'dependency' : 'dependencies'}`}</span>}
    <div className="card-footer"><span className="task-state">{columns.find(c => c.status === task.status)?.label}</span><span className="card-due">{task.due}</span></div>
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
    const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
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
  const [state, dispatch] = useReducer(boardReducer, sharedRun ? {...initialBoard,runId:sharedRun,phase:'active' as const} : initialBoard);
  const [voiceView, setVoiceView] = useState<VoiceView>(() => {
    let muted = false;
    try { muted = localStorage.getItem('cofloor-voice-muted') === 'true'; } catch { /* Storage is optional. */ }
    return {text:'', status:muted?'muted':'idle', muted};
  });
  const voiceRef = useRef<NarrationQueue | null>(null);
  if (!voiceRef.current) voiceRef.current = new NarrationQueue(browserVoiceDriver(), setVoiceView, voiceView.muted);
  const voice = voiceRef.current;
  useEffect(() => {
    if (state.phase === 'active' && state.tasks.length) voice.observe(state);
  }, [voice, state]);
  useEffect(() => () => voice.stop(), [voice]);
  function toggleVoice() {
    const muted = !voiceView.muted;
    try { localStorage.setItem('cofloor-voice-muted', String(muted)); } catch { /* Storage is optional. */ }
    voice.mute(muted);
  }
  const live = true;
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [hydratedRun, setHydratedRun] = useState('');
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [saved, setSaved] = useState(true);
  const [controls, setControls] = useState(false);
  const [activity, setActivity] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [scenePlaying, setScenePlaying] = useState(true);
  const [ambientScene, setAmbientScene] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [readyRun, setReadyRun] = useState('');
  const [entryRun, setEntryRun] = useState('');
  const revealedRun = useRef('');
  const currentState = useRef(state);
  currentState.current = state;
  const stage = dashboardStage(state, readyRun);
  const locked = stage === 'assigning' || stage === 'setup-error' || stage === 'entering';
  const dashboardVisible = dashboardOpen && !locked;
  const shellRef = useRef<HTMLDivElement>(null);
  const sceneReady = useCallback((runId: string) => {
    if (!canRevealProject(currentState.current, runId, revealedRun.current)) return;
    revealedRun.current = runId;
    setReadyRun(runId);
    setDashboardOpen(true);
  }, []);
  useEffect(() => {
    if (shellRef.current && !locked) return bindDashboardWheel(shellRef.current, setDashboardOpen);
  }, [locked]);
  const [observation, setObservation] = useState(emptyObservation);
  useEffect(() => {
    setObservation(previous => observeBoard(previous, state, Date.now()));
  }, [state.runId, state.phase, state.tasks]);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const changeKey = observation.entries.map(entry => entry.id).join('|');
  useEffect(() => {
    setHighlighted(observation.changedTaskIds);
    const timer = setTimeout(() => setHighlighted([]), 5000);
    return () => clearTimeout(timer);
  }, [changeKey, state.runId]);
  const boardRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [, updateRuntimeStatus] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  const started = state.phase === 'active';
  const restoring = started && state.tasks.length === 0;
  const selected = state.tasks.find(t => t.id === selectedId);
  const labels = createDisplayLabels(company.people, state.tasks);
  const emit = (event: BoardEvent) => dispatch({ type: 'event', event, employeeIds });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); localStorage.setItem(modeKey, live ? 'live' : 'development'); setSaved(true); }
    catch { setSaved(false); }
  }, [state, live]);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; running.current = false; }, []);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/model/status', { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]) }).then(r => r.ok ? r.json() : null).then(data => {
      if (abort.signal.aborted) return;
      configureRuntime(Boolean(data?.configured)); updateRuntimeStatus(n => n + 1); setRuntimeReady(true);
    }).catch(() => { if (!abort.signal.aborted) { configureRuntime(false); setRuntimeReady(true); } });
    return () => abort.abort();
  }, []);
  async function operation(action: 'state' | 'check' | 'decision', extra: Record<string, unknown> = {}) {
    if (running.current) return;
    const runId = state.runId, abort = new AbortController();
    running.current = true; controller.current = abort;
    dispatch({ type: 'operation', operation: action === 'decision' ? 'deciding' : 'checking' });
    try {
      const run = await getBoardAdapter().request(action, { runId, ...extra }, abort.signal);
      if (!abort.signal.aborted) {
        emit({ id: crypto.randomUUID(), runId, type: 'snapshot', run }); setHydratedRun(runId);
        if (action === 'decision') setReplyText('');
      }
    } catch (error) {
      if (!abort.signal.aborted) emit({ id: crypto.randomUUID(), runId, type: 'failed', message: error instanceof Error ? error.message : 'Model request failed.' });
    } finally { if (controller.current === abort) { running.current = false; controller.current = null; } }
  }
  useEffect(() => {
    if (runtimeReady && started && hydratedRun !== state.runId && !state.error) void operation('state');
  }, [runtimeReady, started, state.runId, hydratedRun]);
  useEffect(() => {
    if (!started || hydratedRun !== state.runId) return;
    const timer = setInterval(() => { if (!running.current) void operation('state'); }, 5000);
    return () => clearInterval(timer);
  }, [started, hydratedRun, state.runId]);
  async function start() {
    if (!runtimeReady || running.current) return;
    const runId = crypto.randomUUID(), abort = new AbortController();
    running.current = true; controller.current = abort; setControls(false); setSelectedId(null); setActivity(false); setDecisionOpen(false); setReplyText(''); setHydratedRun('');
    setDashboardOpen(false); setReadyRun(''); setEntryRun(runId); setDocumentOpen(false); setTeamOpen(false);
    voice.start(runId);
    dispatch({ type: 'start', runId });
    try {
      let receivedResult = false;
      for await (const event of getBoardAdapter().start({ project, company, runId }, abort.signal)) {
        if (abort.signal.aborted) break;
        if (event.type === 'snapshot') { receivedResult = true; setHydratedRun(runId); const url = new URL(window.location.href); url.searchParams.set('run',runId); window.history.replaceState(null,'',url); }
        emit(event);
      }
      if (!receivedResult && !abort.signal.aborted) throw new Error('Agent finished without returning a project allocation.');
    } catch (error) {
      if (!abort.signal.aborted) emit({ id: crypto.randomUUID(), runId, type: 'failed', message: error instanceof Error ? error.message : 'Agent request failed.' });
    } finally { if (controller.current === abort) { running.current = false; controller.current = null; } }
  }
  function reset() {
    controller.current?.abort(); controller.current = null; running.current = false;
    voice.reset();
    setControls(false); setSelectedId(null); setActivity(false); setDecisionOpen(false); setReplyText('');
    setHydratedRun(''); setReadyRun(''); setEntryRun(''); revealedRun.current = '';
    setDocumentOpen(false); setTeamOpen(false); setDashboardOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('run'); window.history.replaceState(null, '', url);
    dispatch({ type: 'reset' });
  }
  const done = state.tasks.filter(t => t.status === 'done').length;
  const owners = [...new Set(state.tasks.map(t => t.ownerId))];
  const counts = columns.map(column => ({ ...column, count: state.tasks.filter(t => t.status === column.status).length }));
  function revealBoard() {
    if (locked) return;
    setDashboardOpen(true);
    requestAnimationFrame(() => { boardRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }); boardRef.current?.focus({ preventScroll: true }); });
  }
  const awaitingDecision = state.issue?.status === 'awaiting';
  const attentionTasks = state.tasks.filter(t => t.status === 'attention' || t.blockedReason);
  const hasAttention = awaitingDecision || attentionTasks.length > 0;
  const refreshAction = state.injection?.status === 'received' || state.proposal?.status === 'invalid' ? 'check' : 'state';
  return <div data-dashboard-stage={stage} ref={shellRef} className={`app-shell night-scene ${scenePlaying ? '' : 'scene-paused'}`}>
    <ProjectScene enterRunId={entryRun} onReady={sceneReady} state={state} playing={scenePlaying && stage !== 'assigning' && stage !== 'setup-error'} ambient={ambientScene} onSelect={id => { if(locked)return; const task=state.tasks.find(t=>t.ownerId===id); if(task)setSelectedId(task.id);else setTeamOpen(true); }}/>
    <header className="topbar">
      <a href="#" className="brand" aria-label="CoFloor home" onClick={e => { e.preventDefault(); if(!locked)setDashboardOpen(true); }}><img className="brand-symbol" src="/logo_cofloor-app-icon.svg" alt="" aria-hidden="true" width="48" height="48"/><span>CoFloor<small>Dashboard</small></span></a>
      <div className="topbar-actions"><button className="scene-toggle" aria-label={scenePlaying ? 'Pause background animation' : 'Play background animation'} title={scenePlaying ? 'Pause animation' : 'Play animation'} aria-pressed={!scenePlaying} onClick={() => setScenePlaying(!scenePlaying)}>{scenePlaying ? <span aria-hidden="true">Ⅱ</span> : <Icon name="arrow" size={14}/>}</button><span className={`runtime-pill ${live ? 'live' : ''}`}><span className="status-dot"/>{live ? (hasRuntime() ? 'Live mode' : 'Disconnected') : 'Reference'}</span><span className="workspace-name">Bridgewell Creative</span><button disabled={locked} className={`dashboard-toggle ${dashboardVisible ? 'is-open' : ''}`} aria-label={dashboardVisible ? 'Hide dashboard' : 'Show dashboard'} aria-expanded={dashboardVisible} aria-controls="dashboard-panel" onClick={() => setDashboardOpen(!dashboardOpen)}><Icon name="grid" size={16}/><span>Dashboard</span><Icon name="collapse" size={14}/></button></div>
    </header>
    <VoiceNarration view={voiceView} onMute={toggleVoice} onEnable={() => void voice.enable()} onRetry={() => voice.retry()}/>
    <nav className="side-rail" aria-label="Workspace">
      <button disabled={locked} className={`nav-circle ${dashboardVisible ? 'on' : ''}`} aria-label="Show dashboard" aria-controls="dashboard-panel" onClick={() => setDashboardOpen(true)} title="Dashboard"><Icon name="home"/></button>
      <button disabled={locked} className="nav-circle" aria-label="Task board" onClick={revealBoard} title="Task board"><Icon name="grid"/></button>
      <button disabled={locked} className="nav-circle" aria-label="Team" onClick={() => setTeamOpen(true)} title="Team"><Icon name="users"/></button>
      {!locked && <a className="nav-circle" aria-label="Face recognition" href="/face-demo.html" title="Face recognition"><Icon name="camera"/></a>}
      <button disabled={locked} className="nav-circle" aria-label="Project requirements" onClick={() => setDocumentOpen(true)} title="Brief"><Icon name="file"/></button>
      <button disabled={locked} className="nav-circle" aria-label="Project activity" onClick={() => setActivity(true)} title="Activity"><Icon name="activity"/></button>
      <div className="settings-wrap"><button disabled={locked} className={`nav-circle ${controls ? 'on' : ''}`} aria-label="Project settings" aria-expanded={controls} aria-controls="project-settings" onClick={() => setControls(!controls)} title="Settings"><Icon name="settings"/></button>{controls && <div className="settings-panel" id="project-settings"><strong>Project settings</strong><label><input type="checkbox" checked={ambientScene} onChange={e=>setAmbientScene(e.target.checked)}/>Ambient animation</label><span className="settings-mode">Live model · automatic allocation</span><span className="settings-mode">{live ? (hasRuntime() ? 'Model configured' : 'Disconnected') : 'Reference demo'}</span><button className="secondary-button" onClick={reset}>Reset project</button></div>}</div>
    </nav>
    {(stage === 'assigning' || stage === 'setup-error') && <section className="assignment-screen" aria-label="Project allocation" data-dashboard-gesture="ignore">
      <AllocationAnimation key={state.runId} playing={scenePlaying && stage === 'assigning' && !restoring}/>
      <div className="assignment-shade"/>
      <div className="assignment-content" role={state.error ? 'alert' : 'status'} aria-live="polite">
        <span className="allocation-eyebrow">{project.title}</span>
        <h1>{restoring ? (state.error ? 'Project unavailable' : 'Opening project') : state.error ? 'Assignment paused' : 'Assigning your team'}</h1>
        {state.error ? <><p className="allocation-error">{labels.text(state.error)}</p><button className="primary-button" disabled={state.operation !== 'idle'} onClick={() => restoring ? void operation('state') : void start()}>Retry<Icon name="arrow"/></button></> : <><p>{restoring ? 'Loading tasks · Syncing updates' : 'Generating tasks · Matching owners'}</p><span className="allocation-loading"><span className="spinner"/>{restoring ? 'Syncing project' : 'Agent working'}</span></>}
      </div>
    </section>}
    <main className={`dashboard focus-dashboard ${started ? 'project-dashboard' : 'global-dashboard'}`} id="dashboard-panel" hidden={!dashboardVisible} aria-label={started ? 'Project dashboard' : 'Global dashboard'}>
      {stage === 'global' && <section className="glass-card launch-card">
        <div className="launch-heading"><span className="project-emblem">RB</span><span>NEW PROJECT</span><button className="toolbar-button" onClick={() => setDocumentOpen(true)}><Icon name="file" size={15}/>Brief</button></div>
        <h1>{project.title}</h1>
        <p className="launch-deliverable">X launch · Copy + image + alt text</p>
        <div className="launch-footer"><div className="launch-deadline"><span>Deliver by</span><strong>{project.deadline} <small>PT</small></strong><span>{businessDate}</span></div><button className="primary-button launch-start" onClick={() => void start()} disabled={!runtimeReady || !hasRuntime()}>Start project<Icon name="arrow"/></button></div>
        <div className="company-context"><span><strong>{company.people.length.toLocaleString()}</strong> People</span><span><strong>{company.departments.length}</strong> Departments</span>{runtimeReady && !hasRuntime() && <span role="status">Model disconnected</span>}</div>
      </section>}
      {stage === 'project' && <>
        <div className="project-focus-toolbar"><div className="project-identity"><span className="project-emblem">RB</span><h1>{project.title}<span>X launch</span></h1></div><div className="project-context"><span className="project-lead"><Avatar id={state.projectOwnerId!}/>{labels.person(state.projectOwnerId!)}</span><span><Icon name="clock" size={14}/>{project.deadline} PT</span><span className="completion-count"><strong>{done}</strong> / {state.tasks.length} done</span><button className="toolbar-button" onClick={() => setDecisionOpen(true)}>Project group</button><button className="toolbar-button" onClick={() => setDocumentOpen(true)}><Icon name="file" size={14}/>Brief</button></div></div>
        {state.error && <div className="error-banner" role="alert"><span>{labels.text(state.error)}</span><button disabled={state.operation !== 'idle'} onClick={() => void operation(refreshAction)}>Retry</button></div>}
        {!saved && <p className="storage-warning" role="status">Storage unavailable</p>}
        <div className={`project-workspace ${hasAttention ? 'has-attention' : ''}`}>
          <section className="glass-card board-panel focus-board" aria-labelledby="board-title" ref={boardRef} tabIndex={-1}>
            <div className="board-heading"><h2 id="board-title">Task board</h2><span>{state.tasks.length}</span><span className="board-live"><i/>In project</span></div>
            <div className="kanban-scroll" role="region" aria-label="Kanban board" tabIndex={0}><div className="kanban-board">{counts.map(column => <section className={`kanban-column column-${column.status}`} key={column.status} aria-label={`${column.label}: ${column.count} tasks`}><div className="column-heading"><span className="column-indicator"/><h3>{column.label}</h3><span className="column-count">{column.count}</span></div><div className="column-content">{state.tasks.filter(t => t.status === column.status).map(task => <TaskCard key={task.id} task={task} tasks={state.tasks} changed={highlighted.includes(task.id)} onOpen={() => setSelectedId(task.id)}/>)}{column.count === 0 && <span className="column-empty">—</span>}</div></section>)}</div></div>
          </section>
          {hasAttention && <section className="glass-card attention-panel" aria-labelledby="attention-title"><div className="section-header"><h2 id="attention-title">Needs attention</h2><span className="attention-dot"/></div>
            {awaitingDecision && <div className="decision-summary"><span className="attention-label">{state.proposal?.status === 'pending' ? 'Awaiting confirmation' : 'Decision needed'}</span><h3>{labels.task(state.issue!.taskId)}</h3><p>{state.proposal?.status === 'pending' ? `${state.proposal.updates.length} proposed changes` : state.proposal?.status === 'unavailable' ? 'No feasible reassignment' : labels.text(state.issue!.title)}</p><button className="primary-button" onClick={() => setDecisionOpen(true)}>{state.proposal?.status === 'pending' ? 'Review proposal' : 'Review issue'}<Icon name="arrow" size={15}/></button></div>}
            {attentionTasks.filter(t => !awaitingDecision || t.id !== state.issue?.taskId).map(task => <button key={task.id} className="attention-task" onClick={() => setSelectedId(task.id)}><span>{labels.text(task.title)}<small>{task.blockedReason ? labels.text(task.blockedReason) : 'Needs attention'}</small></span><Icon name="chevron" size={14}/></button>)}
          </section>}
          <section className="glass-card changes-panel" aria-labelledby="changes-title"><div className="section-header"><h2 id="changes-title">Latest changes</h2><button className="card-link" aria-label="View all project activity" onClick={() => setActivity(true)}><Icon name="arrow" size={16}/></button></div>
            <div className="sync-row"><span>{state.operation === 'checking' ? 'Syncing…' : observation.syncedAt ? `Synced ${new Date(observation.syncedAt).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'})}` : 'Not synced'}</span><button className="sync-button" disabled={state.operation !== 'idle'} onClick={() => void operation(refreshAction)}>{state.operation === 'checking' ? <span className="spinner"/> : <Icon name="activity" size={14}/>}Refresh</button></div>
            <ol className="change-feed">{observation.entries.map(entry => <li key={entry.id}><button onClick={() => entry.taskId ? setSelectedId(entry.taskId) : setTeamOpen(true)}><span className={`change-indicator change-${entry.kind}`}/><span><strong>{labels.text(entry.title)}</strong><span className="change-detail">{entry.kind === 'ready' ? `${entry.count} tasks assigned` : entry.kind === 'owner' ? `${labels.person(entry.previousOwnerId!)} → ${labels.person(entry.ownerId!)}` : entry.kind === 'status' ? columns.find(c => c.status === entry.status)?.label : ({created:'Task added',blocked:'Blocked',unblocked:'Blocker cleared',schedule:'Schedule updated'} as Record<string,string>)[entry.kind]}</span><small>Observed on sync</small></span></button></li>)}</ol>
          </section>
        </div>
      </>}
    </main>
    {activity && <Drawer titleId="activity-title" onClose={() => setActivity(false)}><div className="section-eyebrow">{live ? 'Live agent' : 'Reference'}</div><h2 id="activity-title">Project activity<span className="drawer-count">{state.activity.length}</span></h2>{state.activity.length ? <ol className="activity-list">{state.activity.map((item, i) => <li key={i}>{labels.text(item)}</li>)}</ol> : <span className="drawer-zero">0</span>}</Drawer>}
    {decisionOpen && <Drawer titleId="decision-title" onClose={() => setDecisionOpen(false)}><div className="section-eyebrow">{state.transport === 'discord' ? 'Discord · NemoClaw' : 'Red Bull group · Discord transport pending'}</div>{state.discordChannelUrl && <a href={state.discordChannelUrl} target="_blank" rel="noreferrer">Open project group in Discord</a>}<h2 id="decision-title">{labels.text(state.issue?.title ?? 'Project update')}</h2><p>Decision owner: {company.people.find(p => p.id === state.projectOwnerId)?.name}</p><p>{labels.text(state.issue?.detail ?? '')}</p>{state.injection?.fact && <p className="test-fact-label">Group event · {company.people.find(p => p.id === state.injection?.fact?.employeeId)?.name} reported sick leave.</p>}<div className="decision-messages" aria-live="polite">{state.messages.map(m => <article key={m.id}><strong>{m.author === 'agent' ? 'CoFloor' : company.people.find(p => p.id === m.actorId)?.name}<small>{m.delivery === 'sent' ? 'Sent to Discord' : m.delivery === 'received' ? 'Received from Discord' : m.delivery === 'sending' ? 'Delivery pending verification' : m.delivery === 'received_event' ? 'Received via event adapter' : m.delivery === 'test_input' ? 'Local test reply' : 'Pending Discord delivery'}</small></strong><p>{labels.text(m.text)}</p></article>)}</div>{state.proposal && <section aria-label="Reassignment list"><h3>{state.proposal.status === 'applied' ? 'Confirmed reassignment' : 'Proposed reassignment · awaiting confirm'}</h3>{state.proposal.updates.map(u => <article key={u.taskId}><strong>{labels.task(u.taskId)}</strong><p>{labels.person(u.ownerId)} · {new Date(u.start).toLocaleTimeString('en-US', {timeZone: project.timezone, hour: 'numeric', minute: '2-digit'})}–{new Date(u.end).toLocaleTimeString('en-US', {timeZone: project.timezone, hour: 'numeric', minute: '2-digit'})} PT</p></article>)}{state.proposal.status === 'unavailable' && <p>No feasible reassignment yet.</p>}</section>}{state.nextCheckIn && <p>Next check-in: {labels.text(state.nextCheckIn)}</p>}{state.error && <p role="alert">{labels.text(state.error)}</p>}{state.discordError && <p role="alert">{state.discordError}</p>}{state.transport === 'discord' && state.issue?.status === 'awaiting' && <p>Reply confirm directly to the current proposal in Discord, or request changes.</p>}{state.transport !== 'discord' && state.issue?.status === 'awaiting' && <form onSubmit={e => { e.preventDefault(); if (replyText.trim()) void operation('decision', { actorId: state.projectOwnerId, channelId: state.channelId, proposalVersion: state.proposal?.version, text: replyText.trim(), decisionId: crypto.randomUUID() }); }}><label htmlFor="manager-reply">Project manager reply · local test</label><textarea id="manager-reply" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply confirm to apply the list, or request changes…" rows={4} disabled={state.operation !== 'idle'}/><button className="primary-button" type="submit" disabled={!replyText.trim() || state.operation !== 'idle'}>{state.operation === 'deciding' ? 'Interpreting decision…' : 'Submit test reply'}</button></form>}</Drawer>}
    {teamOpen && <Drawer titleId="team-title-drawer" onClose={() => setTeamOpen(false)}><h2 id="team-title-drawer">Team</h2><dl className="task-facts"><div><dt>Employees</dt><dd>{company.people.length.toLocaleString()}</dd></div><div><dt>Departments</dt><dd>{company.departments.length}</dd></div><div><dt>Assigned</dt><dd>{owners.length}</dd></div></dl>{[...new Set([state.projectOwnerId, ...owners])].filter((id): id is string => Boolean(id)).map(id => { const person = company.people.find(p => p.id === id); return <div key={id} className="detail-person"><Avatar id={id}/><div><strong>{person?.name ?? 'Team member'}</strong><span>{person?.role}</span></div></div>; })}</Drawer>}
    {selected && <Drawer titleId="task-detail-title" onClose={() => setSelectedId(null)}><div className="section-eyebrow">TASK DETAILS</div><h2 id="task-detail-title">{labels.text(selected.title)}</h2><span className="detail-status">{columns.find(c => c.status === selected.status)?.label}</span><div className="detail-person"><Avatar id={selected.ownerId}/><div><strong>{company.people.find(p => p.id === selected.ownerId)?.name}</strong><span>{company.people.find(p => p.id === selected.ownerId)?.role}</span></div></div><dl className="task-facts"><div><dt>Deadline</dt><dd>{businessDate} · {selected.due} PT</dd></div><div><dt>Assigned to</dt><dd>{labels.person(selected.ownerId)}</dd></div></dl><h3>Requirements</h3><p>{labels.text(selected.requirements)}</p><h3>Inputs</h3><ul>{selected.inputs?.map(input => <li key={input}>{labels.text(input)}</li>)}</ul><h3>Deliverables</h3><ul>{selected.outputs.map(output => <li key={output}>{labels.text(output)}</li>)}</ul><h3>Dependencies</h3>{selected.dependencies.length ? <ul>{selected.dependencies.map(id => <li key={id}>{labels.task(id)} — {state.tasks.find(t => t.id === id)?.status === 'done' ? 'Complete' : 'Waiting'}</li>)}</ul> : <p>No dependencies. Ready to start.</p>}{selected.blockedReason && <p className="blocked-tag">Blocked · {labels.text(selected.blockedReason)}</p>}<button className="secondary-button drawer-document" onClick={() => { setSelectedId(null); setDocumentOpen(true); }}>View project requirements<Icon name="file" size={16}/></button></Drawer>}
    {documentOpen && <Drawer titleId="document-title" onClose={() => setDocumentOpen(false)}><div className="section-eyebrow">ORIGINAL DOCUMENT</div><h2 id="document-title">Project requirements</h2><p className="document-filename">{project.file}</p><a className="secondary-button download-link" download={project.file} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(project.document.content)}`}>Download Markdown<Icon name="file" size={16}/></a><pre className="document-content">{labels.text(project.document.content)}</pre></Drawer>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
