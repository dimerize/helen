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
test('skewed magnifier handle clears the visible scanner silhouette at phone and desktop sizes',()=>{
  for(const scale of [1,24/9.45]) {
    const m=createMagnifier(THREE);placeScannerMagnifier(THREE,m.group,scale);
    const b=new THREE.Box3().setFromObject(m.group);
    assert.equal(m.group.rotation.y,-.18,'retain the original diagonal, not a straight handle');
    assert.ok(b.min.y/scale>.462,'the entire tool clears the moving carriage');
    // Project the heel against the scanner front edge using its original hero
    // camera. Geometric overhang alone does not guarantee a visible handle.
    for(const [width,height] of [[1280,680],[390,450],[390,600],[390,844]]) {
      const narrow=width<700,factor=narrow?Math.max(1,1.35/(width/height)):1;
      const inverse=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,narrow?-.12:-.18,narrow?-.055:-.035)).invert();
      const origin=new THREE.Vector3(narrow?0:1,0,0);
      const transform=p=>new THREE.Vector3(...p).sub(origin).applyQuaternion(inverse).multiplyScalar(scale);
      const camera=new THREE.PerspectiveCamera(39,width/height,.1,100*scale);
      camera.position.copy(transform([narrow?0:.65,8.3*factor,10.4*factor]));
      camera.lookAt(transform([narrow?0:.3,narrow?1.8:0,0]));camera.updateMatrixWorld(true);
      const heel=m.group.getObjectByName('Recessed nickel heel').getWorldPosition(new THREE.Vector3()).project(camera);
      const edge=x=>new THREE.Vector3(x,-.015,3.585).multiplyScalar(scale).project(camera);
      const left=edge(-5.25),right=edge(5.25);
      const edgeY=left.y+(right.y-left.y)*(heel.x-left.x)/(right.x-left.x);
      assert.ok((edgeY-heel.y)*height/2>5,'heel is visibly below the scanner, not only beyond it in world space');
    }
    m.dispose();
  }
});

test('small studio objects rest on supporting surfaces and leave the screen and input devices clear',async()=>{
  const {addStudioKeepsakes}=await import('../public/studio/studio-keepsakes.js');
  const {RoundedBoxGeometry}=await import('../public/studio/vendor/rounded-box.js');
  const {createComputer}=await import('../public/studio/computer-model.js');
  const computer=createComputer(THREE,RoundedBoxGeometry);
  const props=addStudioKeepsakes(computer.group);
  computer.group.updateMatrixWorld(true);
  const bounds=o=>new THREE.Box3().setFromObject(o);
  for(const object of [props.proof,props.pencil]) {
    const b=bounds(object);
    assert.ok(b.min.x>.338&&b.max.x<.525,'small stationery fits between the system case and desk edge');
    assert.ok(b.max.z<.14&&b.min.z>-.265,'stationery stays behind the keyboard and mouse');
    assert.ok(b.min.y>=.790&&b.min.y<.794,'stationery is supported by the desktop');
  }
  const fragment=bounds(props.fragment),screen=bounds(computer.screen);
  assert.ok(fragment.min.x>screen.max.x,'taped fragment does not occlude the CRT glass');
  assert.ok(fragment.min.z>.217,'taped fragment is on the bezel front, not embedded in it');
  const bug=bounds(props.beetle);
  assert.ok(bug.min.y>=1.4464&&bug.min.y<1.448,'feet rest on the actual CRT roof');
  assert.ok(bug.max.x<-.10,'beetle leaves the ventilation slots open');
  let drawCalls=0;
  props.root.traverse(o=>{if(o.geometry){drawCalls++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});
  assert.ok(drawCalls<=22,'stationary miniature components are batched rather than hundreds of separate meshes');
});
