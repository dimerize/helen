import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';
const travel = await import('../public/studio/computer-travel.js').catch(() => ({}));

test('focused screen fits portrait, landscape, and desktop without clipping its usable area', () => {
  assert.equal(typeof travel.getComputerPose, 'function');
  for (const [width,height] of [[390,844],[844,390],[1280,720],[320,568],[768,1024]]) {
    const center=[1.4,1.1034,2.8409];
    const pose=travel.getComputerPose('screen',{width,height,center,screenWidth:.4455,screenHeight:.3276});
    const camera=new THREE.PerspectiveCamera(pose.fov,width/height,.03,55);
    camera.position.fromArray(pose.p);camera.lookAt(...pose.t);camera.updateMatrixWorld(true);
    for(const dx of [-.22275,.22275])for(const dy of [-.1638,.1638]){
      const projected=new THREE.Vector3(center[0]+dx,center[1]+dy,center[2]).project(camera);
      assert.ok(Math.abs(projected.x)<.92,`screen remains inside horizontal bounds at ${width}×${height}`);
      assert.ok(Math.abs(projected.y)<.75,`glass leaves room for bezel and controls at ${width}×${height}`);
    }
    assert.ok(pose.p[2]<2.7,'visitor remains in front of the desk');
  }
});

test('computer approach starts where the visitor is and travels continuously to the screen', () => {
  assert.equal(typeof travel.createComputerTimeline,'function');
  const camera=new THREE.PerspectiveCamera(48,16/9,.03,55);
  camera.position.set(.12,1.62,1.8);camera.lookAt(0,1.82,-4.3);
  const original=camera.position.clone(),orientation=camera.quaternion.clone();let completed=0;
  const timeline=travel.createComputerTimeline({camera,pose:{p:[1.4,1.1034,2.1],t:[1.4,1.1034,2.8409],fov:39},onComplete:()=>completed++});
  assert.equal(timeline.paused(),true);
  assert.ok(camera.position.equals(original));
  assert.ok(camera.quaternion.equals(orientation));
  let previous=original,previousRotation=orientation;
  for(let time=0;time<=1.8;time+=.02){
    timeline.time(time,false);
    assert.ok(camera.position.distanceTo(previous)<.08);
    assert.ok(camera.quaternion.angleTo(previousRotation)<.17,'turning around never snaps past the visitor');
    previous=camera.position.clone();previousRotation=camera.quaternion.clone();
  }
  timeline.progress(1,false);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(1.4,1.1034,2.1))<1e-6);
  assert.equal(camera.fov,39);assert.equal(completed,1);
  const facing=new THREE.Vector3();camera.getWorldDirection(facing);
  assert.ok(facing.angleTo(new THREE.Vector3(0,0,1))<1e-6);
  timeline.kill();
});

test('cancelling an approach leaves the current frame and never opens a stale screen', async () => {
  assert.equal(typeof travel.createComputerTimeline,'function');
  const camera=new THREE.PerspectiveCamera(48,1,.03,55);camera.position.set(.12,1.62,1.8);camera.lookAt(0,1.8,-4);
  let completed=false;
  const timeline=travel.createComputerTimeline({camera,pose:{p:[1.4,1.1,2.1],t:[1.4,1.1,2.84],fov:39},onComplete:()=>{completed=true;}});
  timeline.time(.65,false);const interrupted=camera.position.clone();timeline.kill();
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(camera.position.equals(interrupted));assert.equal(completed,false);
});
