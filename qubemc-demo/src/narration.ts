import type { BoardState } from './board-state';

export type NarrationEvent = {
  id: string; sequence: number;
  kind: 'starting' | 'allocated' | 'leave' | 'proposal' | 'sent' | 'confirmed' | 'resumed' | 'unavailable' | 'replanning' | 'delivery_error';
  text: string; proposalVersion?: number; retrospectiveText?: string;
};
export type VoiceView = { text: string; status: 'idle' | 'generating' | 'playing' | 'muted' | 'blocked' | 'error'; muted: boolean; retryAvailable?: boolean };
export interface VoiceDriver {
  unlock(): Promise<void>;
  synthesize(text: string, signal: AbortSignal): Promise<ArrayBuffer>;
  play(audio: ArrayBuffer, signal: AbortSignal): Promise<void>;
}

// Re-check at playback time, not only when the polling snapshot arrives.
export function currentNarration(event: NarrationEvent, state?: BoardState): NarrationEvent | undefined {
  if (!state || event.proposalVersion === undefined) {
    if (event.kind === 'delivery_error' && state && !state.discordError) return;
    if (event.kind === 'leave' && state?.proposal) {
      const status = state.proposal.status;
      const ending = status === 'applied' ? 'Other work continued while I prepared a reassignment proposal.'
        : status === 'pending' ? 'Other work can continue while we await reassignment confirmation.'
        : status === 'unavailable' ? 'The affected work still needs a feasible replacement.'
        : 'Other work can continue while I revise the reassignment plan.';
      return { ...event, text: (status === 'applied' ? event.text.replace('blocking ', 'which blocked ') : event.text).replace('Other work can continue while I prepare a reassignment proposal.', ending) };
    }
    return event;
  }
  if (event.proposalVersion !== state.proposal?.version) return;
  const status = state.proposal.status;
  if (event.kind === 'proposal') {
    if (status === 'applied') return { ...event, text: event.retrospectiveText ?? 'The reassignment plan has been selected.' };
    return status === 'pending' ? event : undefined;
  }
  if (event.kind === 'sent') return status === 'pending' ? event : undefined;
  if (event.kind === 'unavailable') return status === 'unavailable' ? event : undefined;
  if (event.kind === 'replanning') return status === 'invalid' ? event : undefined;
  if (event.kind === 'delivery_error') return state.discordError ? event : undefined;
  if (event.kind === 'confirmed' || event.kind === 'resumed') return status === 'applied' ? event : undefined;
  return event;
}

