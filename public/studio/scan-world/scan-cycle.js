// Production scan cadence: a 14.5-second pass, followed by a quick return.
export const SCAN_DURATION = 14.5;
export function scanCycle(elapsed, count = 3) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isInteger(count) || count < 1) throw new RangeError('Invalid scan cycle.');
  const index = Math.floor(elapsed / SCAN_DURATION) % count;
  const phase = (elapsed % SCAN_DURATION) / SCAN_DURATION;
  return { index, progress: phase < .83 ? 1 - phase / .83 : ((phase - .83) / .17) ** .6 };
}
export function elapsedForScan(index) {
  if (!Number.isInteger(index) || index < 0 || index > 2) throw new RangeError('Unknown scanner image.');
  return index * SCAN_DURATION + 3.6;
}
