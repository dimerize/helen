import * as THREE from './vendor/three.module.min.js';
import {createCarrier} from './scan-carrier.js';
// One shared offscreen GPU renderer, independent of how many prints are lifted.
let renderer;
export function mountCarrier(card,image,title){
 renderer ||= new THREE.WebGLRenderer({alpha:true,antialias:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.setClearColor(0,0);
 const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
 const model=createCarrier(texture,title),scene=new THREE.Scene();scene.add(model.root);
 scene.add(new THREE.HemisphereLight('#f0f0e8','#292c28',2.6));const key=new THREE.DirectionalLight('#dce5d6',3.5);key.position.set(-4,6,7);scene.add(key);
 const camera=new THREE.PerspectiveCamera(32,1,.1,50);
 const canvas=document.createElement('canvas');canvas.className='carrier-render';canvas.setAttribute('aria-hidden','true');card.append(canvas);
 const ctx=canvas.getContext('2d'),aspect=(model.width+.65)/(model.height+.65);
 const width=600,height=Math.round(width/aspect);canvas.width=width;canvas.height=height;canvas.style.aspectRatio=String(aspect);
 let flipped=false,disposed=false,raf,turn=0,target=0;
 function render(){
  renderer.setSize(width,height,false);camera.aspect=aspect;camera.position.set(0,0,(model.height+.65)/2/Math.tan(16*Math.PI/180));camera.updateProjectionMatrix();
  model.root.rotation.y=turn;renderer.render(scene,camera);ctx.clearRect(0,0,width,height);ctx.drawImage(renderer.domElement,0,0);
 }
 function tick(){turn+=(target-turn)*.14;if(Math.abs(target-turn)<.001)turn=target;render();if(turn!==target&&!disposed)raf=requestAnimationFrame(tick);}
 const flip=document.createElement('button');flip.className='carrier-flip';flip.setAttribute('aria-label','Turn scan over');flip.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 3v5H0"/></svg>';
 flip.addEventListener('click',()=>{flipped=!flipped;target=flipped?Math.PI:0;flip.setAttribute('aria-label',flipped?'Show scan':'Turn scan over');cancelAnimationFrame(raf);if(matchMedia('(prefers-reduced-motion:reduce)').matches)turn=target;tick();});card.append(flip);
 card.classList.add('has-carrier');render();
 const observer=new MutationObserver(()=>{if(!card.isConnected){disposed=true;cancelAnimationFrame(raf);observer.disconnect();model.dispose();texture.dispose();}});observer.observe(document.body,{childList:true,subtree:true});
 return {canvas};
}
