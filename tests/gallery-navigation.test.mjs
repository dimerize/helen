import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPosition, movePosition, rotateView, nearestAngle } from '../public/studio/gallery-navigation.js';

test('a visitor cannot cross the room walls or leave eye level', () => {
  assert.deepEqual(clampPosition({x:9,y:80,z:-20}),{x:1.45,y:1.65,z:-3.8});
  assert.deepEqual(clampPosition({x:-8,z:20}),{x:-1.45,y:1.65,z:4.1});
});
test('forward movement follows the direction the visitor is facing', () => {
  const forward=movePosition({x:0,z:0},0,{forward:1,sideways:0},1);
  assert.ok(forward.z<0 && Math.abs(forward.x)<1e-8);
  const right=movePosition({x:0,z:0},Math.PI/2,{forward:1,sideways:0},.5);
  assert.ok(right.x>0 && Math.abs(right.z)<1e-8);
});
test('diagonal movement cannot travel faster than straight movement', () => {
  const a=movePosition({x:0,z:0},0,{forward:1,sideways:0},.1);
  const b=movePosition({x:0,z:0},0,{forward:1,sideways:1},.1);
  assert.ok(Math.abs(Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))<1e-8);
});
test('invalid navigation input cannot corrupt the camera', () => {
  const p=clampPosition({x:NaN,z:Infinity});
  assert.ok(Object.values(p).every(Number.isFinite));
  const v=rotateView(0,0,0,100000);
  assert.ok(v.pitch>=-.72 && v.pitch<=.72);
});
test('guided views turn through the short arc at the angle seam', () => {
  const angle=nearestAngle(Math.PI-.05,-Math.PI+.05);
  assert.ok(Math.abs(angle-(Math.PI-.05))<.11);
});
