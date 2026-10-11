/**
 * Unmodified scanner hardware extracted from the production scanner source.
 * Home and the gallery rear window use the same production scene. This factory
 * is the single source of hardware for the prototype; the microscopic artwork
 * is a separate layer. There is no hinge or lid in the original instrument.
 *
 * All geometry constructors, dimensions, material constants, offsets, shader,
 * label drawing, and cable control points below are preserved verbatim.
 * Keep the hardware root at native scale; use a parent uniform scale if needed.
 */
export const sourceProvenance = Object.freeze({
  url: 'https://helenzhang.studio/studio/scanner.js',
  capturedAt: '2026-10-10',
  sha256: '375f559fbaeb1e29fcef0e734ee55cdba7fc45a96707ada2722653500d61a7d2',
  threeModuleSha256: 'e2b5ee6bccd38fd6d8a2428546b83c5f2426d84b152ef82be8055556e3b40eb6',
  threeCoreSha256: '61ba0df005b05991361d040d8ff670e1aadfd0ce7aeebd1fdb0725957a8957de',
  gallery: 'The live studio:scanner-capture event copies this same renderer into the gallery rear window.',
  originalPlaten: { width: 9.45, depth: 6.24, y: 0.045 },
  originalBase: { width: 10.5, depth: 7.1 },
});

export const originalScans = Object.freeze([
  { image: 'train-scan.jpg', productionImage: 'train-scan.webp', title: 'Found on the train', alt: 'Red exit and caution lettering, distorted by a handheld scan' },
  { image: 'train-scan-wide.jpg', productionImage: 'train-scan-wide.webp', title: 'A surface, passing through', alt: 'Worn yellow train lettering stretched across a scan' },
  { image: 'train-scan-notice.jpg', productionImage: 'train-scan-notice.webp', title: 'Signs of use', alt: 'A train notice recorded in a handheld scan' },
]);

