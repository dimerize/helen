/**
 * Original CRT computer for Helen Zhang's gallery.
 * Units are metres. +Z is the front; y=0 is the floor.
 * The caller owns disposal of the geometries, materials and their mapped textures.
 */
export function createComputer(THREE, RoundedBoxGeometry, screenTexture) {
  const group = new THREE.Group();
  group.name = 'Helen — ivory CRT study';

  const mat = (color, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const materials = {
    ivory: mat('#d8d3c2', 0.66),
    bezel: mat('#e3dfd0', 0.62),
    rear: mat('#c7c4b6', 0.72),
    inset: mat('#b8b7a9', 0.73),
    seam: mat('#696d65', 0.85),
    ventilation: mat('#535b54', 0.9),
    glassRim: mat('#272f2c', 0.44),
    key: mat('#e4e1d4', 0.63),
    modifier: mat('#b5beb4', 0.7),
    escape: mat('#bb9d6b', 0.66),
    desk: mat('#353a39', 0.6, 0.12),
    deskEdge: mat('#454a47', 0.58, 0.08),
    steel: mat('#3a4240', 0.47, 0.55),
    rubber: mat('#252c29', 0.96),
    brass: mat('#afa58d', 0.43, 0.58),
    cable: mat('#646d61', 0.8),
    led: new THREE.MeshStandardMaterial({
      color: '#a4bc78', emissive: '#accd73', emissiveIntensity: 0.45, roughness: 0.28,
    }),
  };
  const add = (geometry, material, x, y, z, name, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.name = name || '';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, x, y, z, material, radius = 0.004, name, parent) =>
    add(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)),
      material, x, y, z, name, parent);

  // A continuous rounded outline avoids the seams produced by four separate bars.
  function roundedPath(w, h, radius, centerY = 0, Path = THREE.Shape) {
    const p = new Path();
    const l = -w / 2, r = w / 2, b = centerY - h / 2, t = centerY + h / 2;
    p.moveTo(l + radius, b);
    p.lineTo(r - radius, b);
    p.quadraticCurveTo(r, b, r, b + radius);
    p.lineTo(r, t - radius);
    p.quadraticCurveTo(r, t, r - radius, t);
    p.lineTo(l + radius, t);
    p.quadraticCurveTo(l, t, l, t - radius);
    p.lineTo(l, b + radius);
    p.quadraticCurveTo(l, b, l + radius, b);
    return p;
  }
  function frame(w, h, iw, ih, radius, innerRadius, depth, bevel, material, y, z, name, openingY = 0) {
    const outline = roundedPath(w, h, radius);
    outline.holes.push(roundedPath(iw, ih, innerRadius, openingY, THREE.Path));
    const geom = new THREE.ExtrudeGeometry(outline, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 3, curveSegments: 10, steps: 1,
    });
    return add(geom, material, 0, y, z, name);
  }

  // The desk is deliberately narrow, with a softened graphite top and slim legs.
  box(1.05, 0.036, 0.60, 0, 0.772, 0.035, materials.desk, 0.012, 'Graphite desktop');
  box(1.032, 0.008, 0.584, 0, 0.751, 0.035, materials.deskEdge, 0.004, 'Fine lower desktop edge');
  for (const x of [-0.457, 0.457]) {
    for (const z of [-0.191, 0.261]) {
      box(0.031, 0.720, 0.031, x, 0.389, z, materials.steel, 0.006, 'Square steel desk leg');
      box(0.032, 0.028, 0.033, x, 0.016, z, materials.rubber, 0.006, 'Adjustable rubber foot');
    }
    box(0.024, 0.043, 0.474, x, 0.720, 0.035, materials.steel, 0.004, 'Side apron');
  }
  box(0.910, 0.051, 0.024, 0, 0.720, -0.189, materials.steel, 0.005, 'Rear desk apron');

  // Low horizontal system unit; the drive has a genuinely recessed layered face.
  for (const x of [-0.260, 0.260]) {
    for (const z of [-0.173, 0.067]) {
      box(0.041, 0.010, 0.038, x, 0.795, z, materials.rubber, 0.005, 'System unit rubber foot');
    }
  }
  box(0.676, 0.113, 0.347, 0, 0.8555, -0.0635, materials.ivory, 0.011, 'Horizontal system unit');
  box(0.648, 0.086, 0.009, 0, 0.850, 0.111, materials.bezel, 0.005, 'Inset front panel');
  box(0.635, 0.0015, 0.002, 0, 0.897, 0.111, materials.seam, 0.0005, 'Case lid seam');
  for (const x of [-0.3379, 0.3379]) {
    box(0.0009, 0.0015, 0.311, x, 0.897, -0.063, materials.seam, 0.0004, 'Case side lid seam');
  }
  box(0.182, 0.049, 0.007, 0.188, 0.851, 0.117, materials.inset, 0.002, 'Floppy drive surround');
  box(0.163, 0.032, 0.002, 0.188, 0.853, 0.121, materials.ivory, 0.001, 'Floppy drive face');
  box(0.139, 0.0053, 0.003, 0.183, 0.856, 0.123, materials.glassRim, 0.001, 'Recessed disk slot');
  box(0.104, 0.002, 0.001, 0.183, 0.853, 0.125, materials.seam, 0.0005, 'Disk slot lower lip');
  box(0.020, 0.0075, 0.005, 0.251, 0.837, 0.125, materials.ivory, 0.0014, 'Floppy eject button');
  box(0.004, 0.0022, 0.001, 0.114, 0.838, 0.125, materials.led, 0.0008, 'Drive activity light');
  box(0.034, 0.023, 0.008, -0.275, 0.851, 0.119, materials.inset, 0.005, 'System power recess');
  box(0.024, 0.017, 0.006, -0.275, 0.851, 0.125, materials.ivory, 0.004, 'System power switch');
  for (let n = 0; n < 12; n += 1) {
    box(0.0021, 0.022, 0.0018, -0.229 + n * 0.009, 0.850, 0.117, materials.ventilation, 0.0007, 'System intake grille');
  }
  box(0.004, 0.003, 0.002, -0.080, 0.850, 0.118, materials.led, 0.001, 'System status light');

  const foot = add(new THREE.CylinderGeometry(0.115, 0.121, 0.019, 48), materials.inset, 0, 0.923, -0.034, 'Elliptical swivel base');
  foot.scale.z = 0.69;
  box(0.090, 0.044, 0.075, 0, 0.947, -0.040, materials.ivory, 0.016, 'Monitor pedestal');

  // Softly rounded, deep taper: front shoulder, full middle, then smaller rear.
  const sections = [
    { z: 0.168, w: 0.610, h: 0.465, r: 0.042 },
    { z: 0.142, w: 0.630, h: 0.483, r: 0.047 },
    { z: -0.051, w: 0.630, h: 0.483, r: 0.047 },
    { z: -0.215, w: 0.470, h: 0.378, r: 0.049 },
    { z: -0.239, w: 0.426, h: 0.350, r: 0.046 },
  ];
  const perimeter = (s) => {
    const vertices = [];
    for (let corner = 0; corner < 4; corner += 1) {
      const angle = corner * Math.PI / 2;
      const cx = corner === 0 || corner === 3 ? s.w / 2 - s.r : -s.w / 2 + s.r;
      const cy = corner < 2 ? s.h / 2 - s.r : -s.h / 2 + s.r;
      for (let n = 0; n <= 8; n += 1) {
        const a = angle + n / 8 * Math.PI / 2;
        vertices.push([cx + Math.cos(a) * s.r, cy + Math.sin(a) * s.r, s.z]);
      }
    }
    return vertices;
  };
  const positions = [], indices = [];
  for (const s of sections) for (const p of perimeter(s)) positions.push(...p);
  const count = perimeter(sections[0]).length;
  for (let s = 0; s < sections.length - 1; s += 1) {
    for (let i = 0; i < count; i += 1) {
      const a = s * count + i, b = s * count + (i + 1) % count;
      const c = b + count, d = a + count;
      indices.push(a, c, b, a, d, c);
    }
  }
  const rearGeometry = new THREE.BufferGeometry();
  rearGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  rearGeometry.setIndex(indices);
  rearGeometry.computeVertexNormals();
  add(rearGeometry, materials.rear, 0, 1.205, 0, 'Tapered monitor rear shell');
  const rearCap = add(new THREE.ShapeGeometry(roundedPath(0.426, 0.350, 0.046), 12),
    materials.rear, 0, 1.205, -0.2391, 'Rounded rear panel');
  rearCap.rotation.y = Math.PI;

  // Recessed fine vents follow the taper instead of floating on an imaginary box.
  for (let n = 0; n < 14; n += 1) {
    const z = -0.060 - n * 0.0103;
    const taper = Math.max(0, Math.min(1, (-z - 0.051) / 0.164));
    const sideX = 0.315 - taper * 0.080;
    for (const sign of [-1, 1]) {
      const vent = box(0.0017, 0.143 - taper * 0.033, 0.0038,
        sign * (sideX + 0.0006), 1.205, z, materials.ventilation, 0.0007, 'Fine vertical side vent');
      vent.rotation.y = sign * 0.45;
    }
  }
  for (let n = 0; n < 10; n += 1) {
    const z = -0.079 - n * 0.0102;
    const taper = (-z - 0.051) / 0.164;
    const vent = box(0.310 - taper * 0.050, 0.0016, 0.0032, 0,
      1.205 + (0.483 - taper * 0.105) / 2 + 0.0009, z,
      materials.ventilation, 0.0006, 'Top heat ventilation');
    vent.rotation.x = -0.310;
  }
  box(0.121, 0.054, 0.0015, 0, 1.158, -0.2405, materials.inset, 0.003, 'Rear technical plate');

  // Raised ivory face, a bevelled charcoal aperture, and lightly convex CRT glass.
  frame(0.632, 0.488, 0.507, 0.379, 0.038, 0.023, 0.035, 0.007,
    materials.bezel, 1.205, 0.175, 'One-piece sculpted ivory bezel', 0.021);
  frame(0.516, 0.388, 0.479, 0.348, 0.025, 0.020, 0.009, 0.0027,
    materials.glassRim, 1.226, 0.196, 'Recessed graphite glass gasket');
  const screenGeometry = new THREE.PlaneGeometry(0.495, 0.364, 40, 32);
  const screenPositions = screenGeometry.attributes.position;
  for (let n = 0; n < screenPositions.count; n += 1) {
    const nx = screenPositions.getX(n) / 0.2475;
    const ny = screenPositions.getY(n) / 0.182;
    screenPositions.setZ(n, 0.0085 * (1 - nx * nx) * (1 - ny * ny));
  }
  screenGeometry.computeVertexNormals();
  const screenMaterial = new THREE.MeshPhysicalMaterial({
    map: screenTexture || null,
    color: screenTexture ? '#ffffff' : '#21342c',
    emissive: screenTexture ? '#ffffff' : '#17281c',
    emissiveMap: screenTexture || null,
    emissiveIntensity: 0.24,
    roughness: 0.30,
    metalness: 0,
    clearcoat: 0.62,
    clearcoatRoughness: 0.20,
  });
  const screen = add(screenGeometry, screenMaterial, 0, 1.226, 0.199, 'Interactive curved CRT glass');
  screen.castShadow = false;
  screen.receiveShadow = false;
  screen.userData.isComputerScreen = true;
  screen.userData.visibleSize = { width: 0.479, height: 0.348 };
  materials.screen = screenMaterial;

  box(0.041, 0.026, 0.003, 0.252, 1.002, 0.217, materials.inset, 0.006, 'Recessed monitor power surround');
  box(0.031, 0.019, 0.007, 0.252, 1.002, 0.221, materials.ivory, 0.004, 'Monitor power button');
  box(0.0045, 0.0027, 0.002, 0.212, 1.002, 0.220, materials.led, 0.001, 'Soft green monitor indicator');
  for (let n = 0; n < 3; n += 1) {
    box(0.010, 0.005, 0.003, 0.140 + n * 0.020, 1.001, 0.219, materials.inset, 0.002, 'Picture adjustment button');
  }

  // Canvas is used only for the tiny physical labels and key legends.
  const canDrawLabels = typeof document !== 'undefined' && typeof document.createElement === 'function';
  function textLabel(text, width, height, x, y, z, options = {}) {
    if (!canDrawLabels) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = options.color || '#454b41';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = options.font || '500 72px Georgia, serif';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const label = add(new THREE.PlaneGeometry(width, height), labelMaterial, x, y, z, `${text} engraved label`);
    label.castShadow = false;
    return label;
  }
  box(0.132, 0.022, 0.0016, -0.197, 1.001, 0.218, materials.brass, 0.001, 'Satin metal maker plate');
  textLabel('Helen Zhang', 0.118, 0.017, -0.197, 1.001, 0.2191);
  textLabel('PERSONAL COMPUTER', 0.114, 0.009, -0.162, 0.880, 0.117,
    { font: '500 51px Arial, sans-serif', color: '#727668' });

  const keyboard = new THREE.Group();
  keyboard.name = 'Detailed compact keyboard';
  keyboard.position.set(-0.060, 0.801, 0.228);
  keyboard.rotation.x = 0.055;
  group.add(keyboard);
  box(0.619, 0.032, 0.184, 0, 0.017, 0, materials.ivory, 0.008, 'Keyboard lower shell', keyboard);
  box(0.600, 0.003, 0.166, 0, 0.034, 0, materials.inset, 0.005, 'Keyboard key well', keyboard);

  const keyRows = [
    [['esc', 1, 'escape'], ['F1'], ['F2'], ['F3'], ['F4'], ['F5'], ['F6'], ['F7'], ['F8'], ['F9'], ['F10'], ['F11'], ['F12'], ['prt', 1], ['del', 1]],
    [['`'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ['-'], ['='], ['delete', 2, 'modifier']],
    [['tab', 1.5, 'modifier'], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'], ['['], [']'], ['\\', 1.5]],
    [['caps', 1.75, 'modifier'], ['A'], ['S'], ['D'], ['F'], ['G'], ['H'], ['J'], ['K'], ['L'], [';'], ["'"], ['return', 2.25, 'modifier']],
    [['shift', 2.25, 'modifier'], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [','], ['.'], ['/'], ['shift', 2.75, 'modifier']],
    [['ctrl', 1.5, 'modifier'], ['alt', 1.2, 'modifier'], ['cmd', 1.4, 'modifier'], ['', 6.5], ['cmd', 1.4, 'modifier'], ['alt', 1.2, 'modifier'], ['ctrl', 1.8, 'modifier']],
  ];
  const navKeys = ['ins', 'home', 'pgup', 'del', 'end', 'pgdn', '↑', '←', '↓', '→'];
  const legends = [...new Set(keyRows.flat().map((k) => k[0]).concat(navKeys))];
  let legendMaterial = null;
  const atlasColumns = 12, atlasRows = Math.ceil(legends.length / atlasColumns);
  if (canDrawLabels) {
    const canvas = document.createElement('canvas');
    canvas.width = atlasColumns * 64;
    canvas.height = atlasRows * 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#52594e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      legends.forEach((legend, i) => {
        ctx.font = legend.length > 3 ? '500 15px Arial, sans-serif' : legend.length > 1 ? '500 20px Arial, sans-serif' : '500 25px Arial, sans-serif';
        const x=(i % atlasColumns)*64+32, y=Math.floor(i / atlasColumns)*64+32;
        const angle={'↑':0,'→':Math.PI/2,'↓':Math.PI,'←':-Math.PI/2}[legend];
        if(angle!==undefined){
          ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle='#52594e';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(0,-9);ctx.moveTo(-6,-3);ctx.lineTo(0,-9);ctx.lineTo(6,-3);ctx.stroke();ctx.restore();
        }else ctx.fillText(legend,x,y);
      });
      const atlas = new THREE.CanvasTexture(canvas);
      atlas.colorSpace = THREE.SRGBColorSpace;
      legendMaterial = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, alphaTest: 0.05 });
    }
  }
  function key(text, units, x, z, type = 'key', functionRow = false) {
    const w = units * 0.0295 - 0.003;
    const d = functionRow ? 0.015 : 0.020;
    const keyTop = functionRow ? 0.047 : 0.049;
    box(w, 0.013, d, x, keyTop - 0.0065, z, materials[type], 0.0028, `${text || 'space'} key`, keyboard);
    if (legendMaterial && text) {
      const i = legends.indexOf(text);
      const geo = new THREE.PlaneGeometry(Math.min(w - 0.003, text.length > 3 ? 0.032 : 0.023), d * 0.85);
      const uv = geo.attributes.uv;
      for (let n = 0; n < uv.count; n += 1) {
        uv.setXY(n, (i % atlasColumns + uv.getX(n)) / atlasColumns,
          1 - (Math.floor(i / atlasColumns) + 1 - uv.getY(n)) / atlasRows);
      }
      const legend = add(geo, legendMaterial, x, keyTop + 0.0002, z, `${text} key legend`, keyboard);
      legend.rotation.x = -Math.PI / 2;
      legend.castShadow = false;
      legend.receiveShadow = false;
    }
  }
  keyRows.forEach((row, r) => {
    let cursor = -0.287;
    const z = r === 0 ? -0.073 : -0.042 + (r - 1) * 0.026;
    row.forEach(([text, units = 1, type = 'key']) => {
      key(text, units, cursor + units * 0.0295 / 2, z, type, r === 0);
      cursor += units * 0.0295;
    });
  });
  for (let r = 0; r < 2; r += 1) for (let c = 0; c < 3; c += 1) {
    key(navKeys[r * 3 + c], 0.93, 0.205 + c * 0.030, -0.042 + r * 0.026, 'modifier');
  }
  key('↑', 0.93, 0.235, 0.036, 'modifier');
  for (let c = 0; c < 3; c += 1) key(['←', '↓', '→'][c], 0.93, 0.205 + c * 0.030, 0.062, 'modifier');
  for (let n = 0; n < 3; n += 1) {
    box(0.003, 0.001, 0.003, 0.214 + n * 0.018, 0.036, -0.073,
      n === 0 ? materials.led : materials.seam, 0.001, 'Keyboard lock indicator', keyboard);
  }

  const mouse = new THREE.Group();
  mouse.position.set(0.389, 0.795, 0.234);
  mouse.rotation.y = -0.10;
  mouse.name = 'Wired two-button mouse';
  group.add(mouse);
  const mouseBase = add(new THREE.SphereGeometry(1, 32, 20), materials.inset, 0, 0.012, 0.001, 'Mouse lower shell', mouse);
  mouseBase.scale.set(0.043, 0.015, 0.063);
  const mouseTop = add(new THREE.SphereGeometry(1, 32, 20), materials.ivory, 0, 0.021, 0.002, 'Rounded mouse shell', mouse);
  mouseTop.scale.set(0.044, 0.023, 0.062);
  for (const sign of [-1, 1]) {
    const button = box(0.035, 0.009, 0.047, sign * 0.019, 0.035, -0.024,
      materials.bezel, 0.004, 'Mouse button', mouse);
    button.rotation.x = -0.18;
  }

  function cable(points, radius, name) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, 48, radius, 8, false), materials.cable, 0, 0, 0, name);
  }
  cable([
    [0.395, 0.808, 0.174], [0.407, 0.799, 0.136], [0.438, 0.794, 0.074],
    [0.441, 0.794, -0.045], [0.415, 0.794, -0.151], [0.303, 0.799, -0.237],
    [0.226, 0.829, -0.240],
  ], 0.0022, 'Relaxed mouse cable');
  cable([
    [-0.230, 0.818, 0.133], [-0.249, 0.801, 0.111], [-0.352, 0.794, 0.101],
    [-0.378, 0.794, 0.063], [-0.376, 0.794, -0.118], [-0.321, 0.798, -0.226],
    [-0.247, 0.832, -0.239],
  ], 0.0025, 'Relaxed keyboard cable');
  cable([
    [0.043, 1.110, -0.245], [0.045, 1.057, -0.256], [0.081, 0.982, -0.249],
    [0.139, 0.917, -0.246], [0.168, 0.852, -0.242],
  ], 0.0040, 'Monitor signal cable');

  group.userData.dimensions = { width: 1.05, height: 1.456, depth: 0.60 };
  group.userData.monitor = {
    width: 0.646, height: 0.502, depth: 0.456,
    screenCenter: { x: 0, y: 1.226, z: 0.2075 },
    visibleScreen: { width: 0.479, height: 0.348 },
  };
  return {
    group,
    screen,
    focus: {
      position: new THREE.Vector3(0, 1.248, 1.02),
      target: new THREE.Vector3(0, 1.226, 0.204),
    },
    materials,
    updateScreen(texture) {
      screenMaterial.map = texture;
      screenMaterial.emissiveMap = texture;
      screenMaterial.color.set('#ffffff');
      screenMaterial.emissive.set('#ffffff');
      screenMaterial.needsUpdate = true;
    },
  };
}
