import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import {createGalleryDoor} from '../public/studio/gallery-door.js';
import {createParsonsRelief} from '../public/studio/parsons-relief.js';
import {createMagnifier} from '../public/studio/scan-world/magnifier.js';
import {placeScannerMagnifier} from '../public/studio/scan-world/magnifier-placement.js';

test('physical door details preserve the animated leaf and handle pivots',()=>{
  const {door,handle,plaque}=createGalleryDoor();
  assert.deepEqual(handle.position.toArray(),[1.49,1.19,.11]);
  assert.equal(handle.parent,door);assert.equal(plaque.parent,door);
  const leaf=door.getObjectByName('Painted steel leaf');
  const b=new THREE.Box3().setFromObject(leaf),s=b.getSize(new THREE.Vector3());
  for(const [a,v] of [['x',1.68],['y',2.78],['z',.085]]) assert.ok(Math.abs(s[a]-v)<1e-6);
  door.rotation.y=1.67;door.updateMatrixWorld(true);
  assert.ok(handle.getWorldPosition(new THREE.Vector3()).z<0,'handle travels with the original hinge axis');
});
test('official logo has shallow, finite relief with recognizable open letter counters',()=>{
  const logo=createParsonsRelief(.225);const b=new THREE.Box3().setFromObject(logo);
  assert.ok(b.max.x-b.min.x<=.226);assert.ok(b.max.z-b.min.z>.0006&&b.max.z-b.min.z<.001);
  assert.equal(logo.children[1].geometry.parameters.shapes.length,12,'THE NEW SCHOOL has twelve filled letters, not inverted holes');
  let holes=0;
  logo.traverse(o=>{if(o.geometry){for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));for(const shape of o.geometry.parameters.shapes) {
    holes+=shape.holes.length;
    const outline=new THREE.Box2().setFromPoints(shape.getPoints());
    for(const hole of shape.holes) for(const point of hole.getPoints()) assert.ok(outline.containsPoint(point),'letter outlines enclose their counters');
  }}});
  assert.ok(holes>=5,'holes in P, A, R, O and school letters survive extrusion');
});
test('magnifier heel barely overhangs the exact original scanner at every unit scale',()=>{
  for(const scale of [1,24/9.45]) {
    const m=createMagnifier(THREE);placeScannerMagnifier(THREE,m.group,scale);
    const b=new THREE.Box3().setFromObject(m.group);
    assert.ok(Math.abs(b.max.z/scale-3.615)<1e-5);
    assert.ok(b.min.y/scale>.462,'the entire tool clears the moving carriage, including its ventilation ribs');
    assert.ok(m.group.position.z/scale<1.8,'lens sits farther back on the platen');
    assert.ok(m.group.position.z/scale+.93*.73<6.24/2,'the entire optical ring remains over the platen');
    m.dispose();
  }
});
