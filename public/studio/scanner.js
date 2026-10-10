import * as THREE from './vendor/three.module.min.js';
import { animate as springAnimate } from './vendor/motion.js';

const scans = [
  {image:'train-scan.webp',title:'Found on the train',alt:'Red exit and caution lettering, distorted by a handheld scan'},
  {image:'train-scan-wide.webp',title:'A surface, passing through',alt:'Worn yellow train lettering stretched across a scan'},
  {image:'train-scan-notice.webp',title:'Signs of use',alt:'A train notice recorded in a handheld scan'}
];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mount = document.querySelector('#scanner-scene');
const pause = document.querySelector('#pause-motion');
let paused = reduced.matches;
let scanIndex = 0;
let elapsed = 3.6;
let renderScene = () => {};
let frame = 0;
let previous = 0;
let pointer = {x:0,y:0};
let galleryOpen = false;
let sceneReady = false;
pause.textContent = paused ? 'Resume motion' : 'Pause motion';
pause.setAttribute('aria-pressed',String(paused));
pause.addEventListener('click',()=>{
  paused=!paused;
  pause.textContent=paused?'Resume motion':'Pause motion';
  pause.setAttribute('aria-pressed',String(paused));
});
reduced.addEventListener('change', e=>{paused=e.matches;pause.textContent=paused?'Resume motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));});
mount.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!reduced.matches){const r=mount.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width-.5;pointer.y=(e.clientY-r.top)/r.height-.5;}});
mount.addEventListener('pointerleave',()=>{pointer={x:0,y:0};});
function updateCaption(){document.querySelector('#scan-caption').textContent=scans[scanIndex].title;document.querySelector('#scan-count').textContent=`${scanIndex+1} / ${scans.length}`;}

