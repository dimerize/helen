import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import { createScannerWorld } from '../public/studio/scan-world/world.js';
import { originalScans } from '../public/studio/scan-world/original-scanner.js';

// Only browser I/O is substituted. The production THREE builds and raycasts the
// actual mesh buffers, holes, texture coordinates and materials in these tests.
const assetURL = name => new URL(`../public/studio/scan-world/assets/${name}`, import.meta.url);
function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  for (let offset = 2; offset < bytes.length;) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG source has no image-size header.');
}
const imageSizes = new Map(await Promise.all(originalScans.map(async scan => [scan.image, jpegSize(await readFile(assetURL(scan.image)))])));
const geometryFiles = ['scan-geometry.json', 'scan-geometry-wide.json', 'scan-geometry-notice.json'];
const catalog = await Promise.all(geometryFiles.map(async name => JSON.parse(await readFile(assetURL(name), 'utf8'))));
class TextureLoader {
  async loadAsync(path) {
    const size = imageSizes.get(path.split('/').at(-1));
    assert.ok(size, `The scene requested an original catalog image: ${path}`);
    return new THREE.Texture({ ...size });
  }
}
globalThis.fetch = async path => ({ ok: true, json: async () => JSON.parse(await readFile(assetURL(path.split('/').at(-1)), 'utf8')) });
globalThis.document = {
  fonts: { load: async () => {} },
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, fillText() {} }) }),
};
const renderer = { capabilities: { getMaxAnisotropy: () => 16 } };
const world = await createScannerWorld({ ...THREE, TextureLoader }, renderer);
// Load the actual controller landing policy, without initializing the DOM or
// renderer. This tests the point visitors reach, rather than requiring visual
// landmarks (which may point at lettering) to be empty themselves.
const controller = await readFile(new URL('../public/studio/scan-world/app.js', import.meta.url), 'utf8');
function controllerFunction(name) {
  const start = controller.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `controller still declares ${name}`);
  let depth = 0;
  for (let i = controller.indexOf('{', start); i < controller.length; i++) {
    if (controller[i] === '{') depth++;
    if (controller[i] === '}' && --depth === 0) return controller.slice(start, i + 1);
    if (controller[i] !== '}') continue;
  }
  throw new Error(`Unterminated controller function ${name}`);
}
const safeLanding = new Function('world', 'clamp', `${controllerFunction('groundSafe')}\n${controllerFunction('clearanceHeight')}\n${controllerFunction('findSafeSpot')}\nreturn findSafeSpot;`)(world, (n, min, max) => Math.max(min, Math.min(max, n)));

