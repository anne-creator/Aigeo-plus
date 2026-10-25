const THRESHOLD = 60;
const IDLE_MS = 250;
const LINE_HEIGHT = 16;

type WheelInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

/** One absolute show/hide command per wheel burst, independent of current UI state. */
export class DashboardWheelGesture {
  private distance = 0;
  private consumed = false;

  reset() {
    this.distance = 0;
    this.consumed = false;
  }

  read(event: WheelInput, pageHeight: number, background = true): { capture: boolean; open: boolean | null } {
    const { deltaX, deltaY, deltaMode, ctrlKey, metaKey, shiftKey, altKey } = event;
    if (!background || ctrlKey || metaKey || shiftKey || altKey || !Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.abs(deltaX) >= Math.abs(deltaY)) {
      // A burst beginning in a panel, horizontally or with pinch must finish there.
      this.consumed = true;
      return { capture: false, open: null };
    }
    if (this.consumed) return { capture: true, open: null };
    const pixels = deltaY * (deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? pageHeight : 1);
    if (Math.sign(pixels) !== Math.sign(this.distance)) this.distance = 0;
    this.distance += pixels;
    if (Math.abs(this.distance) < THRESHOLD) return { capture: true, open: null };
    this.consumed = true;
    return { capture: true, open: this.distance > 0 };
  }
}

// The main element includes transparent top padding: that visible scene is background too.
const EXCLUDED = '#dashboard-panel > *, header, nav, dialog, .settings-panel, button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-dashboard-gesture="ignore"]';

/** Attach only to the app shell so other page surfaces keep native scrolling. */
export function bindDashboardWheel(root: HTMLElement, onOpen: (open: boolean) => void) {
  const doc = root.ownerDocument;
  const gesture = new DashboardWheelGesture();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const onWheel = (event: WheelEvent) => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => gesture.reset(), IDLE_MS);
    const target = event.target as Element | null;
    const background = !event.defaultPrevented && Boolean(target?.closest) && root.contains(target)
      && !target?.closest(EXCLUDED) && !doc.querySelector('dialog[open]');
    const result = gesture.read(event, doc.defaultView?.innerHeight ?? root.clientHeight, background);
    if (result.capture) event.preventDefault();
    if (result.open !== null) onOpen(result.open);
  };
  root.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    root.removeEventListener('wheel', onWheel);
    clearTimeout(idleTimer);
  };
}
