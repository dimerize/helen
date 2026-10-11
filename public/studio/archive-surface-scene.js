import * as T from './vendor/three.module.min.js';
import {archiveItems as items} from './archive-data.js';
import {archiveRoomLayout,archiveRoomCamera,constrainArchiveMove} from './archive-room-layout.js';
import {registerStudioSurface} from './separated-journey.js';

let instance;
export async function createArchiveSurfaceScene(){
 if(instance)return instance;
 instance=buildRoom().catch(error=>{instance=null;throw error;});
 return instance;
}
async function buildRoom(){
 const section=document.querySelector('#archive-surface'),host=document.querySelector('#archive-room-view');
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 host.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#080809');
 const camera=new T.PerspectiveCamera(39,1,.08,220),target=new T.Vector3(),resources=new Set();
 const room=new T.Group();room.name='Archive: walls, workbench and loose material';scene.add(room);
 const placements=archiveRoomLayout(items),works=new Map(),hits=[];
 let frozen=false,active=false,dirty=true,zoom=1,pan=new T.Vector3(),frame=0,drag=null,hover=null,mode='room';
 let pose,moveMode=false,pinch=null;
 const pointers=new Map(),ray=new T.Raycaster(),pointer=new T.Vector2();
 const own=x=>(resources.add(x),x);
 const mat=(color,roughness=.85,metalness=0)=>own(new T.MeshStandardMaterial({color,roughness,metalness}));
 const wall=mat('#20221e'),floor=mat('#101210'),bench=mat('#252822',.72,.14),rail=mat('#3b4137',.53,.5),dark=mat('#0c100d'),clip=mat('#626957',.52,.6);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);
 let seed=1777;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const n=105+(seed>>>25);pixels.data.set([n,n,n,255],i);}
 ctx.putImageData(pixels,0,0);const grain=own(new T.CanvasTexture(canvas));grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(6,3);
 wall.bumpMap=grain;wall.bumpScale=.012;floor.bumpMap=grain;floor.bumpScale=.018;
 function box(w,h,d,x,y,z,material,parent=room){const m=new T.Mesh(own(new T.BoxGeometry(w,h,d)),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 // This is a finite, dimly lit architectural fragment within the site's black
 // space, not a full-screen grey floor or a grid extending between destinations.
 box(23,.16,16,0,-.14,1.8,floor);
 box(20,6.75,.2,0,3.275,-4.55,wall);
 box(.18,6.75,4.4,-10.02,3.275,-2.25,wall);
 box(.18,6.75,2.7,10.02,3.275,-3.1,wall);
 box(20,.13,.06,0,.04,-4.4,rail);
 box(19.6,.045,.07,0,6.1,-4.4,rail);
 box(15.7,.12,4.5,0,.8,.75,bench);
 box(15.7,.035,.04,0,.86,3.01,rail);
 for(const x of [-7.3,-2.5,2.5,7.3])for(const z of [-1.1,2.55])box(.065,.82,.065,x,.32,z,rail);
 // Shallow flat-file drawers beneath the bench, leaving the floor legible.
 for(const x of [-4.4,.0]){
  box(3.5,.65,2.7,x,.33,.3,dark);
  for(let row=0;row<3;row++){
   box(3.4,.19,.05,x,.11+row*.2,1.68,bench);
   box(.6,.025,.065,x,.16+row*.2,1.725,rail);
  }
 }
 const hemisphere=new T.HemisphereLight('#b1bab6','#171911',1.2);scene.add(hemisphere);
 const key=new T.DirectionalLight('#d9d5c4',2.4);key.position.set(-5,11,9);key.castShadow=true;
 key.shadow.mapSize.set(1536,1536);Object.assign(key.shadow.camera,{left:-13,right:13,top:12,bottom:-12,near:.5,far:38});key.shadow.bias=-.0003;key.shadow.normalBias=.04;scene.add(key);
 const fill=new T.DirectionalLight('#7d8f91',.6);fill.position.set(8,6,2);scene.add(fill);
 for(const x of [-5.1,4.8]){
  box(4.3,.065,.23,x,6.22,-4.15,dark);
  box(4.05,.018,.12,x,6.176,-4.13,own(new T.MeshStandardMaterial({color:'#b9b095',emissive:'#b9ad8b',emissiveIntensity:.48})));
  const light=new T.SpotLight('#e5d8b7',21,13,1.12,.85,2);light.position.set(x,6.12,-3.78);light.target.position.set(x,2.2,-4.35);scene.add(light,light.target);
 }
 const loader=new T.TextureLoader();
 const textures=await Promise.all(items.map(async item=>{const t=await loader.loadAsync('/artwork/'+item.image);t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return own(t);}));
 const cableMat=own(new T.LineBasicMaterial({color:'#595f51',transparent:true,opacity:.65}));
 for(const [i,item] of items.entries()){
  const p=placements[i],g=new T.Group(),w=p.width,h=p.height;
  g.name=item.title;g.position.fromArray(p.position);
  g.rotation.set(p.surface==='wall'?0:p.surface==='lean'?-.19:-Math.PI/2,0,p.angle);
  room.add(g);
  box(w+.12,h+.12,.042,0,0,-.033,dark,g);
  const picture=new T.Mesh(own(new T.PlaneGeometry(w,h)),own(new T.MeshBasicMaterial({map:textures[i],toneMapped:false,color:'#dadbd4'})));
  picture.position.z=.001;picture.userData.artId=item.id;g.add(picture);hits.push(picture);
  // Narrow graphite rails and real clips, quiet enough for the source to lead.
  for(const x of [-1,1])box(.044,h+.12,.07,x*(w/2+.037),0,0,rail,g);
  for(const y of [-1,1])box(w+.12,.038,.07,0,y*(h/2+.039),0,rail,g);
  for(const x of [-1,1])box(.105,.065,.035,x*(w/2-.12),h/2-.09,.033,clip,g);
  let suspension=null;
  if(p.surface==='wall'){
   suspension=new T.LineSegments(own(new T.BufferGeometry().setFromPoints(Array.from({length:4},()=>new T.Vector3()))),cableMat);room.add(suspension);
  }
  works.set(item.id,{item,placement:p,group:g,picture,suspension});
 }
 function updateWires(){
  room.updateMatrixWorld(true);
  for(const w of works.values())if(w.suspension){
   const pts=w.suspension.geometry.attributes.position;
   for(const [i,x] of [-.32,.32].entries()){
    const top=w.group.localToWorld(new T.Vector3(x*w.placement.width,w.placement.height/2+.035,0));
    pts.setXYZ(i*2,top.x,6.1,-4.37);pts.setXYZ(i*2+1,top.x,top.y,top.z);
   }
   pts.needsUpdate=true;w.suspension.geometry.computeBoundingSphere();
  }
 }
 const vertices=[[-1,1],[1,1],[1,-1],[-1,-1]];
 function projectButtons(){
  if(mode!=='room')return;
  camera.updateMatrixWorld();room.updateMatrixWorld(true);
  const width=host.clientWidth,height=host.clientHeight;
  for(const w of works.values()){
   const button=document.querySelector(`#image-space [data-id="${w.item.id}"]`);if(!button)continue;
   const points=vertices.map(([x,y])=>w.group.localToWorld(new T.Vector3(x*(w.placement.width/2+.07),y*(w.placement.height/2+.07),.05)).project(camera)).map(v=>[(v.x+1)*width/2,(1-v.y)*height/2]);
   const left=Math.min(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1]));
   const bw=Math.max(...points.map(p=>p[0]))-left,bh=Math.max(...points.map(p=>p[1]))-top;
   Object.assign(button.style,{left:left+'px',top:top+'px',width:bw+'px',height:bh+'px',transform:'none',clipPath:`polygon(${points.map(([x,y])=>`${(x-left)/bw*100}% ${(y-top)/bh*100}%`).join(',')})`});
   button.dataset.worldPosition=w.group.position.toArray().map(n=>n.toFixed(3)).join(',');
   button.dataset.support=w.placement.surface;
  }
 }
 function setCamera(){
  pose=archiveRoomCamera(camera.aspect);target.fromArray(pose.target).add(pan);
  camera.position.fromArray(pose.position).sub(new T.Vector3(...pose.target)).multiplyScalar(zoom).add(target);
  camera.lookAt(target);camera.updateMatrixWorld();dirty=true;
 }
 function resize(){
  const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();setCamera();
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function render(){if(!dirty)return;updateWires();renderer.render(scene,camera);projectButtons();dirty=false;}
 function tick(){frame=requestAnimationFrame(tick);if(active&&!frozen&&!document.hidden&&mode==='room')render();}
 function inspect(id){document.dispatchEvent(new CustomEvent('studio:archive-inspect',{detail:{id}}));}
 function setRay(e){const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);}
 function pick(e){setRay(e);return ray.intersectObjects(hits)[0];}
 function dragPlane(w){return w.placement.surface==='wall'?new T.Plane(new T.Vector3(0,0,1),-w.group.position.z):new T.Plane(new T.Vector3(0,1,0),-w.group.position.y);}
 function cancelDrag(){drag=null;pinch=null;pointers.clear();host.classList.remove('is-dragging');}
 const clamp=T.MathUtils.clamp;
 host.addEventListener('pointerdown',e=>{
  if(e.button!==0||frozen)return;
  e.preventDefault();host.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===2){const a=[...pointers.values()];pinch={distance:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),zoom};drag=null;return;}
  const hit=pick(e),work=hit?works.get(hit.object.userData.artId):null,plane=work?dragPlane(work):null;
  drag={id:e.pointerId,start:[e.clientX,e.clientY],pan:pan.clone(),work,plane,anchor:plane?ray.ray.intersectPlane(plane,new T.Vector3()):null,origin:work?.group.position.clone(),moved:false};
 });
 host.addEventListener('pointermove',e=>{
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pinch&&pointers.size===2){const a=[...pointers.values()];zoom=clamp(pinch.zoom*pinch.distance/Math.max(1,Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])),.36,1.1);setCamera();return;}
  if(!drag){const id=pick(e)?.object.userData.artId||null;if(hover!==id){hover=id;host.style.cursor=id?'grab':'default';}return;}
  if(e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.start[0],dy=e.clientY-drag.start[1];if(Math.hypot(dx,dy)<5&&!drag.moved)return;
  drag.moved=true;host.classList.add('is-dragging');
  if(drag.work&&drag.anchor){
   setRay(e);const point=ray.ray.intersectPlane(drag.plane,new T.Vector3());if(!point)return;
   const next=drag.origin.clone().add(point.sub(drag.anchor));drag.work.group.position.fromArray(constrainArchiveMove(drag.work.placement,next.toArray()));dirty=true;
  }else{
   const scale=pose.distance*zoom*2*Math.tan(camera.fov*Math.PI/360)/host.clientHeight;
   pan.x=clamp(drag.pan.x-dx*scale,-7,7);pan.z=clamp(drag.pan.z-dy*scale,-4,4);setCamera();
  }
 });
 host.addEventListener('pointerup',e=>{
  const down=drag;pointers.delete(e.pointerId);
  if(!pinch&&down?.id===e.pointerId&&!down.moved&&down.work&&!moveMode)inspect(down.work.item.id);
  if(!pointers.size)cancelDrag();else {drag=null;pinch=null;}
 });
 host.addEventListener('pointercancel',cancelDrag);host.addEventListener('lostpointercapture',()=>{if(!pointers.size)cancelDrag();});
 host.addEventListener('wheel',e=>{if(mode!=='room')return;e.preventDefault();zoom=clamp(zoom*Math.exp(e.deltaY*.001),.36,1.1);setCamera();},{passive:false});
 host.addEventListener('dblclick',()=>{zoom=1;pan.set(0,0,0);setCamera();});
 document.querySelector('#image-space').addEventListener('focusin',e=>{const id=e.target.closest('[data-id]')?.dataset.id;for(const w of works.values())w.picture.material.color.set(w.item.id===id?'#ffffff':'#dadbd4');dirty=true;});
 document.querySelector('#image-space').addEventListener('focusout',()=>{for(const w of works.values())w.picture.material.color.set('#dadbd4');dirty=true;});
 const controls=document.createElement('div');controls.className='archive-camera-controls';
 for(const [label,path,action] of [
  ['Look closer','M6 12h12M12 6v12',()=>{zoom=clamp(zoom*.8,.36,1.1);setCamera();}],
  ['Look further away','M6 12h12',()=>{zoom=clamp(zoom/ .8,.36,1.1);setCamera();}],
  ['Whole room','M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',()=>{zoom=1;pan.set(0,0,0);setCamera();}],
 ]){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;b.addEventListener('click',action);controls.append(b);}
 section.append(controls);
 const api={scene,camera,exposure:1.12,shading:false,
  viewport:()=>host.getBoundingClientRect(),
  get distance(){return camera.position.distanceTo(target);},
  freeze(){frozen=true;cancelDrag();},
  release(){frozen=false;active=document.body.dataset.studioRoute==='archive';dirty=true;render();},
  prepare(){active=true;resize();dirty=true;render();},
  setView(next){mode=next;section.classList.toggle('is-room',next==='room');dirty=true;requestAnimationFrame(()=>{resize();render();});},
  reset(){cancelDrag();for(const w of works.values())w.group.position.fromArray(w.placement.position);zoom=1;pan.set(0,0,0);setCamera();},
  focusProject(project){for(const w of works.values())w.picture.material.color.set(!project||w.item.project===project?'#dadbd4':'#62655e');dirty=true;},
  setMoveMode(value){moveMode=value;},
  moveItem(id,dx,dy){const w=works.get(id);if(!w)return;const pos=w.group.position.clone();pos.x+=dx;if(w.placement.surface==='wall')pos.y-=dy;else pos.z+=dy;w.group.position.fromArray(constrainArchiveMove(w.placement,pos.toArray()));dirty=true;},
  project:()=>{dirty=true;render();},
  deactivate(){active=false;cancelDrag();},
  dispose(){cancelAnimationFrame(frame);observer.disconnect();resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();unregister();},
 };
 const unregister=registerStudioSurface('archive',api);
 document.addEventListener('studio:archive-open',()=>{active=true;dirty=true;render();});
 document.addEventListener('studio:archive-leave',()=>api.deactivate());
 addEventListener('blur',cancelDrag);
 addEventListener('pagehide',event=>{if(event.persisted)api.deactivate();else api.dispose();});
 addEventListener('pageshow',event=>{if(event.persisted){active=document.body.dataset.studioRoute==='archive';dirty=true;if(active){resize();render();}}});
 section.classList.add('has-spatial-room','is-room');dirty=true;render();tick();
 return api;
}
