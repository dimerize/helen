import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/rounded-box.js';
import { createComputer } from './computer-model.js';

/** The approved doorway and installation are one scene, with one camera. */
export async function createGalleryScene(renderer, { homepageCanvas, computerCanvas } = {}) {
  const textures = new Set();
  const loader = new THREE.TextureLoader();
  const loaded = await Promise.allSettled([
    '/artwork/thesis-elongated.webp',
    '/artwork/thesis-painting.webp',
    '/artwork/thesis-dark-grid.webp',
  ].map(async url => {
    const texture = await loader.loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    textures.add(texture);
    return texture;
  }));
  const failed = loaded.find(result => result.status === 'rejected');
  if (failed) {
    textures.forEach(texture => texture.dispose());
    throw failed.reason;
  }
  const maps = loaded.map(result => result.value);
  maps[0].offset.set(.405,0); maps[0].repeat.set(.192,1);
  maps[1].offset.set(.181,.098); maps[1].repeat.set(.643,.808);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111311');
  const camera = new THREE.PerspectiveCamera(48,1,.03,55);
  camera.position.set(.2,1.6,8);
  camera.lookAt(0,1.58,-2);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene.add(new THREE.HemisphereLight('#faf9eb','#4e5046',2));
  const key = new THREE.DirectionalLight('#fff8e7',2);
  key.position.set(0,6,6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-6,right:6,top:8,bottom:-6});
  key.shadow.bias = -.0005;
  scene.add(key);
  const fill = new THREE.PointLight('#f4f9ef',18,13,2);
  fill.position.set(0,3,-1);
  scene.add(fill);

  const material = (color, roughness=.9) => new THREE.MeshStandardMaterial({color,roughness});
  const plaster=material('#d1d2c8'), outside=material('#252a23');
  const floorMat=material('#b3b5aa'), trim=material('#56584c');
  function box(w,h,d,mat,x,y,z,parent=scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(4,.15,8,floorMat,0,-.09,-.4);
  box(.14,3.65,8,plaster,-1.98,1.82,-.4);
  box(.14,3.65,8,plaster,1.98,1.82,-.4);
  box(4,3.65,.14,plaster,0,1.82,-4.4);
  box(4,.1,8,material('#dedfd6'),0,3.65,-.4);
  box(.035,.13,8,trim,-1.90,.065,-.4);
  box(.035,.13,8,trim,1.90,.065,-.4);
  box(3.85,.13,.04,trim,0,.065,-4.30);

  // Solid front wall surrounds a real aperture. Its jamb passes the viewer
  // during entry; no image swap or curtain conceals the camera's movement.
  const homepageBlack = new THREE.MeshBasicMaterial({color:'#080809',toneMapped:false});
  // BoxGeometry's last material is its -Z face: the side seen from inside.
  // Its outside-facing surface keeps the approved graphite entrance finish.
  const outsideFaces = [outside,outside,outside,outside,outside,homepageBlack];
  box(8,7,.3,outsideFaces,-4.86,3.5,3.7);
  box(8,7,.3,outsideFaces,4.86,3.5,3.7);
  box(1.74,4.25,.3,outsideFaces,0,4.88,3.7);
  const exteriorFloor=box(16,.12,7,material('#1d211b'),0,-.1,7.1);
  const jamb = material('#777c6e',.6);
  box(.075,2.85,.25,jamb,-.89,1.425,3.76);
  box(.075,2.85,.25,jamb,.89,1.425,3.76);
  box(1.85,.075,.25,jamb,0,2.85,3.76);
  box(1.78,.035,.3,jamb,0,.018,3.76);

  const door = new THREE.Group();
  door.position.set(-.84,0,3.69);
  scene.add(door);
  box(1.68,2.78,.085,material('#343832',.62),.84,1.40,0,door);
  const metal = new THREE.MeshStandardMaterial({color:'#b9bdb1',metalness:.85,roughness:.24});
  box(.058,.28,.028,metal,1.5,1.16,.057,door);
  const handle = new THREE.Group();
  handle.position.set(1.49,1.19,.11);
  door.add(handle);
  box(.19,.025,.03,metal,-.07,0,0,handle);
  for (const y of [.23,2.55]) box(.032,.13,.05,metal,.025,y,.01,door);
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width=512; plaqueCanvas.height=160;
  const pc = plaqueCanvas.getContext('2d');
  pc.fillStyle='#c6c9bd'; pc.fillRect(0,0,512,160);
  pc.fillStyle='#31382e'; pc.font='24px Arial'; pc.fillText('Helen Zhang',28,60);
  pc.font='18px Arial'; pc.fillText('Beyond the humanized machine',28,103);
  const plaque = new THREE.CanvasTexture(plaqueCanvas);
  plaque.colorSpace=THREE.SRGBColorSpace;
  textures.add(plaque);
  box(.63,.197,.012,new THREE.MeshStandardMaterial({map:plaque,roughness:.7}),.82,1.94,.052,door);
  const lightMat = new THREE.MeshStandardMaterial({color:'#fffff7',emissive:'#ffffed',emissiveIntensity:2});
  box(.07,.075,2.1,lightMat,0,3.48,-.4);

  const artworks=[];
  function art(id,title,w,h,x,y,z,rotation,map,pose) {
    const group=new THREE.Group();
    group.position.set(x,y,z); group.rotation.y=rotation; scene.add(group);
    box(w+.015,h+.015,.05,material('#44483e'),0,0,-.032,group);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map,roughness:.95}));
    mesh.userData.art=id;
    group.add(mesh);
    artworks.push({mesh,title,pose});
    return group;
  }
  art(0,'Elongated',1.3,3.05,-1.897,1.70,.7,Math.PI/2,maps[0],{p:[.45,1.62,1.08],t:[-1.89,1.80,.7]});
  const gaps=art(1,'Gaps',1.35,2.04,0,1.94,-4.30,0,maps[1],{p:[0,1.62,-1.7],t:[0,1.9,-4.3]});
  art(2,'Bent Mesh',1.42,2.4,1.897,1.9,-1.3,-Math.PI/2,maps[2],{p:[-.45,1.62,-.5],t:[1.89,1.85,-1.3]});
  const black=material('#0e110e');
  for (const side of [-1,1]) for (let i=0;i<3;i++) {
    box(.035,.40,.27,black,side*1.891,1.68,side===-1?-1.6-i*.40:1.4+i*.40);
  }
  const patternCanvas=document.createElement('canvas');
  patternCanvas.width=256; patternCanvas.height=384;
  const ctx=patternCanvas.getContext('2d');
  ctx.lineWidth=5; ctx.strokeStyle='#fffffb'; ctx.shadowColor='#ffffff'; ctx.shadowBlur=5;
  ctx.beginPath(); ctx.moveTo(48,213);
  ctx.bezierCurveTo(24,145,174,111,180,188);
  ctx.bezierCurveTo(210,212,180,260,168,289);
  ctx.lineTo(155,291); ctx.lineTo(162,232);
  ctx.bezierCurveTo(127,259,103,211,96,220);
  ctx.lineTo(79,284); ctx.lineTo(62,284); ctx.lineTo(71,213); ctx.stroke();
  const pattern=new THREE.CanvasTexture(patternCanvas);
  textures.add(pattern);
  const projection=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.75),new THREE.MeshBasicMaterial({map:pattern,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.65}));
  projection.position.z=.011;
  gaps.add(projection);

  let homepageTexture=null;
  if (homepageCanvas) {
    homepageTexture=new THREE.CanvasTexture(homepageCanvas);
    homepageTexture.colorSpace=THREE.SRGBColorSpace;
    homepageTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    textures.add(homepageTexture);
    const aspect=homepageCanvas.width/Math.max(homepageCanvas.height,1);
    const portrait=aspect < .8;
    const width=portrait ? 5*aspect : 5.7;
    const height=portrait ? 5 : width/aspect;
    const homepage=new THREE.Mesh(
      new THREE.PlaneGeometry(width,height),
      new THREE.MeshBasicMaterial({map:homepageTexture,side:THREE.BackSide,toneMapped:false}),
    );
    // This is the BACK of the actual homepage: its text naturally reads in
    // reverse from inside. Depth testing lets the door and walls occlude it.
    homepage.position.set(0,1.62,portrait ? 5.5 : 7.3);
    homepage.name='homepage-outside';
    scene.add(homepage);
  }

  let computer=null;
  if(computerCanvas) {
    const screenTexture=new THREE.CanvasTexture(computerCanvas);
    screenTexture.colorSpace=THREE.SRGBColorSpace;
    screenTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    textures.add(screenTexture);
    computer=createComputer(THREE,RoundedBoxGeometry,screenTexture);
    computer.group.position.set(1.40,0,3.02);
    computer.group.rotation.y=Math.PI;
    computer.group.scale.setScalar(.9);
    scene.add(computer.group);
    scene.updateMatrixWorld(true);
  }

  let disposed=false;
  return {
    scene,camera,door,handle,artworks,homepageTexture,computer,
    update() {
      const inside=camera.position.z < 3.7;
      exteriorFloor.visible=!inside;
      scene.background.set(inside ? '#080809' : '#111311');
    },
    dispose() {
      if (disposed) return;
      disposed=true;
      const geometries=new Set(),materials=new Set();
      scene.traverse(object=>{
        if(object.geometry) geometries.add(object.geometry);
        if(object.material) for(const mat of [object.material].flat()) {
          materials.add(mat);
          for(const value of Object.values(mat)) if(value?.isTexture) textures.add(value);
        }
        object.shadow?.dispose();
      });
      geometries.forEach(geometry=>geometry.dispose());
      materials.forEach(mat=>mat.dispose());
      textures.forEach(texture=>texture.dispose());
      scene.clear();
    },
  };
}