async function createScene(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.setClearColor(0x080809,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.3;
  mount.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(39,1,.1,100);
  const rig=new THREE.Group(); scene.add(rig);
  scene.add(new THREE.HemisphereLight(0xbab8d0,0x151518,3.2));
  const key=new THREE.DirectionalLight(0xfff2e9,7); key.position.set(-5,9,5); scene.add(key);
  const edge=new THREE.DirectionalLight(0x8f95c7,5);edge.position.set(5,3,-6);scene.add(edge);
  const near=new THREE.DirectionalLight(0xffffff,2);near.position.set(1,4,9);scene.add(near);
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
  const loader=new THREE.TextureLoader();
  const textures=await Promise.all(scans.map(s=>loader.loadAsync('/artwork/'+s.image)));
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
  let targetAspect=1;
  const resize=()=>{const w=mount.clientWidth,h=mount.clientHeight;targetAspect=w/h;renderer.setSize(w,h,false);camera.aspect=targetAspect;const narrow=w<700;const factor=narrow?Math.max(1,1.35/targetAspect):1;camera.position.set(narrow?0:.65,8.3*factor,10.4*factor);camera.lookAt(narrow?0:.3,narrow?1.8:0,0);camera.updateProjectionMatrix();rig.position.x=narrow?0:1.0;rig.rotation.y=narrow?-.12:-.18;rig.rotation.z=narrow?-.055:-.035;};
  new ResizeObserver(resize).observe(mount);resize();
  mount.classList.add('is-webgl');
  renderScene=(time)=>{
    const cycle=14.5;
    const next=Math.floor(time/cycle)%scans.length;
    if(next!==scanIndex){scanIndex=next;uniform.map.value=textures[next];uniform.imageAspect.value=textures[next].image.width/textures[next].image.height;updateCaption();}
    const phase=(time%cycle)/cycle;
    // A long even traverse and a brief return, independent of scrolling or the cursor.
    const progress=phase<.83?1-phase/.83:Math.pow((phase-.83)/.17,.6);
    uniform.progress.value=progress;
    wand.position.z=(.5-progress)*6.24;
    rig.rotation.y+=((targetAspect<1?-.12:-.18)+pointer.x*.075-rig.rotation.y)*.03;
    renderer.render(scene,camera);
  };
  renderScene(elapsed);
}
function animate(now){const dt=previous?Math.min((now-previous)/1000,.06):0;previous=now;if(!paused)elapsed+=dt;renderScene(elapsed);frame=requestAnimationFrame(animate);}
function resumeScanner(){if(sceneReady&&!frame&&!galleryOpen&&!document.hidden){previous=0;frame=requestAnimationFrame(animate);}}
function suspendScanner(){cancelAnimationFrame(frame);frame=0;previous=0;}
createScene().then(()=>{sceneReady=true;galleryOpen=document.body.classList.contains('studio-open');resumeScanner();}).catch(error=>{console.warn('Scanner uses its still-image fallback:',error.message);document.querySelector('#pause-motion').hidden=true;});
document.addEventListener('visibilitychange',()=>{document.hidden?suspendScanner():resumeScanner();});
document.addEventListener('studio:gallery',event=>{galleryOpen=event.detail.open;galleryOpen?suspendScanner():resumeScanner();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
window.addEventListener('pageshow',event=>{if(event.persisted)resumeScanner();});

let printNumber=0;
document.querySelector('#lift-scan').addEventListener('click',()=>{
  const layer=document.querySelector('#print-layer');
  if(layer.children.length>=3)layer.firstElementChild.remove();
  const item=scans[scanIndex];const card=document.createElement('article');card.className='loose-print';
  const n=printNumber++;
  card.style.left=`${Math.min(Math.max(18,innerWidth*.48+(n%3)*34),innerWidth-245)}px`;
  card.style.top=`${Math.max(70,(layer.clientHeight-350)*.32+(n%3)*22)}px`;
  card.style.setProperty('--turn',`${[-7,6,-2][n%3]}deg`);
  card.innerHTML='<div class="print-handle" tabindex="0" role="group" aria-label="Move loose scan with arrow keys"><span>Fresh from the scanner</span><button class="print-close" aria-label="Put scan away"><span class="ui-icon icon-close" aria-hidden="true"></span></button></div><img><a href="/archive"><span>Find it in the archive</span><span class="ui-icon icon-arrow-up-right" aria-hidden="true"></span></a>';
  const img=card.querySelector('img');img.src='/artwork/'+item.image;img.alt=item.alt;
  card.querySelector('.print-close').addEventListener('click',async()=>{if(!reduced.matches)await springAnimate(card,{opacity:0,y:18,scale:.96},{type:'spring',visualDuration:.2,bounce:0});card.remove();document.querySelector('#lift-scan').focus();});
  layer.append(card);
  if(!reduced.matches)springAnimate(card,{opacity:[0,1],y:[52,0],rotate:[0,[-7,6,-2][n%3]],scale:[.9,1]},{type:'spring',visualDuration:.48,bounce:.12});
  const handle=card.querySelector('.print-handle');handle.focus();
  let origin=null;
  handle.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;origin={x:e.clientX,y:e.clientY,left:card.offsetLeft,top:card.offsetTop};handle.setPointerCapture(e.pointerId);card.style.zIndex=String(printNumber+1);});
  handle.addEventListener('pointermove',e=>{if(!origin)return;card.style.left=`${Math.max(0,Math.min(layer.clientWidth-card.offsetWidth,origin.left+e.clientX-origin.x))}px`;card.style.top=`${Math.max(0,Math.min(layer.clientHeight-80,origin.top+e.clientY-origin.y))}px`;});
  const end=()=>{origin=null;};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();card.style.left=`${Math.max(0,Math.min(layer.clientWidth-card.offsetWidth,card.offsetLeft+(e.key==='ArrowRight'?15:e.key==='ArrowLeft'?-15:0)))}px`;card.style.top=`${Math.max(0,Math.min(layer.clientHeight-80,card.offsetTop+(e.key==='ArrowDown'?15:e.key==='ArrowUp'?-15:0)))}px`;});
  document.querySelector('#print-status').textContent=`Lifted ${item.title}. Drag its top edge to move it, or use arrow keys.`;
});
