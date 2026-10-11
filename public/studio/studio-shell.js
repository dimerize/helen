import * as THREE from './vendor/three.module.min.js';
import {studioSurfaces,journeySample} from './separated-journey.js';
import {spatialRoute} from './spatial-navigation.js';

const home=document.querySelector('#experience'),archive=document.querySelector('#archive-surface');
const axis={archive:-1,home:0,gallery:1};
let current='home',busy=false,archiveModule,travelRenderer,viewportDirty=false;
let settledURL=location.href,pendingHistory=null;
const journey=document.createElement('dialog');journey.id='studio-journey';journey.setAttribute('aria-label','Moving through the studio');journey.addEventListener('cancel',e=>e.preventDefault());document.body.append(journey);
const shading=document.createElement('div');shading.className='vignette';shading.setAttribute('aria-hidden','true');
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function waitFor(name,ready){return ready()?Promise.resolve():new Promise(resolve=>document.addEventListener(name,resolve,{once:true}));}
function urlFor(target){return new URL(target==='home'?'/':target==='archive'?'/archive':target==='gallery'?'/?room=gallery':target,location.href);}
async function prepare(route){
 if(route==='home'){await waitFor('studio:home-ready',()=>studioSurfaces.has('home')||document.body.dataset.mode==='error');studioSurfaces.get('home')?.prepare?.();}
 if(route==='archive'){
  archive.hidden=false;archive.classList.add('is-preparing');
  archiveModule ||= import('./archive.js').catch(error=>{archiveModule=null;throw error;});const module=await archiveModule;await module.roomReady;
  studioSurfaces.get('archive')?.prepare?.();
  document.dispatchEvent(new CustomEvent('studio:archive-open',{detail:{}}));
  await nextFrame();await nextFrame();
 }
 if(route==='gallery'){
  await waitFor('studio:portal-ready',()=>window.studioPortal);
  await window.studioPortal.prepare();
 }
}
async function surface(route){
 if(route==='archive'&&studioSurfaces.has('archive')&&!archive.classList.contains('is-room')){const {createArchiveIndexSurface}=await import('./archive-index-surface.js');return createArchiveIndexSurface();}
 return studioSurfaces.get(route);
}
function activate(route,url,{inApp=false}={}){
 if(route!=='gallery'&&document.querySelector('#studio-portal').open)window.studioPortal.close();
 home.classList.toggle('is-away',route!=='home');home.inert=route!=='home';
 archive.hidden=route!=='archive';archive.classList.remove('is-preparing');archive.inert=route!=='archive';
 if(route==='gallery')window.studioPortal.show();
 scrollTo({top:0,behavior:'instant'});
 current=route;document.body.dataset.studioRoute=route;
 if(route==='archive')document.dispatchEvent(new CustomEvent('studio:archive-open',{detail:{scan:url.searchParams.get('scan'),inApp}}));
 document.title=route==='archive'?'Archive · Helen Zhang':'Helen Zhang';
}
function getRenderer(){
 if(travelRenderer)return travelRenderer;
 const r=travelRenderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 r.setClearColor('#080809');r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.autoClear=false;
 journey.append(r.domElement,shading);return r;
}
function leg(surface){
 const camera=surface.camera.clone();camera.updateMatrixWorld();
 const origin=camera.position.clone(),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),backward=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
 const distance=surface.distance||origin.length();
 const width=2*distance*Math.tan(camera.fov*Math.PI/360)*camera.aspect;
 return {surface,camera,origin,right,backward,width,viewport:surface.viewport?.()};
}
async function move(from,to,direction,{nearby=false}={}){
 const r=getRenderer();r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.setSize(innerWidth,innerHeight,false);
 from.freeze?.();to.freeze?.();
 let a=leg(from),b=leg(to);
 const draw=(l,offset,retreat)=>{
  const {surface:s,camera}=l;
  camera.position.copy(l.origin).addScaledVector(l.right,offset*l.width*direction).addScaledVector(l.backward,retreat*l.width);
  camera.updateMatrixWorld();
  const box=l.viewport;r.setViewport(box?.left||0,box?innerHeight-box.bottom:0,box?.width||innerWidth,box?.height||innerHeight);
  const background=s.scene.background;s.scene.background=null;r.toneMappingExposure=s.exposure;
  r.clearDepth();r.render(s.scene,camera);s.scene.background=background;
 };
 await Promise.all([r.compileAsync(from.scene,a.camera),r.compileAsync(to.scene,b.camera)]);
 // Warm textures, render targets and shader paths while the source is still visible.
 r.clear();draw(a,0,0);draw(b,-2.05,0);r.clear();draw(a,0,0);
 shading.style.opacity=from.shading?'1':'0';shading.style.height=`${(from.viewport?.()||to.viewport?.())?.height||innerHeight}px`;
 document.body.dataset.studioTravel='moving';journey.showModal();
 const duration=nearby?3100:3700;let start,previous;const frameTimes=[];
 await new Promise(resolve=>{
  function tick(now){
   if(viewportDirty){
    viewportDirty=false;r.setSize(innerWidth,innerHeight,false);
    from.prepare?.();to.prepare?.();a=leg(from);b=leg(to);
    shading.style.height=`${(from.viewport?.()||to.viewport?.())?.height||innerHeight}px`;
   }
   if(previous)frameTimes.push(now-previous);previous=now;start??=now;const p=Math.min(1,(now-start)/duration),v=journeySample(p);
   r.clear();if(p<1)draw(a,v.outgoing,v.retreat);if(p>0)draw(b,v.incoming,v.retreat);
   shading.style.opacity=String(from.shading?Math.max(0,1-p*2):to.shading?Math.max(0,(p-.5)*2):0);
   journey.dataset.progress=p.toFixed(3);
   if(p<1)requestAnimationFrame(tick);else {const sorted=frameTimes.sort((a,b)=>a-b);journey.dataset.frameP95=String(Math.round(sorted[Math.floor(sorted.length*.95)]||0));resolve();}
  }
  requestAnimationFrame(tick);
 });
}
async function go(target,{historyEntry=true,initial=false,handoff=false}={}){
 const url=urlFor(target),to=spatialRoute(url.href,location.href),from=current;
 if(!to||busy)return false;
 if(to===from&&!initial){if(to==='archive')document.dispatchEvent(new CustomEvent('studio:archive-open',{detail:{scan:url.searchParams.get('scan')}}));return false;}
 busy=true;viewportDirty=false;let source,destination;
 try{
  // Finish crossing the real threshold before lateral travel begins.
  if(!initial)await studioSurfaces.get(from)?.retreat?.();
  if(from==='archive'&&!initial)document.dispatchEvent(new CustomEvent('studio:archive-leave'));
  if(!initial){source=await surface(from);if(from==='home')source?.deactivate?.();}
  await prepare(to);destination=await surface(to);
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.dataset.motion==='reduced';
  if(!initial&&!handoff&&!reduced&&source&&destination)await move(source,destination,Math.sign(axis[to]-axis[from]),{nearby:[from,to].every(route=>route!=='gallery')});
  if(historyEntry&&!initial&&!pendingHistory)history.pushState({studioRoute:to},'',url);
  if(from!==to)source?.deactivate?.();
  activate(to,url,{inApp:!initial});settledURL=url.href;
  // The live surface resumes at the exact camera used for the last travel frame.
  destination?.release?.();await nextFrame();
  journey.close();delete document.body.dataset.studioTravel;
  source?.release?.();
  if(to==='home'&&url.searchParams.get('explore')==='1')destination?.enterScan(url.searchParams.get('scan'));
  if(to!=='gallery')document.querySelector(to==='home'?'#home-link':'#archive-surface nav [aria-current]')?.focus({preventScroll:true});
  return true;
 }catch(error){
  console.error('Studio navigation:',error);activate(from,new URL(settledURL));journey.close();delete document.body.dataset.studioTravel;source?.release?.();destination?.release?.();return false;
 }finally{if(source?.temporary)source.dispose();if(destination?.temporary)destination.dispose();busy=false;
  if(pendingHistory){const next=pendingHistory;pendingHistory=null;queueMicrotask(()=>go(next,{historyEntry:false}));}
 }
}
window.studioShell={go,get route(){return current;},get busy(){return busy;}};
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href]');
 if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
 const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.hash)return;
 if(!spatialRoute(url.href,location.href)||['entering','world','leaving'].includes(document.body.dataset.mode))return;
 event.preventDefault();go(url.href,{handoff:link.classList.contains('print-archive-link')});
});
addEventListener('popstate',()=>{const route=spatialRoute(location.href,location.href);if(busy){pendingHistory=location.href;return;}if(route&&route!==current)go(location.href,{historyEntry:false});});
addEventListener('resize',()=>{if(busy)viewportDirty=true;});
addEventListener('pagehide',()=>{travelRenderer?.dispose();travelRenderer=null;});
const initialRoute=spatialRoute(location.href,location.href);
if(initialRoute&&initialRoute!=='home')go(location.href,{historyEntry:false,initial:true});
else document.body.dataset.studioRoute='home';
