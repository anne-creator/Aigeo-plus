import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NarrationQueue, currentNarration, type NarrationEvent, type VoiceView, type VoiceDriver } from './narration';
import { initialBoard, type BoardState } from './board-state';

const tick = () => new Promise(resolve => setImmediate(resolve));
const event = (kind: NarrationEvent['kind'], sequence: number, extra = {}): NarrationEvent => ({ id: `run:${kind}:${sequence}`, kind, sequence, text: kind, ...extra });
const snapshot = (events: NarrationEvent[], extra = {}): BoardState => ({ ...initialBoard, runId: 'run', phase: 'active', narrationEvents: events, ...extra });
function fixture(overrides: Partial<VoiceDriver> = {}) {
  const spoken: string[] = [], synthesized: string[] = [], views: VoiceView[] = [];
  const driver: VoiceDriver = {
    async unlock() {},
    async synthesize(text) { synthesized.push(text); return new TextEncoder().encode(text).buffer; },
    async play(bytes) { spoken.push(new TextDecoder().decode(bytes)); },
    ...overrides,
  };
  const queue = new NarrationQueue(driver, v => views.push(v));
  return { queue, spoken, synthesized, views };
}

test('start and skipped polling milestones play once, in sequence', async () => {
  const f = fixture(); f.queue.start('run'); await tick();
  const events = [event('allocated', 1), event('leave', 2), event('proposal', 3, {proposalVersion:1})];
  const state = snapshot(events, {proposal:{version:1,status:'pending',updates:[]}});
  f.queue.observe(state); f.queue.observe(state); await tick();
  assert.deepEqual(f.spoken, ['Starting the Red Bull Citrus Edition project. I’m assigning the team.', 'allocated', 'leave', 'proposal']);
  f.queue.observe(snapshot(events.slice(0,1))); await tick();
  assert.equal(f.spoken.length, 4);
});

test('refresh/shared link establishes a silent baseline and only speaks new events', async () => {
  const f = fixture(); const old = [event('allocated',1),event('leave',2)];
  f.queue.observe(snapshot(old)); await tick(); assert.equal(f.spoken.length,0);
  f.queue.observe(snapshot([...old,event('unavailable',3,{proposalVersion:1})], {proposal:{version:1,status:'unavailable',updates:[]}}));
  await tick(); assert.deepEqual(f.spoken,['unavailable']);
});

test('mute aborts active audio, drops backlog and keeps future text updates', async () => {
  let signal: AbortSignal | undefined;
  const f = fixture({async play(_audio, s) {signal=s; await new Promise<void>((resolve)=>s.addEventListener('abort',()=>resolve(),{once:true}));}});
  f.queue.start('run'); await tick();
  f.queue.observe(snapshot([event('allocated',1)])); f.queue.mute(true);
  assert.equal(signal?.aborted,true);
  f.queue.observe(snapshot([event('allocated',1),event('leave',2)]));
  assert.equal(f.views.at(-1)?.text,'leave');
  f.queue.mute(false); await tick(); assert.equal(f.synthesized.length,1);
  f.queue.stop();
});

test('reset cancels synthesis and ignores a late old response', async () => {
  let release!: (audio: ArrayBuffer) => void; let oldSignal: AbortSignal | undefined;
  const f = fixture({synthesize(text,signal) {
    if (!oldSignal) {oldSignal=signal;return new Promise(resolve=>release=resolve);}
    return Promise.resolve(new TextEncoder().encode(text).buffer);
  }});
  f.queue.start('run'); await tick(); f.queue.start('new'); await tick();
  assert.equal(oldSignal?.aborted,true); release(new TextEncoder().encode('old').buffer); await tick();
  assert.equal(f.spoken.includes('old'),false); assert.equal(f.spoken.length,1);
});

test('confirmation during synthesis replaces waiting prose with a retrospective plan', async () => {
  let release!: (audio: ArrayBuffer) => void;
  const f = fixture({async synthesize(text) {
    if (text==='Waiting for confirmation') return new Promise(resolve=>release=resolve);
    return new TextEncoder().encode(text).buffer;
  }});
  f.queue.start('run'); await tick();
  const proposal = event('proposal',1,{proposalVersion:1,text:'Waiting for confirmation',retrospectiveText:'The plan selected Taylor.'});
  f.queue.observe(snapshot([proposal],{proposal:{version:1,status:'pending',updates:[]}})); await tick();
  f.queue.observe(snapshot([proposal,event('confirmed',2,{proposalVersion:1}),event('resumed',3,{proposalVersion:1})],{proposal:{version:1,status:'applied',updates:[]}}));
  await tick(); release(new TextEncoder().encode('Waiting for confirmation').buffer); await tick();
  assert.deepEqual(f.spoken.slice(1),['The plan selected Taylor.','confirmed','resumed']);
});

test('obsolete proposals, delivery notices and failed application cannot announce recovery', () => {
  const pending = snapshot([],{proposal:{version:2,status:'pending',updates:[]}});
  assert.equal(currentNarration(event('proposal',1,{proposalVersion:1}),pending),undefined);
  assert.equal(currentNarration(event('confirmed',2,{proposalVersion:2}),pending),undefined);
  assert.equal(currentNarration(event('resumed',3,{proposalVersion:2}),pending),undefined);
  assert.equal(currentNarration(event('sent',4,{proposalVersion:2}),{...pending,proposal:{version:2,status:'applied',updates:[]}}),undefined);
});

test('browser restriction exposes Enable audio and preserves the pending announcement', async () => {
  let blocked=true;
  const f=fixture({async unlock(){if(blocked)throw new DOMException('Blocked','NotAllowedError');}});
  f.queue.start('run'); await tick(); assert.equal(f.views.at(-1)?.status,'blocked'); assert.equal(f.spoken.length,0);
  blocked=false; await f.queue.enable(); await tick(); assert.equal(f.spoken.length,1);
});

test('speech failure remains retryable while later business events continue', async () => {
  let fail=false;
  const f=fixture({async synthesize(text){if(fail)throw Error('timeout');return new TextEncoder().encode(text).buffer;}});
  f.queue.start('run'); await tick();
  fail=true; f.queue.observe(snapshot([event('allocated',1)])); await tick(); assert.equal(f.views.at(-1)?.retryAvailable,true);
  fail=false; f.queue.observe(snapshot([event('allocated',1),event('leave',2)])); await tick(); assert.equal(f.spoken.at(-1),'leave');
  f.queue.retry(); await tick(); assert.equal(f.spoken.at(-1),'allocated'); assert.equal(f.views.at(-1)?.retryAvailable,false);
});
