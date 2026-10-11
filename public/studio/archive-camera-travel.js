import * as THREE from './vendor/three.module.min.js';

// Perspective calibration: one world unit projects to one CSS pixel at z=0.
// Card depth is compensated at rest, so individual source images register with
// their existing DOM layout before the camera moves. No document is textured.
export function archiveCameraFrame(width,height,fov=39) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Invalid archive viewport.');
  const distance=height/(2*Math.tan(fov*Math.PI/360));
  // A pixel-calibrated scene is hundreds of units deep. A .1 near plane
  // cannot distinguish the printed face from its .03-unit recessed backing.
  return {width,height,fov,distance,near:distance*.25,far:distance*3,shift:width*.10,retreat:height*.045};
}
export function archiveCardGeometry({centerX,centerY,width,height,angle=0,depth=0},frame) {
  const factor=(frame.distance-depth)/frame.distance;
  return {x:(centerX-frame.width/2)*factor,y:(frame.height/2-centerY)*factor,z:depth,width:width*factor,height:height*factor,rotation:-angle};
}
export function archiveCameraPose(frame,phase,direction,progress) {
  const t=Math.max(0,Math.min(1,progress)),ease=t*t*t*(t*(t*6-15)+10);
  const amount=phase==='arrive'?1-ease:ease;
  return {x:direction*frame.shift*amount*(phase==='arrive'?-1:1),y:0,z:frame.distance+frame.retreat*amount};
}
export function measureArchiveImage(image,index) {
  const rect=image.getBoundingClientRect(),parent=image.closest('.fragment');
  const style=getComputedStyle(image),matrix=new DOMMatrix(getComputedStyle(parent).transform);
  const angle=Math.atan2(matrix.b,matrix.a),scale=Math.hypot(matrix.a,matrix.b)||1;
  const boxWidth=image.clientWidth*scale,boxHeight=image.clientHeight*scale;
  const aspect=image.naturalWidth/image.naturalHeight;
  const width=Math.min(boxWidth,boxHeight*aspect),height=width/aspect;
  const positions=style.objectPosition.split(/\s+/);
  const fraction=(value,axis)=>value==='left'||value==='top'?0:value==='right'||value==='bottom'?1:value==='center'?.5:value?.endsWith('%')?parseFloat(value)/100:.5;
  const localX=(boxWidth-width)*(fraction(positions[0],0)-.5),localY=(boxHeight-height)*(fraction(positions[1],1)-.5);
  const centerX=rect.left+rect.width/2+Math.cos(angle)*localX-Math.sin(angle)*localY;
  const centerY=rect.top+rect.height/2+Math.sin(angle)*localX+Math.cos(angle)*localY;
  return {image,centerX,centerY,width,height,angle,depth:4+index*2,brightness:Number(style.filter.match(/brightness\(([^)]+)\)/)?.[1])||1};
}

export function installArchiveCameraTravel({document:doc=document,window:win=window}={}) {
  let current=null,disposed=false;
  const events=new AbortController();
  function cleanup() {current?.dispose();current=null;doc.body.removeAttribute('data-archive-camera');}
  async function travel(detail) {
    cleanup();
    if(disposed || detail.signal?.aborted || win.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    // The inspector owns its own selected-image handoff; never make its image
    // into a second unrelated table scene.
    if(doc.querySelector('#image-dialog[open]'))return;
    const images=[...doc.querySelectorAll('.fragment img')].filter(image=>{
      const r=image.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>-100&&r.top<win.innerHeight+100&&r.right>0&&r.left<win.innerWidth;
    }).slice(0,18);
    if(!images.length)return;
    await Promise.allSettled(images.map(image=>image.decode?.()));
    if(disposed || detail.signal?.aborted)return;
    const loaded=images.filter(image=>image.complete&&image.naturalWidth>0).sort((a,b)=>(parseInt(getComputedStyle(a.closest('.fragment')).zIndex)||0)-(parseInt(getComputedStyle(b.closest('.fragment')).zIndex)||0));
    if(!loaded.length)return;
    let renderer;
    try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return;}
    const resources=new Set(),scene=new THREE.Scene(),frame=archiveCameraFrame(win.innerWidth,win.innerHeight);
    renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,1.5));renderer.setSize(frame.width,frame.height,false);
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.className='spatial-archive-camera';renderer.domElement.setAttribute('aria-hidden','true');
    const camera=new THREE.PerspectiveCamera(frame.fov,frame.width/frame.height,frame.near,frame.far);
    for(const [index,image] of loaded.entries()) {
      const measured=measureArchiveImage(image,index),layout=archiveCardGeometry(measured,frame);
      const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;resources.add(texture);
      const face=new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false});face.color.setRGB(measured.brightness,measured.brightness,measured.brightness,THREE.SRGBColorSpace);resources.add(face);
      const group=new THREE.Group();group.position.set(layout.x,layout.y,layout.z);group.rotation.z=layout.rotation;scene.add(group);
      const geometry=new THREE.PlaneGeometry(layout.width,layout.height);resources.add(geometry);
      const card=new THREE.Mesh(geometry,face);group.add(card);
      const edgeGeometry=new THREE.BoxGeometry(layout.width,layout.height,1.1),edgeMaterial=new THREE.MeshBasicMaterial({color:0x292822});resources.add(edgeGeometry);resources.add(edgeMaterial);
      const edge=new THREE.Mesh(edgeGeometry,edgeMaterial);edge.position.z=-.58;group.add(edge);
      const shadowGeometry=new THREE.PlaneGeometry(layout.width+22,layout.height+22);resources.add(shadowGeometry);
      const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;void main(){vec2 edge=min(vUv,1.0-vUv);float a=smoothstep(0.0,.11,edge.x)*smoothstep(0.0,.11,edge.y)*.30;gl_FragColor=vec4(0.0,0.0,0.0,a);}'});resources.add(shadowMaterial);
      const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.position.set(4,-7,-2);group.add(shadow);
    }
    let raf=null,done=false,resolveMotion;
    const completion=new Promise(resolve=>{resolveMotion=resolve;});
    function dispose() {
      if(done)return;done=true;win.cancelAnimationFrame(raf);
      for(const resource of resources)resource.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
      doc.body.removeAttribute('data-archive-camera');resolveMotion();
    }
    current={dispose};
    const render=t=>{const pose=archiveCameraPose(frame,detail.phase,detail.direction,t);camera.position.set(pose.x,pose.y,pose.z);renderer.render(scene,camera);};
    render(0);doc.body.append(renderer.domElement);doc.body.dataset.archiveCamera=detail.phase;
    detail.signal?.addEventListener('abort',dispose,{once:true});
    const start=win.performance.now();
    function tick(now) {
      if(done)return;
      const progress=Math.min(1,(now-start)/detail.duration);render(progress);
      if(progress<1)raf=win.requestAnimationFrame(tick);
      else {if(detail.phase==='arrive')dispose();else resolveMotion();}
    }
    raf=win.requestAnimationFrame(tick);
    await completion;
  }
  doc.addEventListener('studio:camera-travel',event=>{
    if(event.detail?.route!=='archive' || event.detail.promise)return;
    event.detail.promise=travel(event.detail);
  },{signal:events.signal});
  doc.addEventListener('studio:camera-travel-cancel',cleanup,{signal:events.signal});
  win.addEventListener('resize',cleanup,{signal:events.signal});
  win.addEventListener('pagehide',cleanup,{signal:events.signal});
  return {dispose(){if(disposed)return;disposed=true;cleanup();events.abort();}};
}
