import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import CameraControls from 'camera-controls';

// CameraControls only needs this platform shape when no input element is attached.
globalThis.DOMRect ??= class DOMRect { constructor(x=0,y=0,width=0,height=0) {Object.assign(this,{x,y,width,height});} };
const module = await import('../public/studio/gallery-controls.js').catch(() => ({}));
const navigation = await import('../public/studio/gallery-navigation.js');
function setup(reducedMotion=false) {
  assert.equal(typeof module.createGalleryControls, 'function', 'gallery uses a reusable CameraControls adapter');
  const camera = new THREE.PerspectiveCamera(61,1,.055,45);
  const controller = module.createGalleryControls({THREE, CameraControls, camera, reducedMotion});
  controller.setView([0,1.65,3],[0,1.65,-4],false);
  controller.update(1/60);
  return {camera,controller};
}
function settle(controller, frames=240) { for(let i=0;i<frames;i++) controller.update(1/60); }

test('viewpoint travel is damped by the actual camera library', () => {
  const {camera,controller}=setup();
  controller.setView([0,1.65,-1],[0,1.9,-4]);
  controller.update(1/60);
  assert.ok(camera.position.z<3 && camera.position.z>2.5, 'starts moving without teleporting');
  settle(controller);
  assert.ok(Math.abs(camera.position.z+1)<.002, 'settles at requested viewpoint');
});
test('interrupting a guided trip freezes its current position instead of its destination', () => {
  const {camera,controller}=setup();
  controller.setView([1.3,1.65,-3],[0,1.8,-4]);
  settle(controller,12);
  const before=camera.position.clone();
  controller.interrupt();
  settle(controller);
  assert.ok(camera.position.distanceTo(before)<.001);
});
test('walking while looking upward stays at eye level and within gallery walls', () => {
  const {camera,controller}=setup();
  controller.setView([1,1.65,0],[5,4,-2],false);
  for(let i=0;i<600;i++) {controller.walk(1,1,1/60);controller.update(1/60);}
  settle(controller);
  assert.ok(camera.position.x<=1.4501 && camera.position.x>=-1.4501);
  assert.ok(camera.position.z<=4.1001 && camera.position.z>=-3.8001);
  assert.ok(Math.abs(camera.position.y-1.65)<1e-8, 'no climbing when looking up');
});
test('an unbounded wheel burst cannot leave a long queued camera journey', () => {
  const {camera,controller}=setup();
  for(let i=0;i<100;i++) controller.advance(100);
  settle(controller);
  assert.ok(camera.position.z>2.45 && camera.position.z<3, 'at most a short walking impulse is queued');
});
test('reduced motion reaches a named view immediately', () => {
  const {camera,controller}=setup(true);
  controller.setView([1,1.65,-2],[-2,1.9,-2]);
  controller.update(1/60);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(1,1.65,-2))<.001);
});
test('viewpoint retargeting rotates through the short arc across the angle seam', () => {
  const {camera,controller}=setup();
  const from=Math.PI-.04, to=-Math.PI+.04;
  controller.setView([0,1.65,0],[Math.sin(from),1.65,-Math.cos(from)],false);
  controller.update(1/60);
  const directionBefore=new THREE.Vector3();camera.getWorldDirection(directionBefore);
  controller.setView([0,1.65,0],[Math.sin(to),1.65,-Math.cos(to)]);
  let maxTurn=0;
  for(let i=0;i<120;i++) {controller.update(1/60);const d=new THREE.Vector3();camera.getWorldDirection(d);maxTurn=Math.max(maxTurn,d.angleTo(directionBefore));}
  assert.ok(maxTurn<.12, 'no near-full revolution');
});
test('wheel line and pixel units produce equivalent walking distances', () => {
  assert.equal(typeof navigation.wheelDistance, 'function');
  assert.equal(navigation.wheelDistance({deltaY:3,deltaMode:1},800),navigation.wheelDistance({deltaY:48,deltaMode:0},800));
  assert.ok(Math.abs(navigation.wheelDistance({deltaY:50000,deltaMode:2},800))<=.45);
});
