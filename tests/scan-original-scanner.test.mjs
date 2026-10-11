import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as THREE from '../public/studio/vendor/three.module.min.js';
import { createOriginalScanner, sourceProvenance } from '../public/studio/scan-world/original-scanner.js';

// Execute the captured production construction code with a non-rendering
// renderer. Every geometry and material is still built by the real THREE.
// This compares against the source that was deployed, not a second handwritten
// list of expected dimensions that could accidentally repeat a changed value.
const productionSource = await readFile(new URL('./fixtures/original-scanner.production.js.txt', import.meta.url), 'utf8');
const sourceHash = createHash('sha256').update(productionSource).digest('hex');
const dimensions = [[2048, 1908], [2048, 707], [1536, 2048]];
const makeTexture = (index) => {
  const texture = new THREE.Texture({ width: dimensions[index][0], height: dimensions[index][1] });
  texture.name = `source-scan-${index}`;
  return texture;
};
const makeCanvas = () => {
  const operations = [];
  const context = {
    clearRect: (...args) => operations.push(['clearRect', ...args]),
    fillText: (...args) => operations.push(['fillText', context.fillStyle, context.font, ...args]),
  };
  return { width: 0, height: 0, operations, getContext: () => context };
};
globalThis.document = { fonts: { load: async () => {}, check: () => true }, createElement: makeCanvas };
const renderer = { capabilities: { getMaxAnisotropy: () => 16 } };
class HeadlessRenderer {
  capabilities = renderer.capabilities;
  domElement = {};
  setPixelRatio() {}
  setClearColor() {}
}
let textureIndex = 0;
class TextureLoader { async loadAsync() { return makeTexture(textureIndex++); } }
const constructorBody = productionSource.slice(
  productionSource.indexOf('  const renderer=new THREE.WebGLRenderer'),
  productionSource.indexOf('  let targetAspect=1;'),
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const buildProduction = new AsyncFunction('THREE', 'mount', 'scans', 'devicePixelRatio',
  `${constructorBody}\n return { root: rig, imagePlane, wand, uniforms: uniform, lights: scene.children.filter(n => n.isLight), camera, renderer };`);
const production = await buildProduction(
  { ...THREE, WebGLRenderer: HeadlessRenderer, TextureLoader },
  { append() {} },
  [{ image: 'train-scan.webp' }, { image: 'train-scan-wide.webp' }, { image: 'train-scan-notice.webp' }],
  1,
);
const factory = await createOriginalScanner(THREE, dimensions.map((_, i) => makeTexture(i)), renderer);

function arrayHash(array) {
  return createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
}
function textureSignature(texture) {
  if (!texture) return null;
  return {
    type: texture.type, colorSpace: texture.colorSpace, anisotropy: texture.anisotropy,
    image: [texture.image?.width, texture.image?.height], canvas: texture.image?.operations,
    flipY: texture.flipY, wrapS: texture.wrapS, wrapT: texture.wrapT,
  };
}
function materialSignature(material) {
  const keys = ['type', 'roughness', 'metalness', 'opacity', 'transparent', 'side', 'depthWrite', 'depthTest', 'blending', 'toneMapped', 'vertexShader', 'fragmentShader'];
  const result = Object.fromEntries(keys.map(key => [key, material[key]]));
  result.color = material.color?.toArray();
  result.emissive = material.emissive?.toArray();
  result.map = textureSignature(material.map);
  if (material.uniforms) result.uniforms = Object.fromEntries(Object.entries(material.uniforms).map(([key, entry]) => [key, entry.value?.isTexture ? textureSignature(entry.value) : entry.value]));
  return result;
}
function nodeSignature(node) {
  const result = {
    type: node.type,
    position: node.position.toArray(), rotation: node.rotation.toArray(), scale: node.scale.toArray(),
    castShadow: node.castShadow, receiveShadow: node.receiveShadow,
    visible: node.visible, renderOrder: node.renderOrder,
  };
  if (node.geometry) result.geometry = {
    type: node.geometry.type,
    groups: node.geometry.groups,
    index: node.geometry.index ? arrayHash(node.geometry.index.array) : null,
    attributes: Object.fromEntries(Object.entries(node.geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, count: attribute.count, hash: arrayHash(attribute.array) }])),
  };
  if (node.material) result.material = materialSignature(node.material);
  if (node.isLight) {
    result.light = { color: node.color.toArray(), intensity: node.intensity, distance: node.distance, decay: node.decay, groundColor: node.groundColor?.toArray() };
  }
  result.children = node.children.map(nodeSignature);
  return result;
}

