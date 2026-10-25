import type { BoardState } from '../board-state';

// Ported from cofloor-deploy: openTowerFloor(89), cf-dive.
export const arrivalDuration = .76;
export function shouldEnterFloor(previous: BoardState | null, current: BoardState) {
  return previous?.phase === 'planning' && previous.runId === current.runId &&
    current.phase === 'active' && current.tasks.length > 0;
}

function diveEase(progress: number) {
  // CSS cubic-bezier(.7,0,.2,1), inverted to get animation progress.
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) {
    const t = (low + high) / 2;
    const x = 3 * (1-t) ** 2 * t * .7 + 3 * (1-t) * t ** 2 * .2 + t ** 3;
    if (x < progress) low = t; else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1-t) * t ** 2 + t ** 3;
}

export function towerArrival(w: number, h: number, elapsed: number) {
  const progress = Math.max(0, Math.min(1, elapsed / .78)), eased = diveEase(progress);
  const fit = Math.min(w / 1200, h / 1080);
  return {
    scale: 1 + 2.5 * eased,
    // F90: project the source's 48% / floor-height origin into the fitted canvas.
    x: (w - 1200 * fit) / 2 + 1200 * fit * .48,
    y: (w < 600 ? 82 : (h - 1080 * fit) / 2) + (176 + 3 * 7.25) * fit,
    brightness: progress < .65 ? 1 + .3 * diveEase(progress / .65) : 1.3 - .8 * diveEase((progress - .65) / .35),
  };
}
