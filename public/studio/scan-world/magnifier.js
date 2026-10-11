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
  group.name = 'Nickel and glass magnifier';
  group.userData.isMagnifier = true;
  const geometries = new Set(), materials = new Set(), textures = new Set();
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
    const illumination = clamp(26 + strip(.14, .052, 209) + strip(.57, .028, 165) + strip(.82, .12, 60), 0, 255);
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
    color: '#b9c0c1', metalness: .94, roughness: .19, envMap: reflections, envMapIntensity: .95,
  });
  const darkNickel = material(THREE.MeshStandardMaterial, {
    color: '#56615f', metalness: .88, roughness: .27, envMap: reflections, envMapIntensity: .8,
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
    color: '#f1faf7', roughness: .035, metalness: 0, transmission: .97,
    thickness: .19, ior: 1.48, attenuationColor: '#b8d4c8', attenuationDistance: 4.5,
    envMap: reflections, envMapIntensity: .78, clearcoat: 1, clearcoatRoughness: .035,
  });
  const glass = mesh(new THREE.LatheGeometry(lensProfile, 112), opticalGlass, 'Biconvex optical glass');
  glass.castShadow = false;

  // Magnified artwork is sampled on a curved inner surface inside the glass.
  // Source UVs remain independent of texture.repeat/offset, so choosing a crop
  // never modifies the scanner's texture or its original cover transform.
  const sourceUniforms = {
    artwork: { value: null }, centerUV: { value: new THREE.Vector2(.5, .5) },
    sourceSpan: { value: new THREE.Vector2(.28, .28) }, magnification: { value: 2.6 },
  };
  const sourceMaterial = material(THREE.ShaderMaterial, {
    uniforms: sourceUniforms, side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 aperture;
      void main() {
        aperture = position.xz / 1.59;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D artwork;
      uniform vec2 centerUV;
      uniform vec2 sourceSpan;
      uniform float magnification;
      varying vec2 aperture;
      void main() {
        float radius = length(aperture) * 2.0;
        vec2 warped = aperture * (1.0 + .08 * radius * radius);
        vec2 imageUV = centerUV + warped * sourceSpan / magnification;
        imageUV = clamp(imageUV, vec2(.0001), vec2(.9999));
        vec3 color = texture2D(artwork, vec2(imageUV.x, 1.0 - imageUV.y)).rgb;
        color *= 1.0 - .045 * pow(radius, 5.0);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const insetGeometry = new THREE.CircleGeometry(.792, 112);
  insetGeometry.rotateX(-Math.PI / 2);
  const points = insetGeometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const radial = Math.hypot(points.getX(i), points.getZ(i)) / .792;
    points.setY(i, -.017 + .012 * (1 - radial * radial));
  }
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
    source.visible = Boolean(texture?.isTexture);
    const center = settings.centerUV || [.5, .5];
    const span = settings.sourceSpan || [.28, .28];
    sourceUniforms.centerUV.value.set(clamp(number(center[0], .5), 0, 1), clamp(number(center[1], .5), 0, 1));
    sourceUniforms.sourceSpan.value.set(clamp(number(span[0], .28), .001, 1), clamp(number(span[1], .28), .001, 1));
    sourceUniforms.magnification.value = clamp(number(settings.magnification, 2.6), 1, 8);
  }
  function update({ hover = false } = {}) {
    if (disposed) return;
    // No transform changes or clock-driven movement: a quiet optical response
    // is equally safe for motion-sensitive visitors and reduced-motion mode.
    nickel.envMapIntensity = hover ? 1.13 : .95;
    opticalGlass.envMapIntensity = hover ? .95 : .78;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    sourceUniforms.artwork.value = null;
    for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
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
