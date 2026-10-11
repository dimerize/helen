import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import {cameraJourneyOffset} from '../public/studio/camera-journey.js';

test('camera route reverses horizontal direction without changing orientation or lens', () => {
  const camera=new THREE.PerspectiveCamera(48,390/844,.1,100);
  const target=new THREE.Vector3(0,0,0);
  camera.position.set(0,12,20);camera.lookAt(target);
  const q=camera.quaternion.clone(), position=camera.position.clone();
  const departure=cameraJourneyOffset(THREE,camera,target,1,'depart');
  const arrival=cameraJourneyOffset(THREE,camera,target,1,'arrive');
  assert(departure.x>0 && arrival.x<0);
  assert(Math.abs(departure.x+arrival.x)<1e-10);
  assert(departure.y>0 && departure.z>0);
  assert(camera.quaternion.equals(q));assert(camera.position.equals(position));assert.equal(camera.fov,48);
});

test('camera movement stays bounded on mobile and wide desktop', () => {
  for(const aspect of [390/844,16/9,3]) {
    const camera=new THREE.PerspectiveCamera(42,aspect,.1,100);
    camera.position.set(0,0,20);camera.lookAt(0,0,0);
    const height=40*Math.tan(42*Math.PI/360);
    const offset=cameraJourneyOffset(THREE,camera,new THREE.Vector3(),-1,'depart');
    assert(Math.abs(offset.x)/(height*aspect)<.15);
    assert(offset.z/height<.07);
  }
});
