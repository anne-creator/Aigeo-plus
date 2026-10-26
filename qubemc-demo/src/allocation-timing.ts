export const MIN_ALLOCATION_ANIMATION_MS = 5000;

/** Hold only the presentation; model work starts immediately and errors are not delayed. */
export async function waitForAllocationAnimation(startedAt: number, signal: AbortSignal, now = () => performance.now()): Promise<void> {
  signal.throwIfAborted();
  const remaining = MIN_ALLOCATION_ANIMATION_MS - (now() - startedAt);
  if (remaining <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, remaining);
    signal.addEventListener('abort', abort, { once: true });
  });
}
