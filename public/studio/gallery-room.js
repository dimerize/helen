import * as THREE from './vendor/three.module.min.js';
import {addGallerySmallDetails} from './gallery-small-details.js';

// Inferred from thesis-installation.webp, not a measured survey. The original
// artwork faces, doorway and computer retain their world-space registration.
export const GALLERY_ARCHITECTURE = Object.freeze({halfWidth: 1.91, back: -4.4, front: 3.7, height: 3.85});

export function createWallGeometry(width, height) {
  const geometry = new THREE.PlaneGeometry(width, height, 48, 28);
  const positions = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const edge = width / 2 - Math.abs(positions.getX(i));
    const floor = positions.getY(i) + height / 2;
    const ceiling = height / 2 - positions.getY(i);
    const shade = 1 - .11 * Math.exp(-Math.max(0, edge) * 11)
      - .14 * Math.exp(-Math.max(0, floor) * 9)
      - .085 * Math.exp(-Math.max(0, ceiling) * 10);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/** One architectural shell for the actual doorway scene. No duplicate artworks. */
export function createGalleryArchitecture(scene, renderer) {
  const {halfWidth, back, front, height} = GALLERY_ARCHITECTURE;
  const depth = front - back, mid = (front + back) / 2;
  const root = new THREE.Group();
  root.name = 'Installation architecture — plaster, concrete and ceiling ribs';
  scene.add(root);
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const hash = (x, y, seed) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  function noise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return (hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u) * (1 - v)
      + (hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u) * v;
  }
  function surfaceTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(512, 512);
    const floor = kind === 'floor', rand = seeded(floor ? 19301 : 897);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      // Small, irregular aggregate, without repeating sinusoidal cloud bands.
      const coarse = noise(x / 46, y / 46, 82) - .5;
      const midNoise = noise(x / 8, y / 8, 393) - .5;
      const fine = rand() - .5;
      const value = (floor ? 186 : 233) + coarse * (floor ? 13 : 5)
        + midNoise * (floor ? 12 : 5) + fine * (floor ? 9 : 6);
      data.data[i] = value + (floor ? 1 : 2);
      data.data[i + 1] = value;
      data.data[i + 2] = value - (floor ? 2 : 3);
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    if (floor) for (let i = 0; i < 24; i++) {
      const x = rand() * 512, y = rand() * 512;
      ctx.strokeStyle = `rgba(67,65,59,${.018 + rand() * .028})`;
      ctx.lineWidth = .35 + rand() * .8;
      ctx.beginPath();ctx.moveTo(x, y);ctx.lineTo(x + 6 + rand() * 23, y + rand() * 3);ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(floor ? 2.4 : 5.2, floor ? 5.2 : 2.45);
    map.anisotropy = anisotropy;
    return map;
  }
  const plaster = surfaceTexture('plaster'), concrete = surfaceTexture('floor');
  const wallMaterial = new THREE.MeshStandardMaterial({map: plaster, bumpMap: plaster, bumpScale: .012, roughness: .98, color: '#f5f4ef', vertexColors: true});
  const floorMaterial = new THREE.MeshStandardMaterial({map: concrete, bumpMap: concrete, bumpScale: .007, roughness: .91, color: '#e5e6df', vertexColors: true});
  const ceilingMaterial = new THREE.MeshStandardMaterial({map: plaster, bumpMap: plaster, bumpScale: .007, color: '#e8e6df', roughness: .98});
  const skirting = new THREE.MeshStandardMaterial({color: '#6f6355', roughness: .88});
  const trimTop = new THREE.MeshStandardMaterial({color: '#968a79', roughness: .82});
  const offWhite = new THREE.MeshStandardMaterial({color: '#dcdbd2', roughness: .91});
  const seam = new THREE.MeshStandardMaterial({color: '#bbb9af', roughness: .94});
  const metal = new THREE.MeshStandardMaterial({color: '#6c6d66', roughness: .6, metalness: .24});
  function mesh(geometry, material, position, parent = root) {
    const value = new THREE.Mesh(geometry, material);
    value.position.fromArray(position);value.receiveShadow = true;parent.add(value);return value;
  }
  function block(w, h, d, material, position, parent = root) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, position, parent);
  }
  for (const side of [-1, 1]) {
    const wall = mesh(createWallGeometry(depth, height), wallMaterial, [side * halfWidth, height / 2, mid]);
    wall.rotation.y = -side * Math.PI / 2;
    wall.name = side < 0 ? 'Left matte plaster wall' : 'Right matte plaster wall';
  }
  const backWall = mesh(createWallGeometry(halfWidth * 2, height), wallMaterial, [0, height / 2, back]);
  backWall.name = 'Back matte plaster wall';
  const floor = mesh(createWallGeometry(halfWidth * 2, depth), floorMaterial, [0, 0, mid]);
  floor.name = 'Concrete floor';floor.rotation.x = -Math.PI / 2;
  const ceiling = mesh(new THREE.PlaneGeometry(halfWidth * 2, depth), ceilingMaterial, [0, height, mid]);
  ceiling.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    block(.039, .135, depth, skirting, [side * (halfWidth - .019), .0675, mid]);
    block(.05, .009, depth, trimTop, [side * (halfWidth - .024), .139, mid]);
    block(.03, .02, depth, seam, [side * (halfWidth - .014), height - .028, mid]);
  }
  block(halfWidth * 2, .135, .038, skirting, [0, .0675, back + .019]);
  block(halfWidth * 2, .009, .05, trimTop, [0, .139, back + .024]);
  // A plasterboard joint and its tiny reveal are visible in the supplied photo.
  block(.005, height - .16, .012, seam, [-halfWidth + .002, height / 2 + .06, -.22]);
  block(.008, height - .16, .016, offWhite, [-halfWidth + .005, height / 2 + .06, -.207]);
  for (const z of [-3.7, -.45, 2.8]) {
    const rib = block(halfWidth * 2, .15, .105, offWhite, [0, height - .075, z]);
    rib.castShadow = true;
    block(halfWidth * 2, .012, .018, seam, [0, height - .155, z + .032]);
  }
  for (const x of [-1.23, .98]) block(.018, .016, depth, offWhite, [x, height - .01, mid]);
  const fluorescent = new THREE.MeshBasicMaterial({color: '#fffdf0', toneMapped: false});
  function fixture(z, length) {
    const rig = new THREE.Group();rig.position.set(-.22, height - .21, z);root.add(rig);
    block(.17, .06, length, offWhite, [0, 0, 0], rig);
    for (const side of [-1, 1]) {
      block(.018, .034, length, seam, [side * .08, -.035, 0], rig);
      const tube = mesh(new THREE.CylinderGeometry(.017, .017, length - .1, 10), fluorescent, [side * .031, -.044, 0], rig);
      tube.rotation.x = Math.PI / 2;
    }
    for (const end of [-1, 1]) {
      block(.15, .037, .03, offWhite, [0, -.04, end * (length / 2 - .025)], rig);
      block(.017, .14, .02, metal, [0, .08, end * length * .34], rig);
    }
  }
  fixture(.7, 2.55);fixture(-2.9, 1.45);
  const outlet = new THREE.Group();outlet.position.set(-halfWidth + .012, .29, -.3);outlet.rotation.y = Math.PI / 2;root.add(outlet);
  block(.088, .14, .01, offWhite, [0, 0, 0], outlet);
  for (const y of [-.03, .03]) for (const x of [-.016, .016]) block(.004, .022, .002, seam, [x, y, .006], outlet);
  const contactCanvas = document.createElement('canvas');contactCanvas.width = contactCanvas.height = 128;
  const ctx = contactCanvas.getContext('2d'), data = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const d = Math.hypot(Math.max(0, Math.abs(x - 64) - 53), Math.max(0, Math.abs(y - 64) - 55));
    const i = (y * 128 + x) * 4;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = 20;
    data.data[i + 3] = Math.round(62 * Math.exp(-d * d / 25));
  }
  ctx.putImageData(data, 0, 0);
  const contactMaterial = new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(contactCanvas), transparent: true, opacity: .64, depthWrite: false, toneMapped: false});
  function addArtworkContact(parent, width, height, distanceToWall = .013) {
    const shadow = mesh(new THREE.PlaneGeometry(width + .16, height + .14), contactMaterial, [.012, -.016, -distanceToWall + .0015], parent);
    shadow.name = 'Soft artwork contact with plaster';shadow.raycast = () => {};
  }
  const details=addGallerySmallDetails(root,GALLERY_ARCHITECTURE);
  return {root, addArtworkContact, details};
}