test('captured production source has the documented immutable SHA-256', () => {
  assert.equal(sourceHash, sourceProvenance.sha256);
});

test('vendored THREE geometry constructors are byte-identical to production', async () => {
  const [module, core] = await Promise.all([
    readFile(new URL('../public/studio/vendor/three.module.min.js', import.meta.url)),
    readFile(new URL('../public/studio/vendor/three.core.min.js', import.meta.url)),
  ]);
  assert.equal(createHash('sha256').update(module).digest('hex'), sourceProvenance.threeModuleSha256);
  assert.equal(createHash('sha256').update(core).digest('hex'), sourceProvenance.threeCoreSha256);
});

test('all scanner mesh buffers, materials, offsets, label drawing, light and cable exactly match production', () => {
  assert.deepEqual(nodeSignature(factory.root), nodeSignature(production.root));
  let meshCount = 0;
  factory.root.traverse(node => { if (node.isMesh) meshCount++; });
  assert.equal(meshCount, 78);
});

test('production lighting and renderer color pipeline are preserved', () => {
  assert.deepEqual(factory.createLighting().map(nodeSignature), production.lights.map(nodeSignature));
  assert.equal(factory.renderConfig.toneMapping, production.renderer.toneMapping);
  assert.equal(factory.renderConfig.toneMappingExposure, production.renderer.toneMappingExposure);
  assert.equal(factory.renderConfig.outputColorSpace, production.renderer.outputColorSpace);
});

test('scan pass moves only the original wand with the production equation', () => {
  for (const progress of [0, .25, .42, .9, 1]) {
    factory.setScan(progress);
    assert.equal(factory.wand.position.z, (.5 - progress) * 6.24);
    assert.equal(factory.uniforms.progress.value, progress);
  }
});

test('all three scans update the same original plane and preserve their cover crop', () => {
  const samePlane = factory.imagePlane;
  for (let index = 0; index < 3; index++) {
    factory.setTexture(index);
    assert.equal(factory.imagePlane, samePlane);
    assert.equal(factory.uniforms.imageAspect.value, dimensions[index][0] / dimensions[index][1]);
    for (const [u, v] of [[0, 0], [.2, .7], [.5, .5], [1, 1]]) {
      const image = factory.platenToImageUV(u, v);
      const roundTrip = factory.imageToPlatenUV(...image);
      assert.ok(Math.abs(roundTrip[0] - u) < 1e-12);
      assert.ok(Math.abs(roundTrip[1] - v) < 1e-12);
      assert.ok(image.every(value => value >= 0 && value <= 1));
    }
  }
});

test('original desktop and phone camera and rig poses match source constants', () => {
  assert.deepEqual(factory.getPose(1400, 850), {
    fov: 39, near: .1, far: 100, position: [.65, 8.3, 10.4], target: [.3, 0, 0],
    rigPosition: [1, 0, 0], rigRotation: [0, -.18, -.035],
  });
  const phone = factory.getPose(390, 844);
  assert.equal(phone.position[0], 0);
  assert.equal(phone.position[1], 8.3 * 1.35 / (390 / 844));
  assert.deepEqual(phone.rigRotation, [0, -.12, -.055]);
});
