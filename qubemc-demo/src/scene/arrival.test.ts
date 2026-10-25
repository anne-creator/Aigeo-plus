import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard } from '../board-state.ts';
import { arrivalDuration, shouldEnterFloor, towerArrival } from './arrival.ts';
import { createSceneEngine } from './engine.ts';
import type { Scene } from './model.ts';

test('only successful allocation in the observed planning run triggers arrival', () => {
  const planning = {...initialBoard, runId: 'one', phase: 'planning' as const};
  const active = {...planning, phase: 'active' as const, tasks: [{}] as typeof initialBoard.tasks};
  assert.equal(shouldEnterFloor(planning, active), true);
  for (const previous of [null, initialBoard, active]) assert.equal(shouldEnterFloor(previous, active), false);
  assert.equal(shouldEnterFloor(planning, {...active, tasks: []}), false);
  assert.equal(shouldEnterFloor(planning, {...active, runId: 'two'}), false);
  assert.equal(shouldEnterFloor(planning, {...planning, error: 'Setup failed'}), false);
});

test('source zoom retains the F90 origin on desktop and mobile', () => {
  const start = towerArrival(1280, 720, 0), end = towerArrival(1280, 720, .78);
  assert.ok(Math.abs(start.scale - 1) < .00001);
  assert.ok(Math.abs(end.scale - 3.5) < .00001);
  assert.equal(start.x, 624);
  assert.ok(Math.abs(start.y - 131.833333) < .00001);
  const mobile = towerArrival(390, 844, arrivalDuration / 2);
  assert.equal(mobile.x, 187.2);
  assert.ok(Math.abs(mobile.y - 146.26875) < .00001);
  assert.ok(mobile.scale > start.scale && mobile.scale < end.scale);
  assert.ok(Math.abs(end.brightness - .5) < .00001);
});

test('engine finishes once, preserves arrival during updates, and cancels on reset/pause/reduced motion', () => {
  const keys = ['document', 'window', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0, now = 100;
  const context = new Proxy({}, {get: (_target, key) => String(key).startsWith('create') ? () => ({addColorStop() {}}) : () => {}});
  const canvas = () => ({clientWidth: 1280, clientHeight: 720, width: 0, height: 0, getContext: () => context, addEventListener() {}, removeEventListener() {}}) as unknown as HTMLCanvasElement;
  const globals = {
    document: {hidden: false, createElement: canvas, addEventListener() {}, removeEventListener() {}},
    window: {devicePixelRatio: 1}, ResizeObserver: class {observe() {} disconnect() {}},
    requestAnimationFrame: (fn: FrameRequestCallback) => {frames.set(++nextFrame, fn); return nextFrame;},
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  keys.forEach(key => Object.defineProperty(globalThis, key, {value: globals[key], configurable: true, writable: true}));
  const changes: boolean[] = [];
  const engine = createSceneEngine(canvas(), 0, () => assert.fail('unexpected art failure'), () => assert.fail('unexpected canvas failure'), value => changes.push(value));
  const building: Scene = {mode: 'building', runId: 'one', members: [], moves: [], fallback: false};
  const floor: Scene = {...building, mode: 'floor'};
  const tick = () => {const callbacks = [...frames.values()]; frames.clear(); now += 80; callbacks.forEach(fn => fn(now));};
  try {
    engine.apply(building); engine.apply(floor, true); tick(); tick();
    engine.apply({...floor, fallback: true});
    assert.deepEqual(changes, [true]);
    for (let i = 0; i < 15; i++) tick();
    assert.deepEqual(changes, [true, false]);
    engine.apply(floor); tick(); assert.equal(changes.length, 2);
    engine.apply(building); engine.apply(floor, true); engine.apply({...building, runId: 'two'});
    for (let i = 0; i < 15; i++) tick();
    assert.deepEqual(changes.slice(-2), [true, false]);
    engine.apply(floor, true); engine.setPlayback(false, false);
    assert.deepEqual(changes.slice(-2), [true, false]);
    const count = changes.length; engine.apply(floor, true); assert.equal(changes.length, count);
    engine.setPlayback(true, true); engine.apply(floor, true); assert.equal(changes.length, count);
    engine.setPlayback(true, false); engine.apply(floor, true); engine.setPlayback(true, true);
    assert.deepEqual(changes.slice(-2), [true, false]);
  } finally {
    engine.destroy(); assert.equal(frames.size, 0);
    keys.forEach((key, i) => {if (originals[i]) Object.defineProperty(globalThis, key, originals[i]!); else Reflect.deleteProperty(globalThis, key);});
  }
});
