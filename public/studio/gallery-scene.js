import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/rounded-box.js';
import { createComputer } from './computer-model.js';
import { createGalleryArchitecture } from './gallery-room.js';
import {createGalleryDoor,createGalleryDoorframe} from './gallery-door.js';
import {addStudioKeepsakes,createDoorstop} from './studio-keepsakes.js';

/** The approved doorway and installation are one scene, with one camera. */
export async function createGalleryScene(renderer, { homepageCanvas, computerCanvas } = {}) {
  const textures = new Set();
  const loader = new THREE.TextureLoader();
  const loaded = await Promise.allSettled([
    '/artwork/thesis-elongated.webp',
    '/artwork/thesis-painting.webp',
    '/artwork/thesis-dark-grid.webp',
    ...(computerCanvas ? ['/artwork/train-scan.webp','/artwork/train-scan-wide.webp','/artwork/train-scan-notice.webp'] : []),
  ].map(async (url,index) => {
    const texture = await loader.loadAsync(url);
    // These tiny paper objects need sharp small textures, not three additional
    // full-size GPU images on a phone. Keep the source's aspect ratio.
    if(index>=3) {
      const image=texture.image,canvas=document.createElement('canvas');
      const factor=Math.min(1,384/Math.max(image.width,image.height));
      canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);texture.image=canvas;texture.needsUpdate=true;
    }
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
  scene.background = new THREE.Color('#080809');
  const camera = new THREE.PerspectiveCamera(48,1,.03,55);
  camera.position.set(.2,1.6,8);
  camera.lookAt(0,1.58,-2);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  scene.add(new THREE.HemisphereLight('#f7f8f7','#81796c',1.45));
  const key = new THREE.DirectionalLight('#f5f5f0',1.1);
  key.position.set(.8,5.8,5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-6,right:6,top:8,bottom:-6});
  key.shadow.bias = -.0005;
  scene.add(key);
  key.shadow.normalBias = .017;
  key.shadow.radius = 3;
  const fill = new THREE.PointLight('#fffbef',12,12,2);
  fill.position.set(-.22,3.45,.25);
  scene.add(fill);
  const backFill = new THREE.PointLight('#f9f8f0',7,6,2);
  backFill.position.set(-.22,3.45,-2.85);scene.add(backFill);

  const material = (color, roughness=.9) => new THREE.MeshStandardMaterial({color,roughness});
  const outside=material('#292b28');
  function box(w,h,d,mat,x,y,z,parent=scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const architecture = createGalleryArchitecture(scene, renderer);

  // Solid front wall surrounds a real aperture. Its jamb passes the viewer
  // during entry; no image swap or curtain conceals the camera's movement.
  const homepageBlack = new THREE.MeshBasicMaterial({color:'#080809',toneMapped:false});
  // BoxGeometry's last material is its -Z face: the side seen from inside.
  // Its outside-facing surface keeps the approved graphite entrance finish.
  const outsideFaces = [outside,outside,outside,outside,outside,homepageBlack];
  box(8,7,.3,outsideFaces,-4.86,3.5,3.7);
  box(8,7,.3,outsideFaces,4.86,3.5,3.7);
  box(1.74,4.196,.3,outsideFaces,0,4.902,3.7);
  const exteriorFloor=box(16,.12,7,material('#1d211b'),0,-.1,7.1);
  const doorframe=createGalleryDoorframe();scene.add(doorframe);

  const {door,handle,plaque} = createGalleryDoor();
  door.position.set(-.84,0,3.69);
  scene.add(door);
  const doorstop=createDoorstop();doorstop.position.set(-1.045,0,2.005);doorstop.rotation.y=.14;scene.add(doorstop);
  const artworks=[];
  function art(id,title,w,h,x,y,z,rotation,map,pose) {
    const group=new THREE.Group();
    group.position.set(x,y,z); group.rotation.y=rotation; scene.add(group);
    architecture.addArtworkContact(group,w,h,rotation === 0 ? z + 4.4 : 1.91 - Math.abs(x));
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
    computer.keepsakes=addStudioKeepsakes(computer.group,maps.slice(3));
    computer.group.position.set(1.40,0,3.02);
    computer.group.rotation.y=Math.PI;
    computer.group.scale.setScalar(.9);
    scene.add(computer.group);
    scene.updateMatrixWorld(true);
  }

  let disposed=false;
  return {
    scene,camera,door,handle,plaque,doorframe,doorstop,architecture,artworks,homepageTexture,computer,
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
