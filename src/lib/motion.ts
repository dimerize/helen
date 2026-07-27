/*
  Preference and capability gates, in one place so every module agrees.
*/

const mq = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;

/** The visitor has asked for less movement. Always honour this first. */
export const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)');

/** The visitor is on a metered or explicitly data-saving connection. */
export function prefersLessData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

/**
 * A rough floor for running a shader comfortably. Both properties are
 * absent on Safari, in which case we give the device the benefit of the
 * doubt and rely on the frame-time sampling in the field module instead.
 */
export function underpowered(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return true;
  return false;
}

/** Run after first paint, and after the browser is done with anything urgent. */
export function whenIdle(fn: () => void): void {
  const go = () => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => number })
      .requestIdleCallback;
    if (ric) ric(fn, { timeout: 1200 });
    else setTimeout(fn, 200);
  };

  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}
