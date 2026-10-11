import * as THREE from './vendor/three.module.min.js';
import {RoundedBoxGeometry} from './vendor/rounded-box.js';

// All dimensions are metres. Surfaces use deterministic, low-contrast grain;
// the visible edges and fasteners are geometry, not painted-on highlights.
export function grainTexture(seed = 42, brushed = false) {
  const n = 128, pixels = new Uint8Array(n * n * 4);
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<n;y++) {
    const line = (random()-.5)*32;
    for(let x=0;x<n;x++) {
      const value = 128 + (brushed ? line+(random()-.5)*12 : (random()-.5)*65);
      const i=(y*n+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;
    }
  }
  const texture = new THREE.DataTexture(pixels,n,n);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
export function detailKit() {
  const grain=grainTexture(), brushed=grainTexture(17,true);
  const paint=new THREE.MeshStandardMaterial({color:'#343832',roughness:.72,bumpMap:grain,bumpScale:.00038});
  const nickel=new THREE.MeshStandardMaterial({color:'#8b9087',roughness:.43,metalness:.65,bumpMap:brushed,bumpScale:.00005});
  const dark=new THREE.MeshStandardMaterial({color:'#252a27',roughness:.83});
  const cream=new THREE.MeshStandardMaterial({color:'#d4d4c8',roughness:.78,bumpMap:grain,bumpScale:.00015});
  function mesh(parent,geometry,material,position,name) {
    const m=new THREE.Mesh(geometry,material);m.position.fromArray(position);m.name=name;
    m.castShadow=m.receiveShadow=true;parent.add(m);return m;
  }
  function box(parent,size,position,material,name,radius=.001) {
    return mesh(parent,new RoundedBoxGeometry(...size,2,Math.min(radius,...size.map(v=>v/2))),material,position,name);
  }
  function cylinder(parent,radius,length,position,material,name) {
    return mesh(parent,new THREE.CylinderGeometry(radius,radius,length,16),material,position,name);
  }
  // +Z is the surface normal. A narrow negative slot sits on a domed head.
  function screw(parent,position,radius=.003,angle=.3,material=nickel) {
    const g=new THREE.Group();g.name='Slotted fixing';g.position.fromArray(position);g.rotation.z=angle;parent.add(g);
    const head=cylinder(g,radius,radius*.3,[0,0,0],material,'Countersunk head');head.rotation.x=Math.PI/2;
    box(g,[radius*1.24,radius*.20,radius*.08],[0,0,radius*.18],dark,'Cut screwdriver slot',radius*.05);
    return g;
  }
  function tube(parent,points,radius,material,name) {
    return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),28,radius,8,false),material,[0,0,0],name);
  }
  return {paint,nickel,dark,cream,grain,brushed,mesh,box,cylinder,screw,tube};
}

/** Batch immobile fittings by material; movable handles and named models stay separate. */
export function batchStaticDetails(root, excluded=[]) {
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(), groups=new Map(), excludedSet=new Set(excluded);
  function collect(object) {
    if(excludedSet.has(object)) return;
    if(object.isMesh && !object.isInstancedMesh && !Array.isArray(object.material)) {
      const key=object.material;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(object);
    } else for(const child of object.children) collect(child);
  }
  for(const child of root.children) collect(child);
  for(const [material,meshes] of groups) {
    if(meshes.length<2) continue;
    const pieces=meshes.map(m=>{
      const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
      return g.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    });
    const merged=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv']) {
      if(!pieces.every(g=>g.hasAttribute(name))) continue;
      const array=new Float32Array(pieces.reduce((sum,g)=>sum+g.getAttribute(name).array.length,0));let offset=0;
      for(const g of pieces){array.set(g.getAttribute(name).array,offset);offset+=g.getAttribute(name).array.length;}
      merged.setAttribute(name,new THREE.BufferAttribute(array,pieces[0].getAttribute(name).itemSize));
    }
    const batch=new THREE.Mesh(merged,material);batch.name='Batched stationary fittings';
    batch.castShadow=meshes.some(m=>m.castShadow);batch.receiveShadow=meshes.some(m=>m.receiveShadow);
    root.add(batch);
    const originals=new Set();
    for(const mesh of meshes){originals.add(mesh.geometry);mesh.removeFromParent();}
    for(const g of originals)g.dispose();
    for(const g of pieces)g.dispose();
  }
  return root;
}
