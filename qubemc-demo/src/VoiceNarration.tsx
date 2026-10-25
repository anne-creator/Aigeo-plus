import { useEffect, useId, useRef, useState } from 'react';
import type { VoiceView } from './narration';
import './voice.css';

export function VoiceNarration({ view, onMute, onEnable, onRetry }: {
  view: VoiceView; onMute: () => void; onEnable: () => void; onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <section ref={root} className="voice-narration" aria-label="Project voice updates" data-dashboard-gesture="ignore">
    <button ref={trigger} type="button" className="voice-launcher" onClick={() => setOpen(!open)} aria-label={open ? 'Hide voice controls' : 'Show voice controls'} aria-expanded={open} aria-controls={panelId} title="Voice updates" data-status={view.muted ? 'muted' : view.status}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z"/>
        {view.muted ? <path d="m16 9 6 6m0-6-6 6"/> : <><path d="M15 8a6 6 0 0 1 0 8"/><path d="M18 5a10 10 0 0 1 0 14"/></>}
      </svg>
    </button>
    <div id={panelId} className="voice-panel" hidden={!open}>
    <button type="button" className="voice-toggle" onClick={onMute} aria-pressed={!view.muted} aria-label={view.muted ? 'Unmute project voice updates' : 'Mute project voice updates'}>{view.muted ? 'Voice off' : 'Voice on'}</button>
    <div className="voice-copy" role="status" aria-live="polite">
      <small>{view.muted ? 'Muted · text updates active' : view.status === 'generating' ? 'Preparing voice update…' : view.status === 'playing' ? 'Speaking' : view.status === 'error' ? 'Local speech unavailable · project work continues' : view.status === 'blocked' ? 'Enable audio to hear project updates' : 'Project updates'}</small>
      <p>{view.text || 'Voice updates will begin when you start a project.'}</p>
    </div>
    {view.status === 'blocked' && <button type="button" onClick={onEnable}>Enable audio</button>}
    {view.retryAvailable && <button type="button" onClick={onRetry}>Retry voice</button>}
    </div>
  </section>;
}
