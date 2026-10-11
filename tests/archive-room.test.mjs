import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveItems} from '../public/studio/archive-data.js';
import {archiveRoomLayout,archiveRoomCamera,constrainArchiveMove} from '../public/studio/archive-room-layout.js';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import {createFloorOutlet,cableTerminal} from '../public/studio/scan-world/floor-outlet.js';

test('one physical archive includes the entire catalogue on walls, table and floor',()=>{
 const places=archiveRoomLayout(archiveItems);
 assert.deepEqual(places.map(p=>p.id),archiveItems.map(p=>p.id));
 for(const surface of ['wall','table','floor','lean'])assert.ok(places.some(p=>p.surface===surface));
 for(const p of places)assert.ok([...p.position,p.width,p.height].every(Number.isFinite));
 // Nothing intersects another carrier on the same supporting surface.
 for(const a of places)for(const b of places){
  if(a===b||a.surface!==b.surface)continue;
  const extent=p=>[Math.abs(Math.cos(p.angle))*p.width/2+Math.abs(Math.sin(p.angle))*p.height/2+.12,Math.abs(Math.sin(p.angle))*p.width/2+Math.abs(Math.cos(p.angle))*p.height/2+.12];
  const [aw,ah]=extent(a),[bw,bh]=extent(b),axis=a.surface==='wall'?1:2;
  assert.ok(Math.abs(a.position[0]-b.position[0])>aw+bw||Math.abs(a.position[axis]-b.position[axis])>ah+bh,`${a.id} intersects ${b.id}`);
 }
});
test('phone and desktop use the same archive bearing without changing material placement',()=>{
 const original=archiveRoomLayout(archiveItems),wide=archiveRoomCamera(1440/900),phone=archiveRoomCamera(390/844);
 const bearing=p=>p.position.map((v,i)=>(v-p.target[i])/p.distance);
 bearing(phone).forEach((v,i)=>assert.ok(Math.abs(v-bearing(wide)[i])<1e-10));
 assert.deepEqual(phone.target,wide.target);assert.ok(phone.distance>wide.distance);
 assert.deepEqual(archiveRoomLayout(archiveItems),original);
});
test('dragging stays on its actual supporting surface',()=>{
 for(const p of archiveRoomLayout(archiveItems)){
  const next=constrainArchiveMove(p,[100,100,100]);
  if(p.surface==='wall')assert.equal(next[2],p.position[2]);else assert.equal(next[1],p.position[1]);
  assert.ok(next[0]<10&&next[2]<9.8);
 }
});
test('a moved table piece stays fully supported by the bench, including rotated corners',()=>{
 for(const p of archiveRoomLayout(archiveItems).filter(p=>p.surface==='table')){
  const c=Math.abs(Math.cos(p.angle)),s=Math.abs(Math.sin(p.angle));
  const ex=(p.width*c+p.height*s)/2+.06,ez=(p.height*c+p.width*s)/2+.06;
  for(const sign of [-1,1]){
   const [x,,z]=constrainArchiveMove(p,[sign*100,0,sign*100]);
   assert.ok(Math.abs(x)+ex<7.85,`${p.id} hangs past the side`);
   assert.ok(z-ez>-1.5&&z+ez<3,`${p.id} hangs past the bench edge`);
  }
 }
});
test('the floor socket finishes the original cable at native scale without stretching its extension',()=>{
 const scale=24/9.45,root=createFloorOutlet(THREE,scale);
 const cable=root.children.find(o=>o.geometry?.type==='TubeGeometry');
 const curve=cable.geometry.parameters.path;
 assert.deepEqual(curve.getPoint(0).toArray(),[...cableTerminal]);
 assert.ok(curve.getLength()<1,'short connection, not a second long cable');
 root.updateMatrixWorld(true);
 const start=root.localToWorld(curve.getPoint(0));
 assert.deepEqual(start.toArray(),cableTerminal.map(v=>v*scale));
 assert.ok(Math.max(...new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray())<1.8*scale);
});
