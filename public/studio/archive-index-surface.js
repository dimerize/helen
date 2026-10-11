import * as T from './vendor/three.module.min.js';
import {archiveCameraFrame,archiveCardGeometry,measureArchiveImage} from './archive-camera-travel.js';

// Index is intentionally a flat catalogue. Its individual images get their
// own calibrated planes during travel; the room remains a persistent 3D scene.
export async function createArchiveIndexSurface(){
 const images=[...document.querySelectorAll('#archive-surface .fragment img')].filter(image=>{const r=image.getBoundingClientRect();return r.width>0&&r.bottom>0&&r.top<innerHeight;});
 await Promise.allSettled(images.map(image=>image.decode()));
 const scene=new T.Scene(),frame=archiveCameraFrame(innerWidth,innerHeight),resources=new Set();
 const camera=new T.PerspectiveCamera(frame.fov,innerWidth/innerHeight,frame.near,frame.far);camera.position.z=frame.distance;
 for(const image of images){
  if(!image.naturalWidth)continue;
  const p=archiveCardGeometry({...measureArchiveImage(image,0),depth:0},frame);
  const texture=new T.Texture(image);texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
  const material=new T.MeshBasicMaterial({map:texture,toneMapped:false}),geometry=new T.PlaneGeometry(p.width,p.height);
  resources.add(texture);resources.add(material);resources.add(geometry);
  const mesh=new T.Mesh(geometry,material);mesh.position.set(p.x,p.y,0);mesh.rotation.z=p.rotation;scene.add(mesh);
 }
 return {scene,camera,exposure:1,distance:frame.distance,temporary:true,dispose(){resources.forEach(r=>r.dispose());}};
}
