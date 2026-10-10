import * as THREE from './vendor/three.module.min.js';

// A spatial interpretation of Helen's installation photograph. Room measurements
// are inferred, and the source images remain the source images: UV cropping only.
const ART_ROOT = '/artwork/';
const HALF_WIDTH = 1.85;
const BACK = -4.4;
const FRONT = 4.5;
const HEIGHT = 3.8;

/**
 * Build the exhibition architecture without owning the camera or animation loop.
 * Call update(elapsedSeconds) from the host loop. Artwork positions are the
 * centres of their visible faces; normals point from each wall into the room.
 */
export async function createGalleryRoom(scene, renderer) {
  const room = new THREE.Group();
  room.name = 'Helen Zhang — reconstructed gallery';
  scene.add(room);
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  const lights = [];
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let disposed = false;

  function texture(value) {
    textures.add(value);
    value.anisotropy = anisotropy;
    return value;
  }
  function material(value) {
    materials.add(value);
    return value;
  }
  function geometry(value) {
    geometries.add(value);
    return value;
  }
  function mesh(shape, surface, position, parent = room) {
    const value = new THREE.Mesh(geometry(shape), surface);
    if (position) value.position.fromArray(position);
    parent.add(value);
    return value;
  }
  function block(w, h, d, position, surface, parent = room) {
    return mesh(new THREE.BoxGeometry(w, h, d), surface, position, parent);
  }
  function seededRandom(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  // Only the architecture uses generated textures. Fine noise catches grazing
  // light; broad, low-contrast mottling keeps the walls from looking airbrushed.
  function roomTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(512, 512);
    const rand = seededRandom(kind === 'floor' ? 2894 : 1291);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4;
        const broad = Math.sin(x / 83 + Math.sin(y / 71)) * Math.cos(y / 57 + x / 193);
        const fine = (rand() - .5) * (kind === 'floor' ? 13 : 8);
        const tone = kind === 'floor' ? 179 + broad * 6 + fine : 233 + broad * 1.8 + fine;
        data.data[i] = tone + (kind === 'floor' ? 2 : 1);
        data.data[i + 1] = tone;
        data.data[i + 2] = tone - (kind === 'floor' ? 3 : 2);
        data.data[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    if (kind === 'floor') {
      ctx.lineCap = 'round';
      for (let i = 0; i < 35; i++) {
        const x = rand() * 512, y = rand() * 512;
        ctx.strokeStyle = `rgba(76,73,64,${.025 + rand() * .035})`;
        ctx.lineWidth = .5 + rand() * 1.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10 + rand() * 40, y + rand() * 7);
        ctx.stroke();
      }
    }
    const map = texture(new THREE.CanvasTexture(canvas));
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(kind === 'floor' ? 3 : 4, kind === 'floor' ? 7 : 2);
    return map;
  }

  const plaster = roomTexture('plaster');
  const concrete = roomTexture('floor');
  const wallMaterial = material(new THREE.MeshStandardMaterial({
    map: plaster, bumpMap: plaster, bumpScale: .014,
    roughness: .94, color: 0xf8f8f3, vertexColors: true,
  }));
  const ceilingMaterial = material(new THREE.MeshStandardMaterial({
    map: plaster, bumpMap: plaster, bumpScale: .008,
    color: 0xdcded9, roughness: .95,
  }));
  const floorMaterial = material(new THREE.MeshStandardMaterial({
    map: concrete, bumpMap: concrete, bumpScale: .009,
    color: 0xd8d9d3, roughness: .87, metalness: 0,
  }));
  const trimMaterial = material(new THREE.MeshStandardMaterial({
    color: 0x655d50, roughness: .83,
  }));
  const trimTopMaterial = material(new THREE.MeshStandardMaterial({
    color: 0x8b8477, roughness: .77,
  }));
  const warmWhite = material(new THREE.MeshStandardMaterial({color: 0xd7d8d1, roughness: .73}));
  const offWhite = material(new THREE.MeshStandardMaterial({color: 0xbcbeb8, roughness: .84}));
  const darkMetal = material(new THREE.MeshStandardMaterial({color: 0x474842, roughness: .5, metalness: .34}));
  const blackPanel = material(new THREE.MeshStandardMaterial({color: 0x070807, roughness: .93}));

  // Vertex shading adds the soft corner occlusion that a single inexpensive
  // direct-light pass cannot provide. It is deliberately very subtle.
  function wall(w, h, position, rotationY) {
    const plane = new THREE.PlaneGeometry(w, h, 32, 24);
    const colors = [];
    const vertices = plane.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i);
      const sideDistance = w / 2 - Math.abs(x);
      const floorDistance = y + h / 2;
      const ceilingDistance = h / 2 - y;
      const shade = 1 - .14 * Math.exp(-sideDistance * 6)
        - .15 * Math.exp(-floorDistance * 4.5)
        - .075 * Math.exp(-ceilingDistance * 5);
      colors.push(shade, shade, shade);
    }
    plane.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const value = mesh(plane, wallMaterial, position);
    value.rotation.y = rotationY;
    value.receiveShadow = true;
    return value;
  }
  wall(FRONT - BACK, HEIGHT, [-HALF_WIDTH, HEIGHT / 2, (FRONT + BACK) / 2], Math.PI / 2);
  wall(FRONT - BACK, HEIGHT, [HALF_WIDTH, HEIGHT / 2, (FRONT + BACK) / 2], -Math.PI / 2);
  wall(HALF_WIDTH * 2, HEIGHT, [0, HEIGHT / 2, BACK], 0);

  const floor = mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, FRONT - BACK), floorMaterial, [0, 0, (FRONT + BACK) / 2]);
  floor.name = 'Walkable gallery floor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const ceiling = mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, FRONT - BACK), ceilingMaterial, [0, HEIGHT, (FRONT + BACK) / 2]);
  ceiling.rotation.x = Math.PI / 2;

  // The brown-grey skirting, exposed ceiling beams and a wall outlet are small
  // architectural cues taken from the reference, not decorative gallery props.
  for (const side of [-1, 1]) {
    block(.037, .135, FRONT - BACK, [side * (HALF_WIDTH - .018), .0675, .05], trimMaterial);
    block(.047, .011, FRONT - BACK, [side * (HALF_WIDTH - .022), .14, .05], trimTopMaterial);
    block(.035, .018, FRONT - BACK, [side * (HALF_WIDTH - .016), HEIGHT - .025, .05], offWhite);
  }
  block(HALF_WIDTH * 2, .135, .037, [0, .0675, BACK + .018], trimMaterial);
  block(HALF_WIDTH * 2, .011, .047, [0, .14, BACK + .022], trimTopMaterial);
  for (const z of [-3.68, -.3, 3.25]) {
    const beam = block(HALF_WIDTH * 2, .15, .12, [0, HEIGHT - .075, z], warmWhite);
    beam.castShadow = true;
    block(HALF_WIDTH * 2, .018, .026, [0, HEIGHT - .153, z + .032], offWhite);
  }
  // A narrow seam rather than a grid of identical ceiling tiles.
  block(.017, .012, FRONT - BACK, [-1.24, HEIGHT - .008, .05], offWhite);
  block(.013, .012, FRONT - BACK, [.98, HEIGHT - .008, .05], offWhite);

  function outlet(x, y, z, normalX) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = normalX > 0 ? Math.PI / 2 : -Math.PI / 2;
    room.add(group);
    block(.084, .133, .012, [0, 0, 0], warmWhite, group);
    const recess = material(new THREE.MeshStandardMaterial({color: 0x999b94, roughness: .9}));
    for (const row of [-.029, .029]) {
      for (const col of [-.016, .016]) block(.005, .021, .002, [col, row, .007], recess, group);
      const pin = mesh(new THREE.CircleGeometry(.005, 8), recess, [0, row - .018, .008], group);
      pin.name = 'Outlet ground';
    }
    const screw = mesh(new THREE.CircleGeometry(.003, 8), darkMetal, [0, 0, .009], group);
    screw.name = 'Outlet faceplate screw';
  }
  outlet(-1.833, .42, -.16, 1);
  outlet(1.833, .42, 3.1, -1);

  const fluorescent = material(new THREE.MeshBasicMaterial({color: 0xfffdeb, toneMapped: false}));
  function fixture(z, length) {
    const rig = new THREE.Group();
    rig.position.set(-.28, HEIGHT - .21, z);
    room.add(rig);
    block(.17, .062, length, [0, 0, 0], warmWhite, rig);
    for (const side of [-1, 1]) {
      block(.019, .031, length, [side * .075, -.047, 0], offWhite, rig);
      const tube = mesh(new THREE.CylinderGeometry(.018, .018, length - .11, 12), fluorescent, [side * .031, -.043, 0], rig);
      tube.rotation.x = Math.PI / 2;
    }
    for (const end of [-1, 1]) {
      block(.15, .042, .04, [0, -.043, end * (length / 2 - .03)], warmWhite, rig);
      block(.017, .17, .024, [0, .09, end * length * .35], darkMetal, rig);
    }
  }
  fixture(1.35, 2.85);
  fixture(-2.5, 1.64);

  // Three unillustrated panels on each wall preserve the reference's quiet black
  // rhythm without inventing missing imagery or turning it into new artwork.
  for (const side of [-1, 1]) {
    const positions = side < 0 ? [-1.7, -2.32, -2.94] : [1.04, 1.66, 2.28];
    for (const z of positions) {
      const panel = block(.016, .47, .43, [side * (HALF_WIDTH - .013), 1.85, z], blackPanel);
      panel.name = 'Reference installation panel';
    }
  }

  function contactTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const dx = Math.max(0, Math.abs(x - 128) - 105);
        const dy = Math.max(0, Math.abs(y - 128) - 112);
        const d = Math.sqrt(dx * dx + dy * dy);
        const i = (y * 256 + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 24;
        image.data[i + 3] = Math.round(90 * Math.exp(-d * d / 120));
      }
    }
    ctx.putImageData(image, 0, 0);
    return texture(new THREE.CanvasTexture(canvas));
  }
  const contactMap = contactTexture();
  const contactMaterial = material(new THREE.MeshBasicMaterial({map: contactMap, transparent: true, opacity: .66, depthWrite: false, toneMapped: false}));

  const loader = new THREE.TextureLoader();
  const sourceFiles = ['thesis-elongated.webp', 'thesis-painting.webp', 'thesis-dark-grid.webp', ...Array.from({length: 4}, (_, i) => `interpretation-${i + 1}.webp`)];
  let sourceTextures;
  try {
    sourceTextures = await Promise.all(sourceFiles.map(async file => {
      const value = texture(await loader.loadAsync(ART_ROOT + file));
      value.colorSpace = THREE.SRGBColorSpace;
      return value;
    }));
  } catch (error) {
    dispose();
    throw error;
  }
  const [elongatedMap, gapsMap, bentMap, ...interpretations] = sourceTextures;
  // Exclude photographed wall and black presentation margins. These are texture
  // transforms only: no altered or generated replacement images are created.
  elongatedMap.offset.set(.405, 0);
  elongatedMap.repeat.set(.192, 1);
  gapsMap.offset.set(.181, .098);
  gapsMap.repeat.set(.643, .808);

  const canvasEdge = material(new THREE.MeshStandardMaterial({color: 0xaaa89a, roughness: .94, map: plaster}));
  const darkEdge = material(new THREE.MeshStandardMaterial({color: 0x242823, roughness: .92}));
  const artworks = [];
  function artwork({id, title, image, map, width, height, position, normal, description, edge}) {
    const rig = new THREE.Group();
    rig.position.fromArray(position);
    rig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normal));
    room.add(rig);
    const shadow = mesh(new THREE.PlaneGeometry(width + .19, height + .18), contactMaterial, [.018, -.018, -.047], rig);
    shadow.name = `${title} — wall contact shadow`;
    shadow.renderOrder = 1;
    const support = block(width, height, .042, [0, 0, -.024], edge || canvasEdge, rig);
    support.castShadow = true;
    support.receiveShadow = true;
    const surface = material(new THREE.MeshStandardMaterial({map, roughness: .96, metalness: 0, color: 0xf8f8f6}));
    const face = mesh(new THREE.PlaneGeometry(width, height), surface, [0, 0, 0], rig);
    face.userData.artworkId = id;
    face.name = title;
    face.receiveShadow = false;
    artworks.push({id, mesh: face, title, image: ART_ROOT + image, position: [...position], normal: [...normal], description});
    return rig;
  }
  artwork({
    id: 'elongated', title: 'Elongated', image: 'thesis-elongated.webp', map: elongatedMap,
    width: 1.35, height: 3.35, position: [-1.80, 1.95, 1.0], normal: [1, 0, 0],
    description: 'A stretched image becomes a tall physical presence. This spatial reconstruction uses the supplied Elongated image.',
  });
  const gapsRig = artwork({
    id: 'gaps', title: 'Gaps in Netted Mesh', image: 'thesis-painting.webp', map: gapsMap,
    width: 1.4, height: 2.05, position: [0, 1.95, -4.34], normal: [0, 0, 1],
    description: 'Acrylic on homasote. The gaps invite readings of figures and objects; the light layer reinterprets four supplied viewer drawings.',
  });
  artwork({
    id: 'bent', title: 'Bent Mesh', image: 'thesis-dark-grid.webp', map: bentMap,
    width: 1.55, height: 2.45, position: [1.79, 1.95, -1.3], normal: [-1, 0, 0], edge: darkEdge,
    description: 'The netted image folds and distorts. This spatial reconstruction uses the supplied Bent Mesh image.',
  });

  // A shader extracts only broad dark gestures from the supplied drawings and
  // renders them as light. The thin underlying net largely drops away, leaving
  // the real painting visible. This is a digital reinterpretation, not footage
  // of the original projection performance. No source image is repainted.
  const projectionUniforms = {
    drawingA: {value: interpretations[0]}, drawingB: {value: interpretations[0]},
    blend: {value: 1}, strength: {value: .9},
  };
  const projectionMaterial = material(new THREE.ShaderMaterial({
    uniforms: projectionUniforms,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D drawingA;
      uniform sampler2D drawingB;
      uniform float blend;
      uniform float strength;
      varying vec2 vUv;
      float drawingLuminance(vec3 color) { return dot(color, vec3(.2126, .7152, .0722)); }
      float gesture(sampler2D drawing, vec2 uv) {
        vec2 sampleUv = vec2(.057 + uv.x * .886, .012 + uv.y * .982);
        // A small morphological erosion favours the thick drawn gestures over
        // the painting's much finer mesh. The original photographed marks are
        // always sampled directly; there is no invented contour geometry.
        vec2 stepUv = vec2(.0032, .0021);
        float lightest = drawingLuminance(texture2D(drawing, sampleUv).rgb);
        lightest = max(lightest, drawingLuminance(texture2D(drawing, sampleUv + vec2(stepUv.x, 0.)).rgb));
        lightest = max(lightest, drawingLuminance(texture2D(drawing, sampleUv - vec2(stepUv.x, 0.)).rgb));
        lightest = max(lightest, drawingLuminance(texture2D(drawing, sampleUv + vec2(0., stepUv.y)).rgb));
        lightest = max(lightest, drawingLuminance(texture2D(drawing, sampleUv - vec2(0., stepUv.y)).rgb));
        float mask = 1. - smoothstep(.20, .58, lightest);
        float border = smoothstep(0., .022, uv.x) * smoothstep(0., .022, 1. - uv.x)
          * smoothstep(0., .025, uv.y) * smoothstep(0., .025, 1. - uv.y);
        return mask * border;
      }
      void main() {
        float light = mix(gesture(drawingA, vUv), gesture(drawingB, vUv), blend);
        gl_FragColor = vec4(vec3(1.0, .98, .89) * 1.25, light * strength);
        #include <colorspace_fragment>
      }`,
  }));
  const projection = mesh(new THREE.PlaneGeometry(1.394, 2.044), projectionMaterial, [0, 0, .004], gapsRig);
  projection.name = 'Viewer drawings — digital light reinterpretation';
  projection.renderOrder = 3;
  projection.raycast = () => {};

  // Modest lighting values leave detail in both the pale painting and the black
  // mesh. One shadow map provides depth; all other lights stay inexpensive.
  function light(value) { room.add(value); lights.push(value); return value; }
  light(new THREE.HemisphereLight(0xf8faf5, 0x777164, 1.65));
  const entranceLight = light(new THREE.DirectionalLight(0xe6ecf3, 1.3));
  entranceLight.position.set(.5, 4.0, 5.5);
  entranceLight.target.position.set(0, 1.2, -2.5);
  room.add(entranceLight.target);
  const ceilingFill = light(new THREE.PointLight(0xfff8e7, 9, 11, 2));
  ceilingFill.position.set(-.25, 3.51, .4);
  function spot(position, target, intensity, angle, castsShadow = false) {
    const value = light(new THREE.SpotLight(0xfffaed, intensity, 9, angle, 1, 2));
    value.position.fromArray(position);
    value.target.position.fromArray(target);
    room.add(value.target);
    value.castShadow = castsShadow;
    if (castsShadow) {
      value.shadow.mapSize.set(1024, 1024);
      value.shadow.camera.near = .1;
      value.shadow.camera.far = 9;
      value.shadow.bias = -.0002;
      value.shadow.normalBias = .018;
      value.shadow.radius = 3;
    }
    return value;
  }
  spot([0, 3.47, -2.5], [0, 1.8, -4.34], 15, .65, true);
  spot([-.4, 3.46, 1.5], [-1.8, 1.65, 1], 13, .82);
  spot([.2, 3.46, -.6], [1.79, 1.8, -1.3], 11, .8);

  let activeIndex = 0;
  let transition = 1;
  let projectionEnabled = true;
  let projectionStrength = .9;
  let previousTime = null;

  function setProjection(index = activeIndex, enabled = true) {
    const nextIndex = Number.isFinite(Number(index))
      ? ((Math.trunc(Number(index)) % interpretations.length) + interpretations.length) % interpretations.length
      : activeIndex;
    if (nextIndex !== activeIndex) {
      projectionUniforms.drawingA.value = interpretations[activeIndex];
      projectionUniforms.drawingB.value = interpretations[nextIndex];
      activeIndex = nextIndex;
      transition = reducedMotion ? 1 : 0;
      projectionUniforms.blend.value = transition;
    }
    projectionEnabled = Boolean(enabled);
    if (reducedMotion) {
      projectionStrength = projectionEnabled ? .9 : 0;
      projectionUniforms.strength.value = projectionStrength;
      projection.visible = projectionEnabled;
    } else if (projectionEnabled) projection.visible = true;
  }

  function update(time) {
    if (disposed) return;
    const dt = previousTime === null ? 1 / 60 : Math.min(.1, Math.max(0, time - previousTime));
    previousTime = time;
    if (transition < 1) {
      transition = Math.min(1, transition + dt / .65);
      projectionUniforms.blend.value = transition * transition * (3 - 2 * transition);
    }
    const target = projectionEnabled ? .9 : 0;
    projectionStrength += (target - projectionStrength) * (1 - Math.exp(-dt * 6));
    projectionUniforms.strength.value = projectionStrength;
    projection.visible = projectionStrength > .002;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(room);
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    lights.forEach(value => value.shadow?.map?.dispose());
    room.clear();
  }

  return {artworks, floor, setProjection, update, dispose};
}