const meshRoots = () => [world.scanMesh, ...world.root.getObjectByName('Physical typography, traced from the scan').children];
const hash = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
function hardwareSnapshot() {
  const snapshot = [];
  world.originalScanner.root.traverse(node => {
    const item = { uuid: node.uuid, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray(), visible: node.visible };
    if (node.geometry) item.geometry = {
      uuid: node.geometry.uuid,
      index: node.geometry.index && hash(node.geometry.index.array),
      attributes: Object.fromEntries(Object.entries(node.geometry.attributes).map(([key, attribute]) => [key, hash(attribute.array)])),
    };
    if (node.material) item.material = (Array.isArray(node.material) ? node.material : [node.material]).map(material => ({
      uuid: material.uuid, type: material.type, color: material.color?.toArray(), emissive: material.emissive?.toArray(),
      roughness: material.roughness, metalness: material.metalness, opacity: material.opacity, transparent: material.transparent,
      side: material.side, depthTest: material.depthTest, depthWrite: material.depthWrite, blending: material.blending,
      vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
    }));
    if (node.isLight) item.light = { intensity: node.intensity, distance: node.distance, decay: node.decay, color: node.color.toArray() };
    snapshot.push(item);
  });
  return snapshot;
}
function inside(x, z, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function sourceSolid(u, v, region) {
  return inside(u, v, region.polygon) && !(region.holes || []).some(hole => inside(u, v, hole));
}
function rayHeight(x, z, meshes = meshRoots()) {
  world.scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObjects(meshes, false)[0]?.point.y;
}
const close = (actual, expected, message, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} vs ${expected}`);

test('all original scans have distinct explorable geometry and correct source dimensions', () => {
  assert.equal(world.artworks.length, originalScans.length);
  const meshIDs = new Set();
  for (const [index, scan] of originalScans.entries()) {
    world.setArtwork(index);
    assert.equal(world.currentArtwork.image, scan.image);
    assert.equal(world.currentArtwork.title, scan.title);
    assert.equal(world.originalScanner.uniforms.map.value.image.width, imageSizes.get(scan.image).width);
    assert.ok(world.root.getObjectByName('Physical typography, traced from the scan').children.length > 0);
    meshIDs.add(world.scanMesh.uuid);
  }
  assert.equal(meshIDs.size, 3);
});

test('scan selection and scale reveal preserve one native scanner, all 78 meshes and their materials', () => {
  const scanner = world.originalScanner, root = scanner.root, plane = scanner.imagePlane, wand = scanner.wand;
  const baseline = hardwareSnapshot();
  const landmarks = world.landmarks, colliders = world.colliders;
  let meshes = 0; root.traverse(node => { if (node.isMesh) meshes++; });
  assert.equal(meshes, 78);
  close(root.parent.scale.x, 24 / 9.45, 'uniform unit conversion');
  assert.deepEqual(root.parent.scale.toArray(), Array(3).fill(24 / 9.45));
  for (const index of [0, 2, 1, 0, 1, 2]) for (const macro of [0, .05, .5, 1, 0]) {
    world.setArtwork(index); world.setMacro(macro);
    assert.equal(world.originalScanner, scanner); assert.equal(scanner.root, root);
    assert.equal(scanner.imagePlane, plane); assert.equal(scanner.wand, wand);
    assert.equal(world.landmarks, landmarks); assert.equal(world.colliders, colliders);
    assert.deepEqual(hardwareSnapshot(), baseline, `native hardware changed for scan ${index}, reveal ${macro}`);
    assert.equal(world.scanMesh.parent.visible, macro > .00001);
  }
});

test('terrain uses the source image’s exact centered cover crop with no stretch', () => {
  const aspect = 9.45 / 6.24;
  for (const [index, scan] of originalScans.entries()) {
    world.setArtwork(index);
    const size = imageSizes.get(scan.image), imageAspect = size.width / size.height;
    for (const [pu, pv] of [[0, 0], [.2, .7], [.5, .5], [1, 1]]) {
      const expected = imageAspect > aspect ? [(pu - .5) * aspect / imageAspect + .5, pv] : [pu, (pv - .5) * imageAspect / aspect + .5];
      const x = (pu - .5) * world.width, z = (pv - .5) * world.depth;
      const actual = world.currentArtwork.worldToSource(x, z);
      close(actual[0], expected[0], `${scan.image} source u`); close(actual[1], expected[1], `${scan.image} source v`);
      const back = world.currentArtwork.sourceToWorld(...actual);
      close(back.x, x, 'round-trip x'); close(back.z, z, 'round-trip z');
    }
    const geometry = world.scanMesh.geometry, positions = geometry.attributes.position, uv = geometry.attributes.uv;
    for (const vertex of [0, Math.floor(positions.count / 2), positions.count - 1]) {
      const expected = world.currentArtwork.worldToSource(positions.getX(vertex), positions.getZ(vertex));
      close(uv.getX(vertex), expected[0], 'terrain texture u'); close(uv.getY(vertex), 1 - expected[1], 'terrain texture v');
    }
  }
});

test('all rendered relief vertices remain finite, registered and clipped inside the original platen', () => {
  for (let index = 0; index < 3; index++) {
    world.setArtwork(index); world.setMacro(1);
    for (const mesh of meshRoots()) {
      const p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        assert.ok([x, y, z].every(Number.isFinite), `${mesh.name} vertex ${i}`);
        assert.ok(Math.abs(x) <= world.width / 2 + 1e-5 && Math.abs(z) <= world.depth / 2 + 1e-5, `${mesh.name} escapes platen`);
        const source = world.currentArtwork.worldToSource(x, z);
        close(uv.getX(i), source[0], `${mesh.name} cap u`); close(uv.getY(i), 1 - source[1], `${mesh.name} cap v`);
      }
    }
  }
});

test('source counterforms stay open in both rendered caps and collision heights', () => {
  let openSamples = 0;
  for (let index = 0; index < 3; index++) {
    world.setArtwork(index); world.setMacro(1);
    const regions = catalog[index].regions;
    for (const region of regions) for (const hole of region.holes || []) {
      const us = hole.map(p => p[0]), vs = hole.map(p => p[1]);
      let sampled = false;
      for (let row = 1; row < 8 && !sampled; row++) for (let column = 1; column < 8 && !sampled; column++) {
        const u = Math.min(...us) + (Math.max(...us) - Math.min(...us)) * column / 8;
        const v = Math.min(...vs) + (Math.max(...vs) - Math.min(...vs)) * row / 8;
        if (!inside(u, v, hole) || regions.some(other => other !== region && other.kind !== 'paper' && sourceSolid(u, v, other))) continue;
        const { x, z } = world.currentArtwork.sourceToWorld(u, v);
        if (Math.abs(x) > world.width / 2 - .01 || Math.abs(z) > world.depth / 2 - .01) continue;
        const ownMesh = meshRoots().find(mesh => mesh.userData.sourceRegion === regions.indexOf(region));
        if (!ownMesh) continue;
        assert.equal(rayHeight(x, z, [ownMesh]), undefined, 'the contour cap must leave its source counterform open');
        const rendered = rayHeight(x, z);
        assert.ok(Number.isFinite(rendered), 'ray reaches underlying paper inside a source counterform');
        close(world.heightAt(x, z), rendered, 'collision and render agree inside a counterform', .002);
        assert.equal(world.isBlocked(x, z, 0), false, 'a source counterform must be navigable');
        openSamples++; sampled = true;
      }
    }
  }
  assert.ok(openSamples >= 5, `tested ${openSamples} open, visible source counterforms`);
});

test('the controller finds safe entry and map-station landings for every scan', () => {
  const unsafe = [];
  for (let index = 0; index < 3; index++) {
    world.setArtwork(index); world.setMacro(1);
    const artwork = world.currentArtwork;
    const points = [{ name: 'spawn', position: artwork.spawn }, ...world.landmarks.map(station => ({ name: station.title, position: station.position }))];
    assert.ok(points.length >= 4);
    for (const { name, position } of points) {
      const { x, z } = safeLanding(position.x, position.z);
      const label = `${artwork.id}: ${name}`;
      assert.ok(x >= world.bounds.minX && x <= world.bounds.maxX && z >= world.bounds.minZ && z <= world.bounds.maxZ, `${label} within walking bounds`);
      assert.ok(Number.isFinite(world.heightAt(x, z)), `${label} has finite terrain`);
      if (world.isBlocked(x, z, .13)) unsafe.push({ label, x, z, height: world.heightAt(x, z), adjacent: [[.13,0],[-.13,0],[0,.13],[0,-.13]].map(([dx,dz]) => world.heightAt(x + dx, z + dz)) });
      close(rayHeight(x, z), world.heightAt(x, z), `${label} rendered and walked ground agree`, .002);
    }
  }
  assert.deepEqual(unsafe, [], 'landings give the visitor clear footing');
});

test('invalid scan changes fail without losing the selected terrain', () => {
  world.setArtwork(1);
  const previous = world.currentArtwork, mesh = world.scanMesh;
  for (const invalid of [-1, 3, 1.4, undefined, NaN]) {
    assert.throws(() => world.setArtwork(invalid), RangeError);
    assert.equal(world.currentArtwork, previous); assert.equal(world.scanMesh, mesh);
  }
});

test('Paper’s edge shortcut keeps the visitor visible past the raised lettering and native frame', () => {
  world.setArtwork(0); world.setMacro(1); world.setScan(1);
  const station = world.landmarks.find(s => s.id === 'edge');
  const landing = safeLanding(station.position.x, station.position.z);
  const poseFor = new Function('world', 'THREE', 'player', 'orbitYaw', 'orbitPitch', 'orbitDistance', `${controllerFunction('worldPose')}\nreturn worldPose;`)(world, THREE, { ...landing, jump: 0 }, station.viewYaw, .55, 4.5);
  const pose = poseFor();
  world.scene.updateMatrixWorld(true);
  const cameraRay = new THREE.Raycaster(pose.position, pose.target.clone().sub(pose.position).normalize(), 0, pose.position.distanceTo(pose.target));
  const blockers = [world.scanMesh, world.root.getObjectByName('Physical typography, traced from the scan'), world.originalScanner.root];
  assert.equal(cameraRay.intersectObjects(blockers, true).length, 0);
});