export class NarrationQueue {
  private runId = '';
  private seen = new Set<string>();
  private queue: NarrationEvent[] = [];
  private state?: BoardState;
  private revision = 0;
  private generation = 0;
  private active?: { event: NarrationEvent; rendered: string; abort: AbortController };
  private failed?: NarrationEvent;
  private view: VoiceView;
  constructor(private driver: VoiceDriver, private publish: (view: VoiceView) => void, muted = false) {
    this.view = { text: '', status: muted ? 'muted' : 'idle', muted };
  }
  private update(change: Partial<VoiceView>) { this.view = { ...this.view, ...change }; this.publish(this.view); }
  private cancel() { this.active?.abort.abort(); this.active = undefined; }
  private switchRun(runId: string) {
    this.cancel(); this.runId = runId; this.seen.clear(); this.queue = []; this.failed = undefined; this.state = undefined; this.revision = 0; this.generation++;
    this.update({ text: '', retryAvailable: false, status: this.view.muted ? 'muted' : 'idle' });
  }
  start(runId: string) {
    this.switchRun(runId);
    const event: NarrationEvent = { id: `${runId}:starting`, sequence: 0, kind: 'starting', text: 'Starting the Red Bull Citrus Edition project. I’m assigning the team.' };
    this.enqueue(event);
    if (!this.view.muted) void this.enable();
  }
  reset() { this.switchRun(''); }
  observe(state: BoardState) {
    const baseline = this.runId !== state.runId;
    if (baseline) this.switchRun(state.runId);
    const revision = Math.max(0, ...(state.narrationEvents ?? []).map(e => e.sequence));
    if (!baseline && revision < this.revision) return;
    this.revision = revision;
    this.state = state;
    const events = [...(state.narrationEvents ?? [])].sort((a, b) => a.sequence - b.sequence);
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (!baseline) this.enqueue(event);
    }
    if (baseline && events.length) this.update({ text: events.at(-1)!.text });
    if (this.active) {
      const fresh = currentNarration(this.active.event, state);
      if (!fresh || fresh.text !== this.active.rendered) {
        const event = this.active.event;
        this.cancel();
        this.update({status:this.view.muted?'muted':'idle', text:fresh?.text ?? 'The previous voice update is no longer current.'});
        if (fresh) this.queue.unshift(event);
      }
    }
    this.queue = this.queue.filter(e => currentNarration(e, state));
    if (this.failed && (!currentNarration(this.failed, state) || (this.failed.kind === 'starting' && state.phase === 'active'))) { this.failed = undefined; this.update({retryAvailable:false}); }
    void this.pump();
  }
  private enqueue(event: NarrationEvent) {
    this.seen.add(event.id);
    const current = currentNarration(event, this.state);
    if (!current) return;
    if (this.view.muted) { this.update({ text: current.text }); return; }
    this.queue.push(event);
  }
  mute(muted: boolean) {
    this.cancel(); this.queue = []; this.failed = undefined;
    this.generation++;
    this.update({ muted, retryAvailable: false, status: muted ? 'muted' : 'idle' });
    if (!muted) void this.enable();
  }
  async enable() {
    // Called directly from a user gesture, before the synthesis request.
    const generation = this.generation;
    try {
      await this.driver.unlock();
      if (generation !== this.generation) return;
      this.update({ status: this.view.muted ? 'muted' : 'idle' });
      void this.pump();
    } catch { if (generation === this.generation) this.update({ status: 'blocked' }); }
  }
  retry() {
    if (this.failed && currentNarration(this.failed, this.state)) this.queue.unshift(this.failed);
    this.failed = undefined;
    this.update({retryAvailable:false});
    void this.enable();
  }
  stop() { this.generation++; this.cancel(); this.queue = []; }
  private async pump() {
    if (this.active || this.view.muted || this.view.status === 'blocked') return;
    let event: NarrationEvent | undefined, rendered: NarrationEvent | undefined;
    while ((event = this.queue.shift())) { rendered = currentNarration(event, this.state); if (rendered) break; }
    if (!event || !rendered) return;
    const work = { event, rendered: rendered.text, abort: new AbortController() };
    this.active = work;
    this.update({ text: rendered.text, status: 'generating' });
    try {
      const audio = await this.driver.synthesize(rendered.text, work.abort.signal);
      if (work.abort.signal.aborted || this.active !== work) return;
      this.update({ status: 'playing' });
      await this.driver.play(audio, work.abort.signal);
      if (work.abort.signal.aborted || this.active !== work) return;
      this.update({ status: 'idle' });
    } catch (error) {
      if (work.abort.signal.aborted || this.active !== work) return;
      if (error instanceof Error && error.name === 'NotAllowedError') {
        this.queue.unshift(event); this.update({ status: 'blocked' });
      } else { this.failed = event; this.update({ status: 'error', retryAvailable: true }); }
    } finally {
      if (this.active === work) { this.active = undefined; void this.pump(); }
    }
  }
}

export function browserVoiceDriver(): VoiceDriver {
  let context: AudioContext | undefined;
  return {
    async unlock() {
      context ??= new AudioContext();
      await context.resume();
      if (context.state !== 'running') throw new DOMException('Enable audio to continue.', 'NotAllowedError');
    },
    async synthesize(text, signal) {
      const response = await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.any([signal, AbortSignal.timeout(185000)]) });
      if (!response.ok) throw new Error('Local speech unavailable.');
      return response.arrayBuffer();
    },
    async play(audio, signal) {
      if (!context || context.state !== 'running') throw new DOMException('Enable audio to continue.', 'NotAllowedError');
      const buffer = await context.decodeAudioData(audio);
      signal.throwIfAborted();
      const source = context.createBufferSource();
      source.buffer = buffer; source.connect(context.destination);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { signal.removeEventListener('abort', abort); source.disconnect(); };
        const abort = () => { source.stop(); cleanup(); reject(signal.reason); };
        source.onended = () => { cleanup(); resolve(); };
        signal.addEventListener('abort', abort, { once: true });
        source.start();
      });
    },
  };
}