export async function createOriginalScanner(THREE, textures, renderer) {
  if (!textures?.length || !textures.every(texture => texture.image?.width && texture.image?.height)) {
    throw new Error('The original scanner requires loaded source scan textures.');
  }
  // Ensure the unchanged production label uses its actual production typeface.
  if (typeof FontFace !== 'undefined' && !Array.from(document.fonts).some(face => face.family.replace(/["']/g, '') === 'Geist')) {
    const face = new FontFace('Geist', 'url(/fonts/geist-latin-wght-normal.woff2)');
    await face.load();
    document.fonts.add(face);
  }
  const rig = new THREE.Group();
  const carbon=new THREE.MeshStandardMaterial({color:0x292a2d,roughness:.36,metalness:.55});
  const black=new THREE.MeshStandardMaterial({color:0x0d0e10,roughness:.46,metalness:.25});
  const metal=new THREE.MeshStandardMaterial({color:0x87878b,roughness:.27,metalness:.86});
  const trim=new THREE.MeshStandardMaterial({color:0x3b3c41,roughness:.25,metalness:.8});
  const white=new THREE.MeshBasicMaterial({color:0xeaf4f3});
  function block(parent,w,h,d,x,y,z,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;}
  function roundedPlate(width,depth,radius,height,material){
    const s=new THREE.Shape(),x=-width/2,y=-depth/2,w=width,d=depth,r=radius;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:3,steps:1,curveSegments:10});g.rotateX(-Math.PI/2);
    return new THREE.Mesh(g,material);
  }
  const base=roundedPlate(10.5,7.1,.2,.19,black);base.position.y=-.23;rig.add(base);
  block(rig,9.82,.022,6.52,0,.015,0,new THREE.MeshStandardMaterial({color:0x1b1c20,metalness:.55,roughness:.16}));
  // The platen is tied to the image's capture, rather than a decorative device beside it.
  for(const side of [-1,1]){
    block(rig,.10,.12,6.74,side*4.95,.08,0,metal);
    block(rig,.025,.08,6.74,side*4.88,.16,0,trim);
    for(const end of [-1,1]){
      block(rig,.42,.16,.25,side*4.95,.11,end*3.36,carbon);
      const screw=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.018,16),metal);screw.position.set(side*5.10,.005,end*3.29);rig.add(screw);
    }
  }
  textures.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();});
  const uniform={map:{value:textures[0]},progress:{value:.42},imageAspect:{value:textures[0].image.width/textures[0].image.height},planeAspect:{value:9.45/6.24}};
  const imageMat=new THREE.ShaderMaterial({
    uniforms:uniform,transparent:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D map; uniform float progress; uniform float imageAspect; uniform float planeAspect; varying vec2 vUv;
      void main(){vec2 uv=vUv; if(imageAspect>planeAspect){uv.x=(uv.x-.5)*planeAspect/imageAspect+.5;}else{uv.y=(uv.y-.5)*imageAspect/planeAspect+.5;} vec3 col=texture2D(map,uv).rgb;float pass=smoothstep(progress-.025,progress+.009,vUv.y);float glow=exp(-abs(vUv.y-progress)*160.);float edgeFade=smoothstep(0.,.018,vUv.x)*smoothstep(0.,.018,1.-vUv.x);col*=mix(.10,.88,pass);col+=glow*vec3(.28,.3,.32);col*=edgeFade;gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')
  });
  const imagePlane=new THREE.Mesh(new THREE.PlaneGeometry(9.45,6.24),imageMat);imagePlane.rotation.x=-Math.PI/2;imagePlane.position.y=.045;rig.add(imagePlane);
  // Restrained scratches and edge markings on the instrument, never on the source image.
  for(let i=0;i<28;i++)block(rig,i%5===0?.15:.075,.004,.009,-4.9,.19,-2.9+i*.21,metal);
  const wand=new THREE.Group();rig.add(wand);
  const underside=roundedPlate(10.23,.58,.12,.09,black);underside.position.y=.13;wand.add(underside);
  const housing=roundedPlate(10.1,.71,.16,.22,carbon);housing.position.y=.20;wand.add(housing);
  block(wand,9.35,.027,.037,0,.24,.379,metal);
  block(wand,9.47,.035,.038,0,.14,.36,white);
  block(wand,9.73,.018,.04,0,.437,-.21,trim);
  for(let i=0;i<26;i++)block(wand,.018,.014,.24,2.0+i*.067,.455,-.014,black);
  const lens=new THREE.Mesh(new THREE.PlaneGeometry(9.65,.42),new THREE.MeshBasicMaterial({color:0xd7e2ff,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));lens.rotation.x=-Math.PI/2;lens.position.set(0,.075,.46);wand.add(lens);
  const light=new THREE.PointLight(0xd1d5ff,8,5,2);light.position.set(1,.75,.4);wand.add(light);
  const status=new THREE.Mesh(new THREE.CircleGeometry(.035,16),new THREE.MeshBasicMaterial({color:0xf3bd94}));status.rotation.x=-Math.PI/2;status.position.set(-3.9,.455,0);wand.add(status);
  // A small real label gives the hardware scale without turning the home into a dashboard.
  await document.fonts.load('24px Geist').catch(() => {});
  const labelCanvas=document.createElement('canvas');labelCanvas.width=1024;labelCanvas.height=64;const ctx=labelCanvas.getContext('2d');ctx.clearRect(0,0,1024,64);ctx.fillStyle='#b8b9bd';ctx.font='24px Geist, sans-serif';ctx.fillText('H. ZHANG     /     IMAGE READER',15,40);const labelTex=new THREE.CanvasTexture(labelCanvas);labelTex.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(3.15,.20),new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false}));label.rotation.x=-Math.PI/2;label.position.set(-2.1,.458,0);wand.add(label);
  // Cable makes the hardware feel attached to the room, not stranded in a blank page.
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(5.15,-.05,-2.6),new THREE.Vector3(5.8,-.1,-2.9),new THREE.Vector3(6.5,-.12,-1.8),new THREE.Vector3(7.9,-.1,-1.8),new THREE.Vector3(10,-.1,-3)]);
  rig.add(new THREE.Mesh(new THREE.TubeGeometry(curve,60,.046,8,false),black));

  let currentTexture = 0;
  function setScan(progress) {
    uniform.progress.value = progress;
    wand.position.z = (.5 - progress) * 6.24;
  }
  function setTexture(index) {
    if (!Number.isInteger(index) || !textures[index]) throw new RangeError('Unknown scanner image.');
    currentTexture = index;
    uniform.map.value = textures[index];
    uniform.imageAspect.value = textures[index].image.width / textures[index].image.height;
  }
  // The shader uses a centred cover crop. Both helpers use top-left image UVs,
  // matching the geometry extractor; THREE shader vUv.y is bottom-to-top.
  function platenToImageUV(u, v, index = currentTexture) {
    const aspect = textures[index].image.width / textures[index].image.height;
    const planeAspect = 9.45 / 6.24;
    return aspect > planeAspect
      ? [(u - .5) * planeAspect / aspect + .5, v]
      : [u, (v - .5) * aspect / planeAspect + .5];
  }
  function imageToPlatenUV(u, v, index = currentTexture) {
    const aspect = textures[index].image.width / textures[index].image.height;
    const planeAspect = 9.45 / 6.24;
    return aspect > planeAspect
      ? [(u - .5) * aspect / planeAspect + .5, v]
      : [u, (v - .5) * planeAspect / aspect + .5];
  }
  function getPose(width, height) {
    const aspect = width / height, narrow = width < 700;
    const factor = narrow ? Math.max(1, 1.35 / aspect) : 1;
    return {
      fov: 39, near: .1, far: 100,
      position: [narrow ? 0 : .65, 8.3 * factor, 10.4 * factor],
      target: [narrow ? 0 : .3, narrow ? 1.8 : 0, 0],
      rigPosition: [narrow ? 0 : 1, 0, 0],
      rigRotation: [0, narrow ? -.12 : -.18, narrow ? -.055 : -.035],
    };
  }
  function createLighting() {
    const hemisphere = new THREE.HemisphereLight(0xbab8d0, 0x151518, 3.2);
    const key = new THREE.DirectionalLight(0xfff2e9, 7); key.position.set(-5, 9, 5);
    const edge = new THREE.DirectionalLight(0x8f95c7, 5); edge.position.set(5, 3, -6);
    const near = new THREE.DirectionalLight(0xffffff, 2); near.position.set(1, 4, 9);
    return [hemisphere, key, edge, near];
  }
  function dispose() {
    const geometries = new Set(), materials = new Set();
    rig.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    labelTex.dispose();
  }
  return {
    root: rig, imagePlane, wand, uniforms: uniform,
    setScan, setTexture, platenToImageUV, imageToPlatenUV, getPose, createLighting, dispose,
    sourceProvenance,
    renderConfig: { clearColor: 0x080809, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 },
  };
}
