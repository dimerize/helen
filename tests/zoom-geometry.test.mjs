import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM, fitSize, clampView, zoomAt, pinchView, panBy, wheelFactor, stepIndex, swipeStep, isDoubleTap, keyIntent } from '../public/studio/zoom-geometry.js';

const square = { width: 800, height: 800 };

test('the viewer zooms to at least 3×', () => {
  assert.equal(ZOOM.min, 1);
  assert.ok(ZOOM.max >= 3);
});

test('fitSize contains the whole image in the stage', () => {
  assert.deepEqual(fitSize({ width: 1000, height: 800 }, { width: 1604, height: 2048 }), { width: 626.5625, height: 800 });
  assert.deepEqual(fitSize({ width: 390, height: 600 }, { width: 2000, height: 1000 }), { width: 390, height: 195 });
});

test('clampView keeps the scale between fit and the maximum', () => {
  assert.equal(clampView({ scale: .5, x: 0, y: 0 }, square, square).scale, 1);
  assert.equal(clampView({ scale: 9, x: 0, y: 0 }, square, square).scale, ZOOM.max);
});

test('at fit the image stays centred', () => {
  assert.deepEqual(clampView({ scale: 1, x: 50, y: -30 }, { width: 626.5625, height: 800 }, { width: 1000, height: 800 }), { scale: 1, x: 0, y: 0 });
});

test('a zoomed image pans only as far as its own edges', () => {
  assert.deepEqual(clampView({ scale: 2, x: 500, y: -900 }, { width: 626.5625, height: 800 }, { width: 1000, height: 800 }), { scale: 2, x: 126.5625, y: -400 });
});

test('zoomAt keeps the point under the pointer still', () => {
  const view = zoomAt({ scale: 1, x: 0, y: 0 }, 2, { x: 200, y: 100 }, square, square);
  assert.deepEqual(view, { scale: 2, x: -200, y: -100 });
  assert.deepEqual(zoomAt(view, 1, { x: 200, y: 100 }, square, square), { scale: 1, x: 0, y: 0 });
});

test('pinchView scales with the fingers and follows their midpoint', () => {
  const start = { view: { scale: 1, x: 0, y: 0 }, mid: { x: 0, y: 0 }, distance: 100 };
  assert.deepEqual(pinchView(start, { mid: { x: 30, y: 0 }, distance: 200 }, square, square), { scale: 2, x: 30, y: 0 });
});

test('panBy moves a zoomed image and stops at its edge', () => {
  assert.deepEqual(panBy({ scale: 2, x: 0, y: 0 }, -80, 0, square, square), { scale: 2, x: -80, y: 0 });
  assert.deepEqual(panBy({ scale: 2, x: -390, y: 0 }, -80, 0, square, square), { scale: 2, x: -400, y: 0 });
});

test('a rotated phone re-clamps a zoomed view', () => {
  const view = { scale: 3, x: 800, y: 0 }; // valid on an 800 × 800 stage
  const stage = { width: 400, height: 800 };
  assert.deepEqual(clampView(view, fitSize(stage, { width: 1000, height: 1000 }), stage), { scale: 3, x: 400, y: 0 });
});

test('wheelFactor: scrolling up zooms in, down zooms out, a trackpad pinch is stronger', () => {
  assert.ok(wheelFactor({ deltaY: -100 }) > 1);
  assert.ok(wheelFactor({ deltaY: 100 }) < 1);
  assert.ok(wheelFactor({ deltaY: -10, ctrlKey: true }) > wheelFactor({ deltaY: -10 }));
  assert.equal(wheelFactor({ deltaY: -3, deltaMode: 1 }), wheelFactor({ deltaY: -48 }));
});

test('stepIndex wraps around a section, like the archive viewer', () => {
  assert.equal(stepIndex(7, 1, 8), 0);
  assert.equal(stepIndex(0, -1, 8), 7);
  assert.equal(stepIndex(3, 1, 8), 4);
  assert.equal(stepIndex(0, 1, 1), 0);
});

test('swipeStep: a clear sideways swipe steps, a short or diagonal one does not', () => {
  assert.equal(swipeStep({ dx: -80, dy: 10 }), 1);
  assert.equal(swipeStep({ dx: 80, dy: 0 }), -1);
  assert.equal(swipeStep({ dx: -40, dy: 0 }), 0);
  assert.equal(swipeStep({ dx: -80, dy: 70 }), 0);
});

test('isDoubleTap needs two taps close in time and place', () => {
  assert.equal(isDoubleTap(null, { time: 0, x: 0, y: 0 }), false);
  assert.equal(isDoubleTap({ time: 0, x: 100, y: 100 }, { time: 250, x: 110, y: 105 }), true);
  assert.equal(isDoubleTap({ time: 0, x: 100, y: 100 }, { time: 400, x: 100, y: 100 }), false);
  assert.equal(isDoubleTap({ time: 0, x: 100, y: 100 }, { time: 200, x: 140, y: 100 }), false);
});

test('keyIntent: arrows step at fit and pan when zoomed', () => {
  assert.deepEqual(keyIntent('ArrowRight', false), { step: 1 });
  assert.deepEqual(keyIntent('ArrowLeft', false), { step: -1 });
  assert.equal(keyIntent('ArrowUp', false), null);
  assert.deepEqual(keyIntent('ArrowRight', true), { pan: [-ZOOM.panKey, 0] });
  assert.deepEqual(keyIntent('ArrowDown', true), { pan: [0, -ZOOM.panKey] });
  assert.deepEqual(keyIntent('+', false), { zoom: 'in' });
  assert.deepEqual(keyIntent('=', true), { zoom: 'in' });
  assert.deepEqual(keyIntent('-', true), { zoom: 'out' });
  assert.deepEqual(keyIntent('0', true), { zoom: 'reset' });
  assert.equal(keyIntent('a', false), null);
});
