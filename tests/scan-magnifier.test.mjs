import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/studio/vendor/three.module.min.js';

let module;
try { module = await import('../public/studio/scan-world/magnifier.js'); } catch {}
function make() {
  assert.equal(typeof module?.createMagnifier, 'function', 'A reusable real 3D magnifier factory is required.');
  return module.createMagnifier(THREE);
}

// A flattened disc or a ring filled by metal would break the looking-through
// interaction even though the control could still appear clickable.
test('the magnifier has a finite convex glass volume inside an open metal frame', () => {
  const model = make();
  assert.ok(model.group.isGroup);
  const glass = [];
  model.group.traverse(node => {
    if (!node.isMesh) return;
    for (const attribute of Object.values(node.geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
    if (node.material.transmission > .7) glass.push(node);
  });
  assert.equal(glass.length, 1);
  const lens = glass[0];
  lens.geometry.computeBoundingBox();
  const size = lens.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.y > .10, 'Glass must have actual thickness.');
  assert.ok(size.x > size.y * 5 && size.z > size.y * 5);
  const positions = lens.geometry.attributes.position;
  let centerTop = -Infinity, rimTop = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const radial = Math.hypot(positions.getX(i), positions.getZ(i));
    if (radial < .1) centerTop = Math.max(centerTop, positions.getY(i));
    if (radial > .7) rimTop = Math.max(rimTop, positions.getY(i));
  }
  assert.ok(centerTop > rimTop + .04, 'Convex glass must bulge above its edge.');
  model.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(model.group, true).filter(hit => hit.object.visible);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].object, lens, 'The aperture remains glass rather than a metal-filled disc.');
  model.dispose();
});

// Borrowed scanner textures must survive both scan switching and disposal.
test('source artwork stays borrowed and unchanged when the magnifier is replaced or disposed', () => {
  const model = make();
  const first = new THREE.Texture({ width: 2048, height: 712 });
  const second = new THREE.Texture({ width: 2048, height: 1908 });
  first.repeat.set(.7, .8); first.offset.set(.2, .1);
  let firstDisposed = 0, secondDisposed = 0;
  first.addEventListener('dispose', () => firstDisposed++);
  second.addEventListener('dispose', () => secondDisposed++);
  const before = { repeat: first.repeat.toArray(), offset: first.offset.toArray(), flipY: first.flipY, colorSpace: first.colorSpace };
  model.setSource(first, { centerUV: [.75, .32], sourceSpan: [.3, .4], magnification: 2.8 });
  let borrowedMaps = 0;
  model.group.traverse(node => {
    if (!node.isMesh) return;
    const material = node.material;
    if (material.map === first || Object.values(material.uniforms || {}).some(uniform => uniform.value === first)) borrowedMaps++;
  });
  assert.ok(borrowedMaps > 0, 'The actual artwork must be used beneath the lens.');
  assert.deepEqual({ repeat: first.repeat.toArray(), offset: first.offset.toArray(), flipY: first.flipY, colorSpace: first.colorSpace }, before);
  model.setSource(second);
  model.dispose(); model.dispose();
  assert.equal(firstDisposed, 0);
  assert.equal(secondDisposed, 0);
});

// Reflections may move inside the lens, but the tool stays anchored to the
// artwork. Reduced motion must freeze the actual uniforms used by the shader.
test('the optical reflection moves gently without autonomous transforms and freezes with reduced motion', () => {
  const model = make();
  model.group.position.set(3, 1, 5);
  model.group.rotation.set(.1, .2, .3);
  const before = { position: model.group.position.toArray(), rotation: model.group.rotation.toArray(), scale: model.group.scale.toArray() };
  const phases = [];
  model.group.traverse(node => {
    const uniform = node.material?.uniforms?.reflectionPhase;
    if (uniform) phases.push(uniform);
  });
  assert.ok(phases.length > 0, 'The curved glass shader needs a controllable reflection phase.');
  model.update({ time: 0 });
  const initial = phases.map(uniform => uniform.value);
  model.update({ time: 8 });
  const changed = phases.map(uniform => uniform.value);
  assert.ok(changed.some((value, index) => value !== initial[index]));
  assert.ok(changed.every((value, index) => Math.abs(value - initial[index]) < 1), 'Reflection travel stays slow.');
  model.update({ hover: true });
  assert.deepEqual(phases.map(uniform => uniform.value), changed, 'Hover without a frame time must not reset the reflection.');
  model.update({ time: 700, reduced: true });
  assert.deepEqual(phases.map(uniform => uniform.value), changed);
  model.update({ time: 900, reduced: true });
  assert.deepEqual(phases.map(uniform => uniform.value), changed);
  for (const time of [0, .1, 3, 47, 800]) {
    model.update({ hover: true, time, reduced: true });
    model.update({ hover: false, time, reduced: false });
  }
  assert.deepEqual({ position: model.group.position.toArray(), rotation: model.group.rotation.toArray(), scale: model.group.scale.toArray() }, before);
  model.dispose();
});

// A single triangle fan has a flat/conical normal field and loses the changing
// reflection that makes a lens look convex. Sample the actual source surface.
test('the magnified artwork sits on a smoothly curved radial surface', () => {
  const model = make();
  model.setSource(new THREE.Texture({ width: 64, height: 64 }));
  const source = [];
  model.group.traverse(node => {
    if (node.material?.uniforms?.artwork) source.push(node);
  });
  assert.equal(source.length, 1);
  const points = source[0].geometry.attributes.position;
  const radialBands = new Set(), elevations = new Set();
  for (let i = 0; i < points.count; i++) {
    radialBands.add(Math.round(Math.hypot(points.getX(i), points.getZ(i)) * 100));
    elevations.add(Math.round(points.getY(i) * 10000));
  }
  assert.ok(radialBands.size >= 12, 'Curvature must include intermediate rings across the glass.');
  assert.ok(elevations.size >= 12);
  model.dispose();
});

// Shared resource disposal can break another magnifier or leak GPU buffers
// every time a paper card is opened.
test('disposal releases each owned geometry and material once without touching another model', () => {
  const first = make(), second = make();
  const ownership = model => {
    const values = new Set();
    model.group.traverse(node => {
      if (!node.isMesh) return;
      values.add(node.geometry);
      if (node.isInstancedMesh) values.add(node);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) values.add(material);
    });
    return values;
  };
  const owned = ownership(first), other = ownership(second), counts = new Map();
  assert.ok([...owned].every(value => !other.has(value)));
  for (const value of [...owned, ...other]) {
    counts.set(value, 0);
    value.addEventListener('dispose', () => counts.set(value, counts.get(value) + 1));
  }
  const parent = new THREE.Group(); parent.add(first.group);
  first.dispose(); first.dispose();
  assert.equal(first.group.parent, null);
  assert.ok([...owned].every(value => counts.get(value) === 1));
  assert.ok([...other].every(value => counts.get(value) === 0));
  second.dispose();
});
