/**
 * One unchanged original scanner, with three separate microscopic landscapes.
 * Hardware is the production mesh from original-scanner.js, uniformly enlarged.
 * Relief is an additive interpretation of source pixels, never a replacement device.
 * World coordinates are x east, z south, y up; source UVs have a top-left origin.
 */
import { createOriginalScanner } from './original-scanner.js';

export async function createScannerWorld(THREE, renderer) {
  const SCALE = 24 / 9.45, W = 24, D = 6.24 * SCALE;
  const sheetY = .045 * SCALE, reliefBaseY = sheetY + .006;
  // At progress=1 the unchanged bar and its lens occupy the north margin.
  // That protected strip remains nearly flat; the walking boundary clears it.
  const parkedBarEnd = -D / 2 + .67 * SCALE + .04;
  const bounds = { minX: -W / 2 + .6, maxX: W / 2 - .6, minZ: parkedBarEnd + .30, maxZ: D / 2 - .6 };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080809');
  scene.fog = new THREE.FogExp2('#0a1113', 0);
  const root = new THREE.Group(); root.name = 'Original Helen Zhang scanner and microscopic print'; scene.add(root);
  const disposal = new Set(), states = [], colliders = [], landmarks = [];
  let activeState, macro = 0, scanProgress = .42, disposed = false, macroConfigured = false;
  let reliefScale = 1, motionPaused = false, ambientTime = 0, randomSeed = 91381;
  const random = () => { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const descriptions = [
    { id: 'exit', title: 'Found on the train', image: 'train-scan.jpg', geometry: 'scan-geometry.json', alt: 'Red exit and caution lettering, distorted by a handheld scan' },
    { id: 'wide', title: 'A surface, passing through', image: 'train-scan-wide.jpg', geometry: 'scan-geometry-wide.json', alt: 'Worn yellow train lettering stretched across a scan' },
    { id: 'notice', title: 'Signs of use', image: 'train-scan-notice.jpg', geometry: 'scan-geometry-notice.json', alt: 'A train notice recorded in a handheld scan' }
  ];
  const loader = new THREE.TextureLoader();
  const loaded = await Promise.all(descriptions.map(async description => {
    const [texture, data] = await Promise.all([
      loader.loadAsync(new URL(`./assets/${description.image}`, import.meta.url).href),
      fetch(new URL(`./assets/${description.geometry}`, import.meta.url).href).then(response => {
        if (!response.ok) throw new Error(`The scan geometry could not be loaded (${response.status}).`);
        return response.json();
      })
    ]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    disposal.add(texture);
    return { texture, data };
  }));
  const originalScanner = await createOriginalScanner(THREE, loaded.map(item => item.texture), renderer);
  const hardwareScale = new THREE.Group(); hardwareScale.name = 'Uniform unit conversion for the original scanner'; hardwareScale.scale.setScalar(SCALE);
  hardwareScale.add(originalScanner.root); root.add(hardwareScale);
  const originalLightRig = new THREE.Group(); originalLightRig.name = 'Original studio lighting'; originalLightRig.scale.setScalar(SCALE); scene.add(originalLightRig);
  const originalLights = originalScanner.createLighting();
  for (const light of originalLights) {
    light.userData.homeIntensity = light.intensity;
    originalLightRig.add(light);
    if (light.target) originalLightRig.add(light.target);
  }

  function sourceUV(x, z, state = activeState) {
    return originalScanner.platenToImageUV(x / W + .5, z / D + .5, state.index);
  }
  function sourceToWorld(u, v, index = activeState.index) {
    const [pu, pv] = originalScanner.imageToPlatenUV(u, v, index);
    return { x: (pu - .5) * W, z: (pv - .5) * D };
  }
  function terrainHeightAt(x, z, state = activeState) {
    const grid = state.data.grid, [su, sv] = sourceUV(x, z, state);
    const u = clamp(su, 0, 1) * (grid.width - 1), v = clamp(sv, 0, 1) * (grid.height - 1);
    const x0 = Math.floor(u), z0 = Math.floor(v), x1 = Math.min(x0 + 1, grid.width - 1), z1 = Math.min(z0 + 1, grid.height - 1);
    const top = lerp(grid.values[z0 * grid.width + x0], grid.values[z0 * grid.width + x1], u - x0);
    const bottom = lerp(grid.values[z1 * grid.width + x0], grid.values[z1 * grid.width + x1], u - x0);
    return sheetY + .003 + lerp(top, bottom, v - z0) * .06;
  }
  function insidePolygon(x, z, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function inSurface(x, z, item) {
    return insidePolygon(x, z, item.polygon) && !item.holes.some(h => insidePolygon(x, z, h));
  }
  function reliefFactorAt(z) { return .025 + .975 * clamp((z - parkedBarEnd) / .6, 0, 1); }
  function surfaceHeightAt(surface, z) { return reliefBaseY + surface.reliefHeight * reliefScale * reliefFactorAt(z); }
  function heightAt(x, z) {
    let height = terrainHeightAt(x, z);
    for (const item of activeState.surfaces) {
      if (x < item.bounds.minX || x > item.bounds.maxX || z < item.bounds.minZ || z > item.bounds.maxZ) continue;
      if (inSurface(x, z, item)) height = Math.max(height, surfaceHeightAt(item, z));
    }
    return height;
  }
  function isBlocked(x, z, radius = .12) {
    for (const item of activeState.surfaces) {
      if (item.maxY - item.minY <= .36) continue;
      if (x < item.bounds.minX - radius || x > item.bounds.maxX + radius || z < item.bounds.minZ - radius || z > item.bounds.maxZ + radius) continue;
      for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) if (inSurface(x + dx, z + dz, item)) return true;
    }
    return false;
  }
  function mesh(geometry, material, parent = root) {
    const item = new THREE.Mesh(geometry, material); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  }
  function box(w, h, d, material, x, y, z, parent = root) {
    const item = mesh(new THREE.BoxGeometry(w, h, d), material, parent); item.position.set(x, y, z); return item;
  }
  const paperEdge = new THREE.MeshStandardMaterial({ color: '#adac93', roughness: .94 });
  function groundAnchor(x, z, offset = 0) {
    let surface = null;
    for (const item of activeState.surfaces) {
      if (x < item.bounds.minX || x > item.bounds.maxX || z < item.bounds.minZ || z > item.bounds.maxZ) continue;
      if ((!surface || item.reliefHeight > surface.reliefHeight) && inSurface(x, z, item)) surface = item;
    }
    return { surface, terrain: terrainHeightAt(x, z), offset, z };
  }
  function anchorHeight(anchor) { return (anchor.surface ? surfaceHeightAt(anchor.surface, anchor.z) : anchor.terrain) + anchor.offset; }

  // Clip individual triangulated faces instead of simplifying clipped concave outlines.
  // This preserves disconnected pieces and counterforms when the original cover crop
  // slices through a letter, including holes that open onto the platen boundary.
  function clipFace(points) {
    let out = points;
    for (const [axis, boundary, keepGreater] of [[0, -W / 2, true], [0, W / 2, false], [1, -D / 2, true], [1, D / 2, false]]) {
      const input = out; out = [];
      if (!input.length) break;
      const inside = p => keepGreater ? p[axis] >= boundary : p[axis] <= boundary;
      for (let i = 0; i < input.length; i++) {
        const a = input[i], b = input[(i + 1) % input.length], ai = inside(a), bi = inside(b);
        if (ai) out.push(a);
        if (ai !== bi) {
          const t = (boundary - a[axis]) / (b[axis] - a[axis]);
          out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
        }
      }
    }
    return out;
  }
  function clipSegment(a, b) {
    let from = 0, to = 1;
    for (const [axis, minimum, maximum] of [[0, -W / 2, W / 2], [1, -D / 2, D / 2]]) {
      const d = b[axis] - a[axis];
      if (Math.abs(d) < 1e-10) { if (a[axis] < minimum || a[axis] > maximum) return null; continue; }
      let near = (minimum - a[axis]) / d, far = (maximum - a[axis]) / d;
      if (near > far) [near, far] = [far, near];
      from = Math.max(from, near); to = Math.min(to, far);
      if (from >= to) return null;
    }
    return [[lerp(a[0], b[0], from), lerp(a[1], b[1], from)], [lerp(a[0], b[0], to), lerp(a[1], b[1], to)]];
  }
  function splitAtZ(points, boundary) {
    const sides = [[], []];
    for (let side = 0; side < 2; side++) for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const ai = side ? a[1] >= boundary : a[1] <= boundary, bi = side ? b[1] >= boundary : b[1] <= boundary;
      if (ai) sides[side].push(a);
      if (ai !== bi) { const t = (boundary - a[1]) / (b[1] - a[1]); sides[side].push([lerp(a[0], b[0], t), boundary]); }
    }
    return sides.filter(side => side.length >= 3);
  }
  function contourGeometry(polygon, holes, height, index) {
    const positions = [], uvs = [], rings = [polygon, ...holes];
    const addVertex = (p, y) => {
      positions.push(p[0], y * reliefFactorAt(p[1]), p[1]);
      const [u, v] = originalScanner.platenToImageUV(p[0] / W + .5, p[1] / D + .5, index); uvs.push(u, 1 - v);
    };
    const addTriangle = (a, b, c, y, upward) => {
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) < 1e-10) return;
      if ((cross > 0) === upward) [b, c] = [c, b];
      addVertex(a, y); addVertex(b, y); addVertex(c, y);
    };
    const all = rings.flat(), vectors = rings.map(r => r.map(p => new THREE.Vector2(...p)));
    const faces = THREE.ShapeUtils.triangulateShape(vectors[0], vectors.slice(1));
    for (const face of faces) {
      let pieces = [clipFace(face.map(i => all[i]))];
      for (const boundary of [parkedBarEnd, parkedBarEnd + .6]) pieces = pieces.flatMap(piece => splitAtZ(piece, boundary));
      for (const clipped of pieces) for (let i = 1; i + 1 < clipped.length; i++) {
        addTriangle(clipped[0], clipped[i], clipped[i + 1], height, true);
        addTriangle(clipped[0], clipped[i], clipped[i + 1], 0, false);
      }
    }
    const capCount = positions.length / 3;
    const solid = (x, z) => x >= -W / 2 && x <= W / 2 && z >= -D / 2 && z <= D / 2 && insidePolygon(x, z, polygon) && !holes.some(h => insidePolygon(x, z, h));
    function addWall(a, b) {
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-7) return;
      // Mesh side material is DoubleSide, but consistent winding produces the
      // correct illumination at outer boundaries and around internal holes.
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (!solid((a[0] + b[0]) * .5 - dz / len * .0001, (a[1] + b[1]) * .5 + dx / len * .0001)) [a, b] = [b, a];
      const points = [a, b];
      for (const boundary of [parkedBarEnd, parkedBarEnd + .6]) if ((a[1] < boundary && b[1] > boundary) || (a[1] > boundary && b[1] < boundary)) {
        const t = (boundary - a[1]) / (b[1] - a[1]); points.push([lerp(a[0], b[0], t), boundary]);
      }
      points.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]));
      for (let i = 0; i + 1 < points.length; i++) {
        const p = points[i], q = points[i + 1];
        addVertex(p, 0); addVertex(q, height); addVertex(q, 0);
        addVertex(p, 0); addVertex(p, height); addVertex(q, height);
      }
    }
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const clipped = clipSegment(ring[i], ring[(i + 1) % ring.length]);
      if (clipped) addWall(...clipped);
    }
    // Close the newly exposed section where a contour meets the cover crop.
    for (const [axis, edge, min, max, inward] of [[0, -W / 2, -D / 2, D / 2, 1], [0, W / 2, -D / 2, D / 2, -1], [1, -D / 2, -W / 2, W / 2, 1], [1, D / 2, -W / 2, W / 2, -1]]) {
      const other = 1 - axis, cuts = [min, max];
      for (const ring of rings) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a[axis] < edge && b[axis] > edge) || (a[axis] > edge && b[axis] < edge)) {
          const q = lerp(a[other], b[other], (edge - a[axis]) / (b[axis] - a[axis]));
          if (q > min && q < max) cuts.push(q);
        }
      }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const mid = (cuts[i] + cuts[i + 1]) * .5;
        const p = axis === 0 ? [edge + inward * .00001, mid] : [mid, edge + inward * .00001];
        if (!solid(...p)) continue;
        addWall(axis === 0 ? [edge, cuts[i]] : [cuts[i], edge], axis === 0 ? [edge, cuts[i + 1]] : [cuts[i + 1], edge]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.addGroup(0, capCount, 0); geometry.addGroup(capCount, positions.length / 3 - capCount, 1);
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return geometry;
  }

  function buildArtwork(index) {
    const { texture, data } = loaded[index], description = descriptions[index];
    const state = { index, texture, data, surfaces: [], group: new THREE.Group(), relief: new THREE.Group(), materials: [] };
    activeState = state; root.add(state.group); state.group.name = `Microscopic ${description.title}`;
    state.relief.name = `Contours for ${description.id}`; state.group.add(state.relief);
    const grid = data.grid, scanTexture = texture;
    const terrainGeometry = new THREE.PlaneGeometry(W, D, grid.width - 1, grid.height - 1); terrainGeometry.rotateX(-Math.PI / 2);
    const vertices = terrainGeometry.attributes.position, terrainUV = terrainGeometry.attributes.uv;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i), [u, v] = sourceUV(x, z, state);
      vertices.setY(i, terrainHeightAt(x, z, state)); terrainUV.setXY(i, u, 1 - v);
    }
    terrainGeometry.computeVertexNormals();
    const scanMaterial = new THREE.MeshStandardMaterial({ map: scanTexture, roughness: .91, metalness: .05, bumpMap: scanTexture, bumpScale: .033, transparent: true, opacity: 0 });
    state.scanMesh = mesh(terrainGeometry, scanMaterial, state.group); state.scanMesh.name = `Original center-cover source pixels — ${description.id}`; state.scanMesh.castShadow = false;
    const capMaterial = new THREE.MeshStandardMaterial({ map: scanTexture, roughness: .83, metalness: .04, bumpMap: scanTexture, bumpScale: .022, transparent: true, opacity: 0 });
    const palette = data.metadata?.sidePalette || { red: '#ad2414', ink: '#303a35', paper: '#aaa991' };
    const sideMaterials = Object.fromEntries(Object.entries(palette).map(([kind, color]) => [kind, new THREE.MeshStandardMaterial({ color, roughness: kind === 'paper' ? .96 : .84, metalness: .015, side: THREE.DoubleSide, transparent: true, opacity: 0 })]));
    state.materials = [scanMaterial, capMaterial, ...Object.values(sideMaterials)];
  // Caps still sample the unmodified source image. Side faces instead sample
  // their actual local position: projected cap UVs contain no vertical detail.
  // The faint ridges describe compressed, imperfect pigment strata, not clean
  // manufactured stripes. A shared uniform keeps them invisible at photo scale.
  const materialMacro = { value: 0 };
  const pigmentShader = `
    uniform float printMacro;
    varying vec3 vPrintPosition;
    float printHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float printNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(printHash(i), printHash(i + vec2(1.0, 0.0)), u.x),
                 mix(printHash(i + vec2(0.0, 1.0)), printHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    vec2 printSurfaceCoordinate(vec3 p) {
      return vec2(dot(p.xz, vec2(0.713, 0.587)), p.y);
    }
    float printLayerPhase(vec2 q) {
      float warp = printNoise(q * vec2(8.5, 5.0));
      return q.y * 318.0 + warp * 2.3 + sin(q.x * 15.0) * 0.24;
    }
    float printSurfaceHeight(vec2 q) {
      float layer = sin(printLayerPhase(q));
      float brokenLayer = layer * (0.38 + 0.62 * printNoise(q * vec2(42.0, 17.0)));
      float fleck = printNoise(q * vec2(113.0, 189.0)) - 0.5;
      return printMacro * (brokenLayer * 0.0011 + fleck * 0.00085);
    }
    vec3 printSurfaceNormal(vec3 surfacePosition, vec3 surfaceNormal, float height) {
      vec3 dx = dFdx(surfacePosition), dy = dFdy(surfacePosition);
      vec3 r1 = cross(dy, surfaceNormal), r2 = cross(surfaceNormal, dx);
      float determinant = dot(dx, r1);
      vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
      return normalize(abs(determinant) * surfaceNormal - gradient);
    }
  `;
  for (const material of Object.values(sideMaterials)) {
    material.onBeforeCompile = shader => {
      shader.uniforms.printMacro = materialMacro;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPrintPosition;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrintPosition = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${pigmentShader}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 pigmentQ = printSurfaceCoordinate(vPrintPosition);
          float pigmentMottle = printNoise(pigmentQ * vec2(7.0, 11.0));
          float pigmentGrain = printNoise(pigmentQ * vec2(109.0, 171.0));
          float pigmentSeam = pow(0.5 + 0.5 * sin(printLayerPhase(pigmentQ)), 18.0);
          float pigmentTone = 0.88 + pigmentMottle * 0.23 + pigmentGrain * 0.065 - pigmentSeam * 0.064;
          diffuseColor.rgb *= mix(1.0, pigmentTone, printMacro);
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = printSurfaceNormal(-vViewPosition, normal, printSurfaceHeight(printSurfaceCoordinate(vPrintPosition)));
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + (pigmentGrain - 0.5) * 0.08 * printMacro, 0.5, 1.0);
        `);
    };
    material.customProgramCacheKey = () => 'source-pigment-strata-v1';
  }

    state.materialMacro = materialMacro;
    for (const [regionIndex, region] of data.regions.entries()) {
      if (!region.polygon || region.polygon.length < 3) continue;
      const sourcePoints = region.polygon;
      const centerV = sourcePoints.reduce((n, p) => n + p[1], 0) / sourcePoints.length;
      const centerU = sourcePoints.reduce((n, p) => n + p[0], 0) / sourcePoints.length;
      const isExit = region.kind === 'red' && centerV < .36;
      const height = region.reliefHeight ?? (region.kind === 'ink' ? .70 + ((regionIndex * 7) % 5) * .045 : isExit ? .62 + ((regionIndex * 3) % 4) * .075 : region.kind === 'paper' ? .075 : .16 + (regionIndex % 3) * .03);
      const transform = ring => ring.map(([u, v]) => { const { x, z } = sourceToWorld(u, v, index); return [x, z]; });
      const polygon = transform(sourcePoints), holes = (region.holes || []).map(transform);
      const surfaceBounds = {
        minX: Math.max(-W / 2, Math.min(...polygon.map(p => p[0]))), maxX: Math.min(W / 2, Math.max(...polygon.map(p => p[0]))),
        minZ: Math.max(-D / 2, Math.min(...polygon.map(p => p[1]))), maxZ: Math.min(D / 2, Math.max(...polygon.map(p => p[1])))
      };
      if (surfaceBounds.maxX <= surfaceBounds.minX || surfaceBounds.maxZ <= surfaceBounds.minZ) continue;
      const geometry = contourGeometry(polygon, holes, height, index);
      if (!geometry.attributes.position.count) { geometry.dispose(); continue; }
      const regionMesh = mesh(geometry, [capMaterial, sideMaterials[region.kind] || sideMaterials.paper], state.relief);
      regionMesh.name = `${description.id} ${region.kind} contour ${regionIndex + 1}`; regionMesh.position.y = reliefBaseY;
      regionMesh.userData = { sourceRegion: regionIndex, u: centerU, v: centerV, height, coverCrop: true };
      state.surfaces.push({ polygon, holes, mesh: regionMesh, reliefHeight: height, minY: reliefBaseY, maxY: reliefBaseY + height, bounds: surfaceBounds });
    }
    const macroDetails = new THREE.Group(); macroDetails.name = `Microscopic fibers — ${description.id}`; state.group.add(macroDetails);
    state.details = buildDetails(macroDetails);
    let stations = data.metadata?.landmarks;
    if (!stations?.length) stations = [
      { id: 'exit', title: 'The exit', subtitle: 'Red pigment / raised lettering', uv: [.307, .31], viewYaw: -1.19 },
      { id: 'caution', title: 'Ink canyon', subtitle: 'The counterform of a warning', uv: [.513, .56], viewYaw: .12 },
      { id: 'seam', title: 'The red seam', subtitle: 'A torn edge in the original scan', uv: [.192, .678], viewYaw: -.9 },
      { id: 'edge', title: "Paper’s edge", subtitle: 'Where the image meets the glass', uv: [.054, .805], viewYaw: -1.55 }
    ];
    const crop = {
      minimum: originalScanner.platenToImageUV(0, 0, index), maximum: originalScanner.platenToImageUV(1, 1, index)
    };
    state.public = {
      ...description, index, width: W, depth: D, sourceWidth: data.width, sourceHeight: data.height, crop,
      landmarks: stations.map(station => ({ ...station, position: sourceToWorld(...station.uv, index) })),
      spawn: { ...sourceToWorld(...(data.metadata?.spawn?.uv || [.62, .77]), index), yaw: data.metadata?.spawn?.yaw || 0 },
      sourceToWorld: (u, v) => sourceToWorld(u, v, index),
      worldToSource: (x, z) => sourceUV(x, z, state)
    };
    state.public.landmarks.forEach(station => { station.position.x = clamp(station.position.x, bounds.minX, bounds.maxX); station.position.z = clamp(station.position.z, bounds.minZ, bounds.maxZ); });
    state.public.spawn.x = clamp(state.public.spawn.x, bounds.minX, bounds.maxX); state.public.spawn.z = clamp(state.public.spawn.z, bounds.minZ, bounds.maxZ);
    state.group.visible = false;
    return state;
  }

  function buildDetails(macroDetails) {
  // Shallow fibers sit on the sheet, unlike the motes floating in the light.
  const fiberPositions = [], darkFiberPositions = [];
  for (let i = 0; i < 780; i++) {
    const x = (random() - 0.5) * (W - .2), z = (random() - 0.5) * (D - .2);
    if (isBlocked(x, z, 0.015)) continue;
    const y = heightAt(x, z) + 0.012, angle = random() * Math.PI * 2;
    const length = 0.012 + random() ** 2 * 0.14;
    const endX = x + Math.cos(angle + 0.19) * length, endZ = z + Math.sin(angle + 0.19) * length;
    if (Math.abs(heightAt(endX, endZ) - heightAt(x, z)) > 0.025) continue;
    const destination = i % 5 ? fiberPositions : darkFiberPositions;
    destination.push(x, y, z, x + Math.cos(angle) * length * 0.52, y + length * 0.085, z + Math.sin(angle) * length * 0.52);
    destination.push(x + Math.cos(angle) * length * 0.52, y + length * 0.085, z + Math.sin(angle) * length * 0.52, x + Math.cos(angle + 0.19) * length, y, z + Math.sin(angle + 0.19) * length);
  }
  for (const [positions, color, opacity] of [[fiberPositions, '#e9e6c4', 0.47], [darkFiberPositions, '#423d2c', 0.36]]) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    line.userData.baseOpacity = opacity;
    line.userData.anchors = [];
    for (let i = 0; i < positions.length; i += 3) line.userData.anchors.push(groundAnchor(positions[i], positions[i + 2], positions[i + 1] - heightAt(positions[i], positions[i + 2])));
    macroDetails.add(line);
  }
  const fleckGeo = new THREE.IcosahedronGeometry(1, 0);
  const fleckMat = new THREE.MeshStandardMaterial({ color: '#f1eed5', roughness: 0.91, transparent: true, opacity: 0.7 });
  const flecks = new THREE.InstancedMesh(fleckGeo, fleckMat, 440);
  const fleckAnchors = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 440; i++) {
    const x = (random() - 0.5) * W, z = (random() - 0.5) * D;
    const size = 0.006 + random() ** 3 * 0.023;
    dummy.position.set(x, heightAt(x, z) + size * 0.31, z);
    dummy.scale.set(size * (1 + random()), size * 0.28, size);
    dummy.rotation.set(random(), random() * 6.28, random()); dummy.updateMatrix(); flecks.setMatrixAt(i, dummy.matrix);
    fleckAnchors.push(groundAnchor(x, z, size * 0.31));
  }
  flecks.receiveShadow = true; macroDetails.add(flecks);
  // A few real curved strands catch light at ground level. They are much finer
  // than the visitor's feet; their small scale makes the print feel enormous.
  const strandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.047, 0.010, 0.007),
    new THREE.Vector3(0.112, 0.006, -0.003), new THREE.Vector3(0.17, 0, 0.009)
  ]);
  const strandMat = new THREE.MeshStandardMaterial({ color: '#dcd9bd', roughness: 0.91, transparent: true, opacity: 0.58 });
  const strands = new THREE.InstancedMesh(new THREE.TubeGeometry(strandCurve, 6, 0.0024, 3, false), strandMat, 110);
  const strandAnchors = [];
  for (let i = 0; i < 110; i++) {
    const x = (random() - 0.5) * (W - .6), z = (random() - 0.5) * (D - .6);
    const anchor = groundAnchor(x, z, 0.003);
    strandAnchors.push(anchor);
    dummy.position.set(x, anchorHeight(anchor), z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    const length = 0.4 + random() * 0.9;
    dummy.scale.set(length, 0.65 + random() * 0.6, 0.65 + random() * 0.6);
    dummy.updateMatrix(); strands.setMatrixAt(i, dummy.matrix);
  }
  strands.name = '110 fine curled paper fibers';
  strands.receiveShadow = true; macroDetails.add(strands);

    return { group: macroDetails, flecks, fleckAnchors, strands, strandAnchors, fleckMat, strandMat };
  }
  for (let index = 0; index < descriptions.length; index++) states.push(buildArtwork(index));
  activeState = states[0];
  const artworks = states.map(state => state.public);
  const particleCount = 76;
  const particlePositions = new Float32Array(particleCount * 3), particleBase = [];
  for (let i = 0; i < particleCount; i++) {
    const p = [(random() - 0.5) * (W + 2), 0.2 + random() ** 1.5 * 4.8, (random() - 0.5) * (D + 2)];
    particleBase.push(p); particlePositions.set(p, i * 3);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0.45 }, clock: { value: 0 }, scanZ: { value: 0 } },
    vertexShader: 'uniform float clock; uniform float scanZ; varying float glow; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);float r=sin(position.x*13.7+position.z*8.9);gl_PointSize=clamp((14.0+r*5.0)/max(1.0,-mv.z),1.0,4.0);glow=.28+.65*exp(-abs(position.z-scanZ)*.45);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float opacity; varying float glow; void main(){float d=length(gl_PointCoord-vec2(.5));float a=smoothstep(.5,.04,d);gl_FragColor=vec4(1.0,.84,.55,a*opacity*glow);}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.name = 'Sparse drifting optical dust';
  root.add(particles);

  // Visitor: folded tracing-paper elytra, brass joints, six articulated legs.
  const visitor = new THREE.Group();
  visitor.name = 'Mote — the smallest visitor';
  root.add(visitor);
  const shell = new THREE.Group(); visitor.add(shell);
  const visitorPaper = new THREE.MeshPhysicalMaterial({ color: '#ece7c2', roughness: 0.41, metalness: 0.04, transmission: 0.08, thickness: 0.08, clearcoat: 0.35, side: THREE.DoubleSide });
  const visitorMetal = new THREE.MeshStandardMaterial({ color: '#795d2d', roughness: 0.39, metalness: 0.71 });
  const visitorDark = new THREE.MeshStandardMaterial({ color: '#2b332d', roughness: 0.50, metalness: 0.55 });
  const visitorEye = new THREE.MeshStandardMaterial({ color: '#ffe7a2', emissive: '#ffbd52', emissiveIntensity: 3.0, roughness: 0.2 });
  const body = mesh(new THREE.SphereGeometry(0.15, 16, 10), visitorDark, shell);
  body.position.set(0, 0.17, 0.014); body.scale.set(0.84, 0.59, 1.39);
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.76), visitorPaper, shell);
    wing.position.set(side * 0.069, 0.205, 0.035);
    wing.scale.set(0.72, 0.66, 1.40); wing.rotation.z = -side * 0.25;
    wings.push(wing);
    const eye = mesh(new THREE.SphereGeometry(0.036, 12, 8), visitorEye, shell);
    eye.position.set(side * 0.058, 0.21, -0.185);
  }
  const head = mesh(new THREE.SphereGeometry(0.076, 14, 8), visitorMetal, shell);
  head.position.set(0, 0.18, -0.153); head.scale.set(1, 0.76, 0.84);
  // Fine center seam catches the raking light, like a folded paper crease.
  box(0.008, 0.018, 0.23, paperEdge, 0, 0.297, 0.028, shell);
  const legs = [];
  const limbGeometry = new THREE.CylinderGeometry(0.009, 0.006, 1, 5);
  function placeLimb(item, a, b) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    item.position.copy(av).add(bv).multiplyScalar(0.5);
    item.scale.y = av.distanceTo(bv);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.sub(av).normalize());
  }
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
    const upper = mesh(limbGeometry, visitorMetal, visitor);
    const lower = mesh(limbGeometry, visitorMetal, visitor);
    const joint = mesh(new THREE.SphereGeometry(0.013, 7, 5), visitorMetal, visitor);
    legs.push({ side, row, upper, lower, joint });
  }
  const antennae = [];
  for (const side of [-1, 1]) {
    const antenna = mesh(new THREE.CylinderGeometry(0.0035, 0.006, 1, 5), visitorMetal, shell);
    placeLimb(antenna, [side * 0.041, 0.23, -0.18], [side * 0.098, 0.29, -0.32]);
    const tip = mesh(new THREE.SphereGeometry(0.012, 8, 6), visitorEye, shell);
    tip.position.set(side * 0.098, 0.29, -0.32); antennae.push(antenna);
  }
  const visitorLight = new THREE.PointLight('#ffc76e', 0.17, 1.5, 2);
  visitorLight.position.set(0, 0.28, -0.24); visitor.add(visitorLight);
  const visitorShadow = mesh(new THREE.CircleGeometry(0.27, 24), new THREE.MeshBasicMaterial({ color: '#262518', transparent: true, opacity: 0.19, depthWrite: false }), visitor);
  visitorShadow.rotation.x = -Math.PI / 2; visitorShadow.position.y = 0.009; visitorShadow.castShadow = false;
  function setVisitor({ x = 0, z = 3.0, yaw = 0, moving = false, time = 0, jump = 0 } = {}) {
    visitor.position.set(x, heightAt(x, z) + Math.max(0, jump), z);
    visitor.rotation.y = yaw;
    if (motionPaused) return;
    const gait = moving ? 1 : 0.11;
    shell.position.y = Math.sin(time * (moving ? 19 : 3)) * (moving ? 0.007 : 0.003);
    shell.rotation.z = Math.sin(time * 10) * (moving ? 0.028 : 0.008);
    for (const part of legs) {
      const phase = time * 18 + part.row * 2.1 + (part.side < 0 ? Math.PI : 0);
      const footZ = (part.row - 1) * 0.142 + Math.cos(phase) * 0.055 * gait;
      const footY = 0.015 + Math.max(0, Math.sin(phase)) * 0.053 * gait;
      const anchor = [part.side * 0.07, 0.17, (part.row - 1) * 0.11];
      const knee = [part.side * 0.213, 0.125 + Math.sin(phase) * 0.011 * gait, (part.row - 1) * 0.14];
      const foot = [part.side * (0.27 + Math.sin(phase) * 0.016 * gait), footY, footZ];
      placeLimb(part.upper, anchor, knee); placeLimb(part.lower, knee, foot); part.joint.position.set(...knee);
    }
    for (const [index, wing] of wings.entries()) wing.rotation.z = (index ? -1 : 1) * (0.25 + Math.sin(time * 2.2) * 0.025);
  }
  setVisitor({ x: -4.0, z: 2.6 });


  // These lights belong to the microscopic interpretation, never to the hardware.
  const microLights = new THREE.Group(); microLights.name = 'Microscopic raking light'; scene.add(microLights);
  const hemisphere = new THREE.HemisphereLight('#c5d2d7', '#0c1116', 0); microLights.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffe0ae', 0); sun.position.set(-16, 8, -12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16; sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
  sun.shadow.bias = -.0002; sun.shadow.normalBias = .035; sun.shadow.radius = 3;
  microLights.add(sun); microLights.add(sun.target);
  const fill = new THREE.DirectionalLight('#abc7d4', 0); fill.position.set(17, 12, 11); microLights.add(fill);
  const rim = new THREE.DirectionalLight('#8baca5', 0); rim.position.set(0, 7, -21); microLights.add(rim);

  function setArtwork(index) {
    if (!Number.isInteger(index) || index < 0 || index >= states.length) throw new RangeError('Unknown scan.');
    for (const state of states) { state.group.visible = false; state.relief.name = `Contours for ${state.public.id}`; }
    activeState = states[index]; activeState.relief.name = 'Physical typography, traced from the scan';
    originalScanner.setTexture(index);
    colliders.splice(0, colliders.length, ...activeState.surfaces.filter(surface => surface.reliefHeight > .16));
    landmarks.splice(0, landmarks.length, ...activeState.public.landmarks);
    macroConfigured = false; setMacro(macro);
    return activeState.public;
  }
  function setScan(progress) { scanProgress = clamp(progress, 0, 1); originalScanner.setScan(scanProgress); }
  function setMacro(fraction) {
    const nextMacro = clamp(fraction, 0, 1);
    if (macroConfigured && Math.abs(nextMacro - macro) < .00001) return;
    macro = nextMacro; macroConfigured = true;
    const emergence = macro * macro * (3 - 2 * macro), opacity = clamp(macro * 3, 0, 1);
    reliefScale = Math.max(.0001, 2.2 * emergence);
    activeState.group.visible = macro > .00001;
    activeState.materialMacro.value = emergence;
    activeState.materials.forEach(material => { material.opacity = opacity; material.depthWrite = opacity > .98; });
    for (const surface of activeState.surfaces) {
      surface.mesh.scale.y = reliefScale;
      surface.minY = reliefBaseY;
      surface.maxY = surfaceHeightAt(surface, surface.bounds.maxZ);
    }
    const details = activeState.details;
    details.group.visible = macro > .04;
    details.group.children.forEach(child => {
      if (child.userData.baseOpacity) child.material.opacity = child.userData.baseOpacity * macro;
      if (child.userData.anchors) {
        const points = child.geometry.attributes.position;
        child.userData.anchors.forEach((anchor, i) => points.setY(i, anchorHeight(anchor)));
        points.needsUpdate = true; child.geometry.computeBoundingSphere();
      }
    });
    for (let i = 0; i < details.fleckAnchors.length; i++) details.flecks.instanceMatrix.array[i * 16 + 13] = anchorHeight(details.fleckAnchors[i]);
    for (let i = 0; i < details.strandAnchors.length; i++) details.strands.instanceMatrix.array[i * 16 + 13] = anchorHeight(details.strandAnchors[i]);
    details.flecks.instanceMatrix.needsUpdate = true; details.strands.instanceMatrix.needsUpdate = true;
    details.flecks.computeBoundingSphere(); details.strands.computeBoundingSphere();
    details.fleckMat.opacity = .72 * macro; details.strandMat.opacity = .58 * macro;
    visitor.visible = macro > .12;
    originalLights.forEach(light => { light.intensity = light.userData.homeIntensity * (1 - emergence); });
    hemisphere.intensity = 1.42 * emergence; sun.intensity = 3.45 * emergence; fill.intensity = .92 * emergence; rim.intensity = 1.2 * emergence;
    scene.fog.density = .013 * emergence;
    particles.visible = macro > .04; particleMat.uniforms.opacity.value = .36 * macro;
  }
  function update(time, dt, state = {}) {
    if (disposed) return;
    motionPaused = Boolean(state.paused || state.reducedMotion || state.reduced);
    if (typeof state.macro === 'number' && Math.abs(state.macro - macro) > .0001) setMacro(state.macro);
    if (typeof state.scanProgress === 'number') setScan(state.scanProgress);
    if (!motionPaused) {
      ambientTime += clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
      for (let i = 0; i < particleCount; i++) {
        const p = particleBase[i], j = i * 3;
        particlePositions[j] = p[0] + Math.sin(ambientTime * .11 + i * 2.9) * .17;
        particlePositions[j + 1] = p[1] + Math.sin(ambientTime * .19 + i * .8) * .12;
        particlePositions[j + 2] = p[2] + Math.cos(ambientTime * .08 + i * 1.2) * .20;
      }
      particleGeo.attributes.position.needsUpdate = true;
    }
    particleMat.uniforms.clock.value = ambientTime;
    particleMat.uniforms.scanZ.value = (.5 - scanProgress) * D;
  }
  function dispose() {
    disposed = true;
    scene.traverse(object => {
      if (object.geometry) disposal.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        disposal.add(material);
        if (material.map) disposal.add(material.map);
        if (material.bumpMap) disposal.add(material.bumpMap);
      }
    });
    for (const resource of disposal) resource.dispose();
  }
  setArtwork(0); setScan(.42); setMacro(0);
  return {
    scene, root, visitor, landmarks, bounds, colliders, artworks, width: W, depth: D,
    originalScanner, originalLights, originalLightRig,
    get scanMesh() { return activeState.scanMesh; },
    get currentArtwork() { return activeState.public; },
    heightAt, isBlocked, setArtwork, sourceToWorld, update, setMacro, setScan, setVisitor, dispose
  };
}
