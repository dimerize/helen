import test from 'node:test';
import assert from 'node:assert/strict';
import { scanCycle, elapsedForScan, SCAN_DURATION } from '../public/studio/scan-world/scan-cycle.js';
test('production rotation reaches every source image and wraps', () => {
  assert.deepEqual([0,1,2,3,4,5].map(n => scanCycle(n * SCAN_DURATION + 3.6).index), [0,1,2,0,1,2]);
});
test('manual image selection resumes within the chosen original pass', () => {
  for (let i = 0; i < 3; i++) {
    const cycle = scanCycle(elapsedForScan(i));
    assert.equal(cycle.index, i);
    assert.ok(Math.abs(cycle.progress - scanCycle(3.6).progress) < 1e-10);
  }
});
test('scan wand stays within original travel range, including return boundary', () => {
  for (let t = 0; t < 90; t += .013) {
    const {progress} = scanCycle(t);
    assert.ok(progress >= 0 && progress <= 1);
  }
  assert.ok(Math.abs(scanCycle(SCAN_DURATION * .83).progress) < 1e-8);
  assert.equal(scanCycle(SCAN_DURATION).progress, 1);
});
