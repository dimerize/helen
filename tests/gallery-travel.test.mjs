import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';

const travel = await import('../public/studio/gallery-travel.js').catch(() => ({}));

function setup(position=[.2,1.6,8]) {
  assert.equal(typeof travel.createEntranceTimeline, 'function', 'continuous gallery entry is available');
  assert.equal(typeof travel.createExitTimeline, 'function', 'continuous gallery exit is available');
  const camera = new THREE.PerspectiveCamera(48,1,.03,55);
  camera.position.set(...position);
  camera.lookAt(0,1.58,-2);
  const door=new THREE.Group(), handle=new THREE.Group();
  return {camera,door,handle};
}

test('preparing an entrance leaves the physical door closed until a deliberate play', async () => {
  const parts=setup();
  let arrived=false;
  const timeline=travel.createEntranceTimeline({...parts,onComplete:()=>{arrived=true;}});
  assert.equal(timeline.paused(),true);
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(parts.door.rotation.y,0);
  assert.equal(parts.handle.rotation.z,0);
  assert.deepEqual(parts.camera.position.toArray(),[.2,1.6,8]);
  assert.equal(arrived,false);
  timeline.kill();
});

test('entry opens the hinge before the camera crosses the threshold without teleporting', () => {
  const {camera,door,handle}=setup();
  const timeline=travel.createEntranceTimeline({camera,door,handle});
  timeline.time(.4,false);
  assert.ok(door.rotation.y>.1,'door visibly opens first');
  assert.equal(camera.position.z,8,'viewer waits outside while the door begins opening');
  let previous=camera.position.clone(), crossed=false;
  for(let t=.42;t<=2.6;t+=.02) {
    timeline.time(t,false);
    assert.ok(camera.position.distanceTo(previous)<.2,'camera moves continuously at eye height');
    assert.ok(camera.position.y>=1.6 && camera.position.y<=1.621);
    if(previous.z>3.7 && camera.position.z<=3.7) {
      crossed=true;
      assert.ok(door.rotation.y>1.55,'hinge clears the aperture before the viewer steps through');
      assert.ok(Math.abs(camera.position.x)<.6,'viewer goes through the actual opening');
    }
    previous.copy(camera.position);
  }
  assert.ok(crossed,'entry actually passes through the doorway');
  timeline.kill();
});

test('completed entry reaches the approved room view and completes only once', () => {
  const parts=setup();
  let completions=0;
  const timeline=travel.createEntranceTimeline({...parts,onComplete:()=>completions++});
  timeline.progress(1,false);
  assert.ok(parts.camera.position.distanceTo(new THREE.Vector3(.12,1.62,1.8))<1e-7);
  const direction=new THREE.Vector3();parts.camera.getWorldDirection(direction);
  const expected=new THREE.Vector3(-.12,.2,-6.1).normalize();
  assert.ok(direction.angleTo(expected)<1e-6,'last frame aims into the room before camera controls take over');
  assert.ok(Math.abs(parts.door.rotation.y-1.67)<1e-7);
  assert.equal(parts.handle.rotation.z,0);
  assert.equal(completions,1);
  timeline.kill();
});

test('leaving any artwork or side of the room uses the opening and closes only after clearing it', () => {
  for(const position of [[.12,1.62,1.8],[.45,1.62,1.08],[0,1.62,-1.7],[-.45,1.62,-.5],[1.45,1.62,3.2],[-1.45,1.62,3.2]]) {
    const parts=setup(position);parts.door.rotation.y=1.67;
    parts.camera.lookAt(-1.8,1.9,1);
    const timeline=travel.createExitTimeline(parts);
    assert.equal(timeline.paused(),true);
    for(let t=0;t<=2.46;t+=.01) {
      timeline.time(t,false);
      if(parts.camera.position.z>3.35 && parts.camera.position.z<4.1) {
        assert.ok(Math.abs(parts.camera.position.x)<.69,`camera stays inside the opening from ${position}`);
        assert.ok(parts.door.rotation.y>1.5,'door does not close on the viewer');
      }
    }
    assert.ok(parts.camera.position.distanceTo(new THREE.Vector3(.2,1.6,8))<1e-7);
    assert.ok(parts.door.rotation.y<1e-7);
    timeline.kill();
  }
});

test('an entrance cancelled halfway can retreat without stepping farther into the room', () => {
  const parts=setup([.19,1.61,5]);parts.door.rotation.y=1.2;
  const timeline=travel.createExitTimeline(parts);
  let previousZ=5;
  for(let t=0;t<=2.46;t+=.02) {
    timeline.time(t,false);
    assert.ok(parts.camera.position.z>=previousZ-1e-7);
    previousZ=parts.camera.position.z;
  }
  timeline.kill();
});
