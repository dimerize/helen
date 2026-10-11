import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';
const room=await import('../public/studio/gallery-room.js');

test('the architectural shell preserves artwork clearance and a tall gallery proportion',()=>{
  assert.ok(room.GALLERY_ARCHITECTURE,'gallery architecture exposes its physical bounds');
  const b=room.GALLERY_ARCHITECTURE;
  assert.ok(b.halfWidth>1.897 && b.halfWidth<1.94,'the three approved artwork faces remain inside the original side walls');
  assert.ok(b.height>=3.8 && b.height<=4,'ceiling matches the tall narrow reference bay');
  assert.equal(b.back,-4.4,'back artwork and its camera approach remain registered');
  assert.equal(b.front,3.7,'door aperture remains registered with the entrance path');
});

test('plaster uses local corner contact shading rather than a broad gradient across the whole wall',()=>{
  assert.equal(typeof room.createWallGeometry,'function');
  const g=room.createWallGeometry(8.1,3.8);
  const p=g.getAttribute('position'),c=g.getAttribute('color');
  const samples=[];
  for(let i=0;i<p.count;i++)samples.push({x:p.getX(i),y:p.getY(i),tone:c.getX(i)});
  const center=samples.reduce((a,b)=>Math.hypot(b.x,b.y)<Math.hypot(a.x,a.y)?b:a);
  const corner=samples.reduce((a,b)=>b.x+b.y>a.x+a.y?b:a);
  assert.ok(center.tone>.985,'the exhibition wall remains neutral and even behind art');
  assert.ok(corner.tone<.9 && corner.tone>.65,'the physical corners catch restrained contact shade');
  assert.ok(samples.every(s=>Number.isFinite(s.tone) && s.tone<=1 && s.tone>=.65));
  const box=new THREE.Box3().setFromBufferAttribute(p);
  assert.ok(Math.abs(box.max.x-box.min.x-8.1)<1e-6);
  g.dispose();
});
