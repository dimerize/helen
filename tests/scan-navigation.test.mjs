import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSurfaceNavigator as create } from '../public/studio/scan-world/navigation.js';
const bounds = { minX: 0, maxX: 6, minZ: 0, maxZ: 6 };
function checkSurface(path, heightAt) {
  assert.ok(path.length, 'a route exists');
  for (const p of path) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  for (let i = 1; i < path.length; i++) {
    const a = path[i-1], b = path[i], distance = Math.hypot(b.x-a.x,b.z-a.z), samples = Math.ceil(distance/.015);
    let last = heightAt(a.x,a.z);
    for (let j=1;j<=samples;j++) {
      const t = j/samples, height = heightAt(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);
      assert.ok(Math.abs(height-last)<=.29001,'route does not cross a cliff');
      last = height;
    }
  }
}
test('flat ground retains exact requested endpoint and simplifies straight walk', () => {
  const route = create({bounds,heightAt:()=>0}).findPath({x:.3,z:.6},{x:5.71,z:4.83});
  assert.ok(route.length>0);
  assert.deepEqual(route.at(-1),{x:5.71,z:4.83});
  assert.ok(route.length<=3);
});
test('walks around solid wall through a real opening', () => {
  const heightAt = (x,z) => x>=2.7&&x<=3.3&&z<4.7?2:0;
  const route = create({bounds,heightAt}).findPath({x:1,z:1},{x:5,z:1});
  checkSurface(route,heightAt);
  assert.ok(route.some(p=>p.z>=4.7));
  assert.deepEqual(route.at(-1),{x:5,z:1});
});
test('does not escape an enclosed hole or drop from a disconnected cap', () => {
  const heightAt=(x,z)=>x>=2&&x<=4&&z>=2&&z<=4?0:2;
  const n=create({bounds,heightAt});
  assert.deepEqual(n.findPath({x:3,z:3},{x:.5,z:.5}),[]);
  assert.deepEqual(n.findPath({x:.5,z:.5},{x:3,z:3}),[]);
});
test('clicking raised ink finds reachable ground within 1.6', () => {
  const heightAt=(x,z)=>x>=3&&x<=4&&z>=2&&z<=4?2:0;
  const goal={x:3.5,z:3};
  const route=create({bounds,heightAt}).findPath({x:1,z:3},goal);
  checkSurface(route,heightAt);
  assert.equal(heightAt(route.at(-1).x,route.at(-1).z),0);
  assert.ok(Math.hypot(route.at(-1).x-goal.x,route.at(-1).z-goal.z)<=1.6);
});
test('diagonally touching barriers cannot be squeezed between', () => {
  const small={minX:0,maxX:2,minZ:0,maxZ:2};
  const heightAt=(x,z)=> (x>=1&&z<1)||(x<1&&z>=1)?2:0;
  assert.deepEqual(create({bounds:small,heightAt,cellSize:.2}).findPath({x:.2,z:.2},{x:1.8,z:1.8}),[]);
});
test('invalid input and unwalkable heights produce no NaN routes', () => {
  const nav=create({bounds,heightAt:()=>NaN});
  assert.deepEqual(nav.findPath({x:1,z:1},{x:2,z:2}),[]);
  assert.deepEqual(create({bounds,heightAt:()=>0}).findPath({x:NaN,z:0},{x:2,z:2}),[]);
});
test('a visitor already atop pigment can walk along its same connected cap', () => {
  const heightAt=(x,z)=>x>=2&&x<=4&&z>=2&&z<=4?2:0;
  const route=create({bounds,heightAt}).findPath({x:2.3,z:2.3},{x:3.7,z:3.7});
  checkSurface(route,heightAt);
  assert.deepEqual(route.at(-1),{x:3.7,z:3.7});
});
