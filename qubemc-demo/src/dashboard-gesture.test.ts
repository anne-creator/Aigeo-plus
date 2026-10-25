import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardWheelGesture, bindDashboardWheel } from './dashboard-gesture.ts';

const wheel = (deltaY: number, extra = {}) => ({ deltaX: 0, deltaY, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });

test('requires 60 pixels and emits absolute show/hide commands', () => {
  const gesture = new DashboardWheelGesture();
  assert.equal(gesture.read(wheel(29), 800).open, null);
  assert.equal(gesture.read(wheel(30), 800).open, null);
  assert.equal(gesture.read(wheel(1), 800).open, true);
  gesture.reset();
  assert.equal(gesture.read(wheel(60), 800).open, true); // Same direction never toggles.
  gesture.reset();
  assert.equal(gesture.read(wheel(-60), 800).open, false);
  gesture.reset();
  assert.equal(gesture.read(wheel(-60), 800).open, false);
});

test('normalizes line and page devices in both directions', () => {
  for (const direction of [-1, 1]) {
    const gesture = new DashboardWheelGesture();
    assert.equal(gesture.read(wheel(direction * 3, { deltaMode: 1 }), 800).open, null);
    assert.equal(gesture.read(wheel(direction, { deltaMode: 1 }), 800).open, direction > 0);
    gesture.reset();
    assert.equal(gesture.read(wheel(direction * 0.1, { deltaMode: 2 }), 600).open, direction > 0);
  }
});

test('small alternating jitter and reversals before the threshold do not accumulate', () => {
  const gesture = new DashboardWheelGesture();
  for (let i = 0; i < 30; i++) assert.equal(gesture.read(wheel(i % 2 ? -8 : 8), 800).open, null);
  gesture.reset();
  assert.equal(gesture.read(wheel(50), 800).open, null);
  assert.equal(gesture.read(wheel(-40), 800).open, null);
  assert.equal(gesture.read(wheel(-20), 800).open, false);
});

test('momentum and its direction changes cannot trigger twice in one burst', () => {
  const gesture = new DashboardWheelGesture();
  assert.equal(gesture.read(wheel(80), 800).open, true);
  for (const delta of [70, 40, -90, -60, -10]) assert.equal(gesture.read(wheel(delta), 800).open, null);
});

test('horizontal, zoom, modified and ineligible bursts keep native behavior and cannot leak into background', () => {
  for (const input of [wheel(20, { deltaX: 90 }), wheel(60, { deltaX: 60 }), wheel(90, { ctrlKey: true }), wheel(90, { metaKey: true }), wheel(90, { shiftKey: true }), wheel(90, { altKey: true }), wheel(NaN)]) {
    const gesture = new DashboardWheelGesture();
    assert.deepEqual(gesture.read(input, 800), { capture: false, open: null });
    assert.equal(gesture.read(wheel(90), 800).open, null);
    gesture.reset();
    assert.equal(gesture.read(wheel(90), 800).open, true);
  }
  const gesture = new DashboardWheelGesture();
  assert.deepEqual(gesture.read(wheel(100), 800, false), { capture: false, open: null });
  assert.equal(gesture.read(wheel(100), 800, true).open, null);
});

// Real EventTarget dispatch/cancellation and Node's controlled clock; DOM hit-testing is checked in the browser.
class Surface extends EventTarget {
  excluded = false;
  modal = false;
  clientHeight = 800;
  ownerDocument = { defaultView: { innerHeight: 800 }, querySelector: () => this.modal ? {} : null };
  closest() { return this.excluded ? this : null; }
  contains(target: unknown) { return target === this; }
  send(deltaY: number, extra = {}) {
    const event = Object.assign(new Event('wheel', { cancelable: true }), wheel(deltaY, extra));
    this.dispatchEvent(event);
    return event;
  }
}
const bind = (surface: Surface, callback: (open: boolean) => void) => bindDashboardWheel(surface as unknown as HTMLElement, callback);

test('rearms only after 250ms idle, including every momentum event', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const surface = new Surface(), commands: boolean[] = [];
  const dispose = bind(surface, open => commands.push(open));
  assert.equal(surface.send(60).defaultPrevented, true);
  context.mock.timers.tick(249);
  surface.send(-100);
  context.mock.timers.tick(249);
  surface.send(-100);
  assert.deepEqual(commands, [true]);
  context.mock.timers.tick(250);
  surface.send(-60);
  assert.deepEqual(commands, [true, false]);
  context.mock.timers.tick(250);
  surface.send(30);
  context.mock.timers.tick(250);
  surface.send(30);
  assert.deepEqual(commands, [true, false]); // Separate tiny bursts don't accumulate.
  dispose();
});

test('panel and modal scrolling is not canceled or used to open/close the dashboard', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const surface = new Surface(), commands: boolean[] = [];
  const dispose = bind(surface, open => commands.push(open));
  for (const mode of ['excluded', 'modal'] as const) {
    surface[mode] = true;
    assert.equal(surface.send(200).defaultPrevented, false);
    assert.equal(surface.send(-200).defaultPrevented, false);
    surface[mode] = false;
    surface.send(100); // Inertia cannot leak from the excluded surface.
    assert.deepEqual(commands, []);
    context.mock.timers.tick(250);
  }
  surface.send(60);
  assert.deepEqual(commands, [true]);
  dispose();
});

test('horizontal scrolling and pinch retain their browser default', () => {
  const surface = new Surface(), commands: boolean[] = [];
  const dispose = bind(surface, open => commands.push(open));
  assert.equal(surface.send(20, { deltaX: 120 }).defaultPrevented, false);
  assert.equal(surface.send(120, { ctrlKey: true }).defaultPrevented, false);
  assert.deepEqual(commands, []);
  dispose();
});

test('cleanup removes the listener and pending idle timer', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const surface = new Surface(), commands: boolean[] = [];
  const dispose = bind(surface, open => commands.push(open));
  surface.send(30);
  dispose();
  assert.equal(surface.send(100).defaultPrevented, false);
  context.mock.timers.tick(1000);
  assert.deepEqual(commands, []);
  // Remount gets a fresh recognizer, as React StrictMode requires.
  const disposeAgain = bind(surface, open => commands.push(open));
  surface.send(60);
  assert.deepEqual(commands, [true]);
  disposeAgain();
});
