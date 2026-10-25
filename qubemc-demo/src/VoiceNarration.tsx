import type { VoiceView } from './narration';
import './voice.css';

export function VoiceNarration({ view, onMute, onEnable, onRetry }: {
  view: VoiceView; onMute: () => void; onEnable: () => void; onRetry: () => void;
}) {
  return <section className="voice-narration" aria-label="Project voice updates" data-dashboard-gesture="ignore">
    <button type="button" className="voice-toggle" onClick={onMute} aria-pressed={!view.muted} aria-label={view.muted ? 'Unmute project voice updates' : 'Mute project voice updates'}>{view.muted ? 'Voice off' : 'Voice on'}</button>
    <div className="voice-copy" role="status" aria-live="polite">
      <small>{view.muted ? 'Muted · text updates active' : view.status === 'generating' ? 'Preparing voice update…' : view.status === 'playing' ? 'Speaking' : view.status === 'error' ? 'Local speech unavailable · project work continues' : view.status === 'blocked' ? 'Enable audio to hear project updates' : 'Project updates'}</small>
      <p>{view.text || 'Voice updates will begin when you start a project.'}</p>
    </div>
    {view.status === 'blocked' && <button type="button" onClick={onEnable}>Enable audio</button>}
    {view.retryAvailable && <button type="button" onClick={onRetry}>Retry voice</button>}
  </section>;
}
