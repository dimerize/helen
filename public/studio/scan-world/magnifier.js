/**
 * A separate, real optical accessory. It never edits or reparents the scanner.
 *
 * const tool = createMagnifier(THREE);
 * scene.add(tool.group);
 * tool.setSource(texture, {
 *   centerUV: [.5, .5],       // original image, top-left origin
 *   sourceSpan: [.28, .28],   // source UV width/height under the aperture
 *   magnification: 2.6,
 * });
 * tool.update({ hover: true, time: 0, reduced: false });
 * tool.dispose();             // source texture remains owned by its caller
 *
 * renderMagnifierPreview(THREE, { texture, sourceOptions, size: 256 }) returns
 * a transparent 2D canvas copied from a one-shot WebGL render of this SAME
 * model. Call on demand and reuse its toDataURL() for paper controls. There is
 * no persistent renderer, animation loop, DOM mutation, or network request.
 */

export function createMagnifier(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = 'Graphite inspection magnifier';
  group.userData.isMagnifier = true;
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set();
  let disposed = false;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = (value, fallback) => Number.isFinite(value) ? value : fallback;

  // A small procedural studio environment supplies broad physical reflections
  // even in the scanner's black room. It is private to this accessory, never a
  // scene-wide lighting change, and contains no external asset.
  const envWidth = 128, envHeight = 64, envPixels = new Uint8Array(envWidth * envHeight * 4);
  for (let y = 0; y < envHeight; y++) for (let x = 0; x < envWidth; x++) {
    const u = x / envWidth, v = y / envHeight;
    const strip = (center, width, gain) => gain * Math.exp(-Math.pow((u - center) / width, 4)) * Math.exp(-Math.pow((v - .4) / .26, 6));
    const illumination = clamp(24 + strip(.14, .12, 118) + strip(.57, .045, 58) + strip(.82, .16, 32), 0, 255);
    const offset = (y * envWidth + x) * 4;
    envPixels[offset] = Math.round(illumination);
    envPixels[offset + 1] = Math.round(illumination * .987);
    envPixels[offset + 2] = Math.round(illumination * .97);
    envPixels[offset + 3] = 255;
  }
  const reflections = new THREE.DataTexture(envPixels, envWidth, envHeight, THREE.RGBAFormat);
  reflections.mapping = THREE.EquirectangularReflectionMapping;
  reflections.colorSpace = THREE.SRGBColorSpace;
  reflections.needsUpdate = true;
  textures.add(reflections);

  function material(Constructor, settings) {
    const result = new Constructor(settings);
    materials.add(result);
    return result;
  }
  function mesh(geometry, surface, name, parent = group) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, surface);
    result.name = name;
    result.castShadow = true;
    result.receiveShadow = true;
    result.userData.isMagnifier = true;
    parent.add(result);
    return result;
  }
  const nickel = material(THREE.MeshStandardMaterial, {
    color: '#353a37', metalness: .72, roughness: .38, envMap: reflections, envMapIntensity: .68,
  });
  const darkNickel = material(THREE.MeshStandardMaterial, {
    color: '#555b55', metalness: .8, roughness: .32, envMap: reflections, envMapIntensity: .6,
  });
  const grip = material(THREE.MeshStandardMaterial, {
    color: '#171d1b', metalness: .12, roughness: .73, envMap: reflections, envMapIntensity: .34,
  });
  const gripRidge = material(THREE.MeshStandardMaterial, {
    color: '#252d29', metalness: .16, roughness: .69, envMap: reflections, envMapIntensity: .34,
  });

  // The ring's turned profile forms a real aperture with a bevel at each
  // shoulder. The dark inset channel reads as an optical retaining ring.
  const ringProfile = [
    [.794, -.043], [.813, -.073], [.872, -.073], [.916, -.045],
    [.93, -.014], [.93, .029], [.911, .064], [.858, .086],
    [.821, .069], [.794, .035], [.794, -.043],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(ringProfile, 112), nickel, 'Turned nickel frame');
  const retainingRing = mesh(new THREE.TorusGeometry(.808, .012, 8, 112), darkNickel, 'Optical retaining channel');
  retainingRing.rotation.x = Math.PI / 2;
  retainingRing.position.y = .049;
  const rim = mesh(new THREE.TorusGeometry(.895, .008, 6, 112), nickel, 'Fine polished shoulder');
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .071;
  // The retaining collar has individual machined flutes, not a painted
  // texture: they catch the room's light differently around its circumference.
  const knurlGeometry = new THREE.BoxGeometry(.012, .032, .008);
  geometries.add(knurlGeometry);
  const collarFlutes = new THREE.InstancedMesh(knurlGeometry, darkNickel, 72);
  instances.add(collarFlutes);
  collarFlutes.name = '72 machined retaining-collar flutes';
  collarFlutes.castShadow = collarFlutes.receiveShadow = true;
  collarFlutes.userData.isMagnifier = true;
  group.add(collarFlutes);
  const flutePose = new THREE.Object3D();
  for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2;
    flutePose.position.set(Math.sin(angle) * .931, -.003, Math.cos(angle) * .931);
    flutePose.rotation.y = angle; flutePose.updateMatrix();
    collarFlutes.setMatrixAt(i, flutePose.matrix);
    collarFlutes.setColorAt(i, new THREE.Color(i % 6 === 0 ? '#767d70' : '#40483e'));
  }
  collarFlutes.instanceMatrix.needsUpdate = true;
  const lowerShoulder = mesh(new THREE.TorusGeometry(.887, .012, 8, 112), nickel, 'Lower polished collar');
  lowerShoulder.rotation.x = Math.PI / 2;
  lowerShoulder.position.y = -.069;
  for (const angle of [-.72, .72]) {
    const fastener = mesh(new THREE.CylinderGeometry(.023, .023, .010, 14), darkNickel, 'Slotted retaining fastener');
    fastener.position.set(Math.sin(angle) * .869, .079, Math.cos(angle) * .869);
    const slot = mesh(new THREE.BoxGeometry(.027, .003, .005), grip, 'Retaining screw slot');
    slot.position.copy(fastener.position); slot.position.y += .007;
    slot.rotation.y = angle + .25;
  }

  // Biconvex lens: both sides have measurable curvature and join at the rim.
  const lensProfile = [];
  const lensRadius = .795;
  for (let i = 0; i <= 28; i++) {
    const r = lensRadius * i / 28;
    lensProfile.push(new THREE.Vector2(r, .022 + .12 * (1 - (r / lensRadius) ** 2)));
  }
  for (let i = 28; i >= 0; i--) {
    const r = lensRadius * i / 28;
    lensProfile.push(new THREE.Vector2(r, -.022 - .070 * (1 - (r / lensRadius) ** 2)));
  }
  const opticalGlass = material(THREE.MeshPhysicalMaterial, {
    color: '#e6f3f1', roughness: .028, metalness: 0, transmission: .92,
    thickness: .23, ior: 1.52, attenuationColor: '#9ebfbc', attenuationDistance: 3.2,
    envMap: reflections, envMapIntensity: 1.18, clearcoat: 1, clearcoatRoughness: .028,
  });
  const glass = mesh(new THREE.LatheGeometry(lensProfile, 112), opticalGlass, 'Biconvex optical glass');
  glass.castShadow = false;
  // A single optical shader avoids stacking two separate refractions.
  glass.visible = true;

  // Magnified artwork is sampled on a curved inner surface inside the glass.
  // Source UVs remain independent of texture.repeat/offset, so choosing a crop
  // never modifies the scanner's texture or its original cover transform.
  const sourceUniforms = {
    artwork: { value: null }, centerUV: { value: new THREE.Vector2(.5, .5) },
    sourceSpan: { value: new THREE.Vector2(.28, .28) }, magnification: { value: 2.6 },
    reflectionPhase: { value: 0 }, reflectionStrength: { value: 1 },
    scanProgress:{value:0}, platenCenterV:{value:.21153846}, platenSpanV:{value:.186},
  };
  const sourceMaterial = material(THREE.ShaderMaterial, {
    uniforms: sourceUniforms, side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 aperture;
      varying vec3 opticalNormal;
      varying vec3 opticalView;
      void main() {
        aperture = position.xz / 1.59;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        opticalNormal = normalize(normalMatrix * normal);
        opticalView = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D artwork;
      uniform vec2 centerUV;
      uniform vec2 sourceSpan;
      uniform float magnification;
      uniform float reflectionPhase;
      uniform float reflectionStrength;
      uniform float scanProgress;
      uniform float platenCenterV;
      uniform float platenSpanV;
      varying vec2 aperture;
      varying vec3 opticalNormal;
      varying vec3 opticalView;
      vec3 readArtwork(vec2 uv) {
        uv = clamp(uv, vec2(.0001), vec2(.9999));
        return texture2D(artwork, vec2(uv.x, 1.0 - uv.y)).rgb;
      }
      void main() {
        float radius = clamp(length(aperture) * 2.0, 0.0, 1.0);
        float radius2 = radius * radius;
        // Strong central magnification relaxes toward the perimeter, where
        // thick glass bends the source sharply. The change is spatial, not an
        // animated image zoom, so the same printed detail stays under the tool.
        float refractiveGain = .96 + .12 * radius2 + .36 * pow(radius, 6.0);
        vec2 warped = aperture * refractiveGain;
        vec2 imageUV = centerUV + warped * sourceSpan / magnification;
        // Dispersion is confined to the outer glass. There is no colored
        // outline pasted over the image, and the reading area stays crisp.
        vec2 dispersion = aperture * sourceSpan / magnification * .009 * pow(radius, 7.0);
        vec3 color;
        color.r = readArtwork(imageUV + dispersion).r;
        color.g = readArtwork(imageUV).g;
        color.b = readArtwork(imageUV - dispersion).b;

        float scanV=platenCenterV-warped.y*platenSpanV/magnification;
        float pass=smoothstep(scanProgress-.025,scanProgress+.009,scanV);
        color*=mix(.10,.88,pass);
        color+=exp(-abs(scanV-scanProgress)*160.)*vec3(.28,.30,.32);
        vec3 normal = normalize(opticalNormal);
        vec3 view = normalize(opticalView);
        float facing = clamp(abs(dot(normal, view)), 0.0, 1.0);
        float fresnel = .018 + .14 * pow(1.0 - facing, 3.0);
        float edge = smoothstep(.72, 1.0, radius);
        // Barely cool transmission and a denser green-grey cut edge give the
        // volume a legible glass body without bleaching the source artwork.
        color *= mix(vec3(.99, 1.0, 1.0), vec3(.81, .91, .91), edge * .56);
        color = mix(color, vec3(.64, .77, .78), fresnel + edge * .055);

        // Broad softboxes bend across the actual curved normal field. Only
        // their reflected position drifts; the lens and image do not move.
        vec2 pane = aperture * 2.0;
        float normalBend = dot(normal.xy, vec2(.52, -.29));
        float drift = sin(reflectionPhase) * .105;
        float ribbon = dot(pane, vec2(.65, .76)) + .24 * (1.0 - radius2) + normalBend * .22 + drift;
        float softbox = exp(-pow((ribbon + .37) / .13, 2.0));
        softbox *= 1.0 - smoothstep(.80, 1.02, abs(dot(pane, vec2(-.76, .65))));
        float companion = exp(-pow((ribbon - .58) / .045, 2.0)) * .34;
        float reflection = (softbox * .065 + companion * .028) * reflectionStrength;
        color = mix(color, vec3(.93, .98, 1.0), reflection);
        float cutEdge = exp(-pow((radius - .972) / .016, 2.0));
        color += vec3(.075, .105, .095) * cutEdge * (.28 + .32 * smoothstep(-.7, .65, pane.x - pane.y));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const insetGeometry = new THREE.BufferGeometry();
  const points = [0, .100, 0], indices = [], rings = 24, segments = 112;
  for (let ring = 1; ring <= rings; ring++) {
    const radial = ring / rings, radius = .792 * radial;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      points.push(Math.sin(angle) * radius, -.010 + .110 * (1 - radial * radial), Math.cos(angle) * radius);
    }
  }
  for (let segment = 0; segment < segments; segment++) indices.push(0, 1 + segment, 1 + (segment + 1) % segments);
  for (let ring = 1; ring < rings; ring++) for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    const a = 1 + (ring - 1) * segments + segment, b = 1 + ring * segments + segment;
    const c = 1 + ring * segments + next, d = 1 + (ring - 1) * segments + next;
    indices.push(a, b, c, a, c, d);
  }
  insetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  insetGeometry.setIndex(indices);
  insetGeometry.computeVertexNormals();
  const source = mesh(insetGeometry, sourceMaterial, 'Magnified original artwork');
  source.visible = false;
  source.castShadow = false;

  // The handle is its own shaped solid: a short metal ferrule, a softly
  // swelling dark grip, narrow turned grooves, and a nickel heel.
  const handle = new THREE.Group();
  handle.name = 'Tactile handle';
  handle.rotation.y = .48;
  group.add(handle);
  function axisMesh(geometry, surface, name, z) {
    const result = mesh(geometry, surface, name, handle);
    result.rotation.x = Math.PI / 2;
    result.position.z = z;
    return result;
  }
  axisMesh(new THREE.CylinderGeometry(.113, .132, .40, 32), nickel, 'Nickel ferrule', 1.015);
  axisMesh(new THREE.CylinderGeometry(.116, .116, .045, 32), darkNickel, 'Ferrule seam', 1.215);
  const handleProfile = [
    [0, 0], [.113, 0], [.148, .07], [.169, .25], [.161, .58],
    [.146, .95], [.146, 1.16], [.132, 1.27], [.071, 1.31], [0, 1.315],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  axisMesh(new THREE.LatheGeometry(handleProfile, 36), grip, 'Dark shaped grip', 1.20);
  // The lathe's +Y axis maps to the handle's +Z axis after the quarter turn.
  for (let i = 0; i < 13; i++) {
    const z = 1.50 + i * .060;
    const radius = .168 - (z - 1.50) * .024;
    const ridge = mesh(new THREE.TorusGeometry(radius, .0034, 5, 36), gripRidge, `Grip turn ${i + 1}`, handle);
    ridge.position.z = z;
  }
  axisMesh(new THREE.CylinderGeometry(.085, .112, .043, 32), darkNickel, 'Recessed nickel heel', 2.498);

  function setSource(texture, settings = {}) {
    if (disposed) return;
    sourceUniforms.artwork.value = texture || null;
    sourceUniforms.scanProgress.value=number(settings.scanProgress,0);
    sourceUniforms.platenCenterV.value=number(settings.platenCenterV,.5);
    sourceUniforms.platenSpanV.value=number(settings.platenSpanV,.186);
    source.visible = Boolean(texture?.isTexture);
    glass.visible = !source.visible;
    const center = settings.centerUV || [.5, .5];
    const span = settings.sourceSpan || [.28, .28];
    sourceUniforms.centerUV.value.set(clamp(number(center[0], .5), 0, 1), clamp(number(center[1], .5), 0, 1));
    sourceUniforms.sourceSpan.value.set(clamp(number(span[0], .28), .001, 1), clamp(number(span[1], .28), .001, 1));
    sourceUniforms.magnification.value = clamp(number(settings.magnification, 2.6), 1, 8);
  }
  function update({ hover = false, time, reduced = false } = {}) {
    if (disposed) return;
    // A full reflection oscillation takes about two minutes. Reduced motion
    // holds the current reflection instead of snapping to a different pose.
    if (!reduced && Number.isFinite(time)) sourceUniforms.reflectionPhase.value = time * .048;
    sourceUniforms.reflectionStrength.value = hover ? 1.1 : 1;
    nickel.envMapIntensity = hover ? .78 : .68;
    opticalGlass.envMapIntensity = hover ? .65 : .6;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    sourceUniforms.artwork.value = null;
    for (const resource of [...instances, ...geometries, ...materials, ...textures]) resource.dispose();
  }
  if (options.texture) setSource(options.texture, options.sourceOptions);
  return { group, setSource, update, dispose };
}

export function renderMagnifierPreview(THREE, options = {}) {
  if (typeof document === 'undefined') throw new Error('Magnifier previews require a browser canvas.');
  const size = Math.round(Math.max(64, Math.min(768, Number.isFinite(options.size) ? options.size : 256)));
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  let tool;
  try {
    renderer.setSize(size, size, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
    camera.position.set(1.50, 6.45, 4.1);
    camera.lookAt(.34, 0, .66);
    scene.add(new THREE.HemisphereLight(0xf4f7f3, 0x31362e, 3));
    const key = new THREE.DirectionalLight(0xfff9ed, 5.2);
    key.position.set(-3, 6, 2); scene.add(key);
    const edge = new THREE.DirectionalLight(0xcad9ec, 2.5);
    edge.position.set(4, 3, -4); scene.add(edge);
    tool = createMagnifier(THREE, options);
    scene.add(tool.group);
    renderer.render(scene, camera);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The magnifier preview canvas is unavailable.');
    context.drawImage(renderer.domElement, 0, 0);
    return canvas;
  } finally {
    tool?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
