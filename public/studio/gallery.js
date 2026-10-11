import * as THREE from './vendor/three.module.min.js';
import CameraControls from './vendor/camera-controls.js';
import { createGalleryScene } from './gallery-scene.js';
import { createEntranceTimeline, createExitTimeline, GALLERY_OUTSIDE, GALLERY_OVERVIEW } from './gallery-travel.js';
import { nearestAngle } from './gallery-navigation.js';
import { createComputerScreen } from './computer-screen.js';
import { getComputerPose, createComputerTimeline } from './computer-travel.js';
import { animateCameraJourney } from './camera-journey.js';
import { runSpatialTravel, notifySpatialReady } from './spatial-navigation.js';

// This is the approved motion study, mounted directly into the scanner page.
export async function createGalleryExperience(root, {echo, onExit, signal}) {
  const $ = selector => root.querySelector(selector);
  const stage = $('.hz-stage'), mount = $('.hz-scene'), enter = $('.hz-enter'), exit = $('.hz-exit');
  const menuToggle = $('.hz-menu-toggle'), menu = $('.hz-menu'), hint = $('.hz-hint'), caption = $('.hz-caption');
  const stepAway = $('.hz-computer-step-away'), useComputer = $('.hz-computer-use');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, {...options, signal: events.signal});
  let renderer, room, screenUI, controls, observer, timeline, mode = 'closed', disposed = false, paused = false, hintTimer, gesture;
  let previous = 0, elapsed = 0, navigationCamera = false;
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), direction = new THREE.Vector3(), spherical = new THREE.Spherical();
  function announce(text) {$('.hz-sr').textContent = text;}
  const atComputer = () => ['computer-approach','computer','screen-approach','screen','computer-return'].includes(mode);
  const moving = () => ['entering','exiting','computer-approach','screen-approach','computer-return'].includes(mode);
  const roomFov = () => stage.clientWidth/stage.clientHeight < .55 ? 67 : stage.clientWidth < 800 ? 57 : 48;
  function setMode(value) {
    mode = value; root.dataset.state = value;
    mount.setAttribute('aria-label', value === 'inside' ? 'Helen’s installation. Drag to look. Tap a work or the computer to approach. Arrow keys turn the view.' : atComputer() ? 'Helen’s computer. Use the computer to open Instagram and Mail, or step away to return to the installation.' : value === 'closed' ? 'A closed studio door. Activate Enter the studio to enter.' : 'Moving through the studio doorway.');
  }
  function hideHint() {clearTimeout(hintTimer);hint.hidden = true;}
  function closeMenu() {menu.hidden = true;menuToggle.setAttribute('aria-expanded','false');}
  function aim(position, target, transition = true) {
    const p = new THREE.Vector3(...position), t = new THREE.Vector3(...target);
    t.sub(p).normalize().multiplyScalar(.0001).add(p);
    controls.normalizeRotations();
    const angle = controls.getSpherical(spherical, false).theta;
    controls.setLookAt(...p.toArray(), ...t.toArray(), transition && !reduced.matches);
    controls.getSpherical(spherical, true);
    controls.rotateTo(nearestAngle(angle, spherical.theta), spherical.phi, transition && !reduced.matches);
    if (!transition || reduced.matches) controls.update(0);
  }
  function runFrame(now) {
    if (disposed || paused) return;
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
    previous = now; elapsed += dt;
    if (controls.enabled) controls.update(dt);
    camera.getWorldDirection(direction);
    // The live scanner costs nothing while it is behind the visitor.
    if (direction.z > .05 && echo?.update(elapsed)) {
      if(room.homepageTexture)room.homepageTexture.needsUpdate=true;
    }
    room.update(elapsed); renderer.render(room.scene, camera);
    if(mode === 'screen') placeScreen();
  }
  let camera;
  function pause() {if (disposed) return;paused = true;timeline?.pause();if (controls) controls.enabled = false;renderer?.setAnimationLoop(null);hideHint();}
  function resume() {if (disposed) return;paused = false;previous = 0;if (moving()) timeline?.play();if (controls) controls.enabled = mode === 'inside';renderer?.setAnimationLoop(runFrame);}
  function dispose() {
    if (disposed) return;disposed = true;events.abort();clearTimeout(hintTimer);timeline?.kill();observer?.disconnect();
    screenUI?.dispose();controls?.dispose();renderer?.setAnimationLoop(null);room?.dispose();renderer?.dispose();renderer?.domElement.remove();
  }
  function computerPose(kind) {
    const center=new THREE.Vector3();room.computer.screen.getWorldPosition(center);
    return getComputerPose(kind,{width:stage.clientWidth,height:stage.clientHeight,center:center.toArray()});
  }
  function placeScreen() {
    const screen=room.computer.screen;
    screen.geometry.computeBoundingBox();const b=screen.geometry.boundingBox;
    camera.updateMatrixWorld(true);
    const corners=[[b.min.x,b.min.y],[b.max.x,b.max.y]].map(([x,y])=>screen.localToWorld(new THREE.Vector3(x,y,.001)).project(camera));
    const xs=corners.map(p=>(p.x*.5+.5)*stage.clientWidth),ys=corners.map(p=>(-p.y*.5+.5)*stage.clientHeight);
    const width=Math.abs(xs[1]-xs[0]);
    screenUI.place({left:Math.min(...xs),top:Math.min(...ys),width,height:Math.abs(ys[1]-ys[0]),compact:width<500});
  }
  try {
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    screenUI = await createComputerScreen($('.hz-computer-ui'), {signal});
    room = await createGalleryScene(renderer, {homepageCanvas: echo?.canvas,computerCanvas:screenUI.canvas});
    if (signal?.aborted) throw new DOMException('Studio closed', 'AbortError');
    camera = room.camera;
    CameraControls.install({THREE});controls = new CameraControls(camera, renderer.domElement);
    controls.enabled = false;controls.smoothTime = .4;controls.draggingSmoothTime = reduced.matches ? 0 : .16;
    controls.minDistance = .00005;controls.maxDistance = .0002;controls.minPolarAngle = .7;controls.maxPolarAngle = 2.05;
    controls.azimuthRotateSpeed = .6;controls.polarRotateSpeed = .45;
    controls.mouseButtons.left = CameraControls.ACTION.ROTATE;
    controls.mouseButtons.middle = controls.mouseButtons.right = controls.mouseButtons.wheel = CameraControls.ACTION.NONE;
    controls.touches.one = CameraControls.ACTION.TOUCH_ROTATE;
    controls.touches.two = controls.touches.three = CameraControls.ACTION.NONE;
    // CameraControls' constructor changes the initial look target; restore the
    // exact closed-door camera before the first frame, avoiding an entry jump.
    camera.position.fromArray(GALLERY_OUTSIDE.p);camera.lookAt(...GALLERY_OUTSIDE.t);
    mount.replaceChildren(renderer.domElement);
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;renderer.setSize(w,h);camera.aspect = w/h;
      if(atComputer() && mode !== 'computer-return') {
        const kind=mode.startsWith('screen')?'screen':'computer';
        if(mode==='screen' || mode==='computer') {
          // Resize only the view: do not reset the selected app, scroll, or focus.
          const pose=computerPose(kind);camera.position.fromArray(pose.p);camera.lookAt(...pose.t);camera.fov=pose.fov;camera.updateProjectionMatrix();
          if(mode==='screen')placeScreen();
        } else focusComputer(kind,true);
      } else {camera.fov = roomFov();camera.updateProjectionMatrix();}
    }
    observer = new ResizeObserver(resize);observer.observe(stage);resize();
    setMode('closed');announce('The door is closed. Activate Enter the studio when you are ready.');root.style.setProperty('--hz-ink','#f0eee8');
    $('.hz-brand').hidden = false;$('.hz-location').hidden = false;$('.hz-intro').hidden = false;
    enter.hidden = false;enter.disabled = false;enter.textContent = 'Enter the studio';exit.hidden = true;menuToggle.hidden = true;caption.hidden = true;stepAway.hidden=true;useComputer.hidden=true;screenUI.hide();hideHint();closeMenu();
    function arrived() {
      if (disposed) return;setMode('inside');aim(GALLERY_OVERVIEW.p,GALLERY_OVERVIEW.t,false);controls.enabled = !paused;
      menuToggle.hidden = false;$('.hz-location').hidden = true;root.style.setProperty('--hz-ink','#252b22');
      hint.hidden = false;hintTimer = setTimeout(hideHint,6000);mount.focus({preventScroll:true});
      announce('Inside the installation. Drag to look. Tap a work or the computer to approach.');
    }
    function enterRoom() {
      if (mode !== 'closed' || disposed || paused || navigationCamera) return;
      setMode('entering');enter.hidden = true;$('.hz-intro').hidden = true;$('.hz-brand').hidden = true;exit.hidden = false;
      announce('Opening the door and entering the studio.');
      timeline = createEntranceTimeline({camera,door:room.door,handle:room.handle,onComplete:arrived});
      if (reduced.matches) timeline.progress(1); else timeline.play();
    }
    function returnHome(skipDeparture = true) {
      if (disposed) return;
      setMode('returning');
      document.dispatchEvent(new CustomEvent('studio:portal-travel',{detail:{phase:'return',from:'gallery',to:'home'}}));
      // The physical door has already completed its retreat. Restore the real
      // homepage directly; a captured page never crosses the visitor's view.
      runSpatialTravel('home', onExit, {skipDeparture});
    }
    function leave() {
      if (disposed || navigationCamera || mode === 'exiting' || mode === 'returning') return;
      if (mode === 'fallback') {onExit();return;}
      if (mode === 'closed') {
        timeline?.kill();controls.enabled=false;hideHint();closeMenu();
        returnHome(false);return;
      }
      timeline?.kill();screenUI.hide();stepAway.hidden=true;useComputer.hidden=true;exit.hidden=false;
      controls.enabled = false;hideHint();closeMenu();caption.hidden = true;menuToggle.hidden = true;setMode('exiting');
      announce('Returning through the doorway to the scanner.');
      timeline = createExitTimeline({camera,door:room.door,handle:room.handle,onComplete:()=>{if (!disposed) returnHome();}});
      timeline.to(camera,{fov:roomFov(),duration:.65,ease:'power2.inOut',onUpdate:()=>camera.updateProjectionMatrix()},0);
      if (reduced.matches || paused) timeline.progress(1); else timeline.play();
    }
    function moveTo(pose, title = '') {
      if (mode !== 'inside') return;
      hideHint();closeMenu();aim(pose.p,pose.t);caption.hidden = !title;
      caption.querySelector('span').textContent = title;announce(title || 'Looking around the room.');mount.focus({preventScroll:true});
    }
    function focusComputer(kind='computer',instant=false) {
      if(disposed || (!atComputer() && mode!=='inside'))return;
      timeline?.kill();screenUI.hide();controls.enabled=false;hideHint();closeMenu();caption.hidden=true;
      exit.hidden=true;menuToggle.hidden=true;stepAway.hidden=false;useComputer.hidden=true;
      setMode(kind==='screen'?'screen-approach':'computer-approach');
      if(!instant)stepAway.focus({preventScroll:true});
      announce(kind==='screen'?'Moving closer to Helen’s Instagram and Mail.':'Approaching Helen’s computer.');
      timeline=createComputerTimeline({camera,pose:computerPose(kind),onComplete(){
        if(disposed)return;setMode(kind);
        if(kind==='screen'){screenUI.show();placeScreen();announce('Helen’s computer. Instagram opens the real profile in a new tab. Mail opens your email app.');}
        else {useComputer.hidden=false;if(!instant)useComputer.focus({preventScroll:true});announce('At Helen’s computer. Activate Use the computer to open Instagram and Mail.');}
      }});
      if(instant || reduced.matches)timeline.progress(1);else timeline.play();
    }
    function stepBack() {
      if(!atComputer() || mode==='computer-return' || disposed)return;
      timeline?.kill();screenUI.hide();useComputer.hidden=true;controls.enabled=false;setMode('computer-return');
      stepAway.focus({preventScroll:true});announce('Stepping away from the computer.');
      timeline=createComputerTimeline({camera,pose:{...GALLERY_OVERVIEW,fov:roomFov()},onComplete(){
        if(disposed)return;setMode('inside');aim(GALLERY_OVERVIEW.p,GALLERY_OVERVIEW.t,false);controls.enabled=!paused;
        stepAway.hidden=true;exit.hidden=false;menuToggle.hidden=false;mount.focus({preventScroll:true});announce('Back in the installation.');
      }});
      if(reduced.matches || paused)timeline.progress(1);else timeline.play();
    }
    listen(enter,'click',enterRoom);listen(exit,'click',leave);
    listen($('.hz-visit-computer'),'click',()=>focusComputer());
    listen(useComputer,'click',()=>focusComputer('screen'));
    listen(stepAway,'click',stepBack);
    listen(menuToggle,'click',()=>{menu.hidden = !menu.hidden;menuToggle.setAttribute('aria-expanded',String(!menu.hidden));hideHint();});
    root.querySelectorAll('[data-work]').forEach(button => listen(button,'click',()=>{const art=room.artworks[+button.dataset.work];moveTo(art.pose,art.title);}));
    listen($('.hz-overview'),'click',()=>moveTo(GALLERY_OVERVIEW));
    listen($('.hz-look-back'),'click',()=>moveTo({p:GALLERY_OVERVIEW.p,t:[0,1.62,7.3]}));
    listen($('.hz-dismiss'),'click',()=>{caption.hidden=true;mount.focus({preventScroll:true});});
    // Both keyboard Escape and native dialog cancellation respect the local view.
    // A hidden control can otherwise leave focus on the document during travel.
    function dismissLocalView() {
      if(atComputer())stepBack();
      else if(!menu.hidden){closeMenu();menuToggle.focus();}
      else if(!caption.hidden){caption.hidden=true;mount.focus();}
      else return false;
      return true;
    }
    listen(root,'keydown',event=>{
      if(event.key==='Escape' && dismissLocalView()){event.preventDefault();event.stopPropagation();}
    });
    listen(mount,'keydown',event=>{
      if (mode !== 'inside') return;
      const turns={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
      if (turns[event.key]) {event.preventDefault();controls.rotate(...turns[event.key],!reduced.matches);hideHint();}
    });
    function hit(event,objects) {const rect=mount.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(objects,true)[0];}
    const pointers = new Set();
    listen(renderer.domElement,'pointerdown',event=>{if(event.button!==0)return;pointers.add(event.pointerId);if(pointers.size>1){gesture=null;return;}gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};if(mode==='inside')hideHint();});
    listen(renderer.domElement,'pointermove',event=>{if(gesture && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7)gesture.moved=true;});
    listen(renderer.domElement,'pointercancel',event=>{pointers.delete(event.pointerId);gesture=null;});
    listen(renderer.domElement,'pointerup',event=>{
      pointers.delete(event.pointerId);const down=gesture;gesture=null;
      if(!down || down.id!==event.pointerId || down.moved || pointers.size)return;
      if(mode==='closed' && hit(event,[room.door]))enterRoom();
      else if(mode==='computer' && hit(event,[room.computer.group]))focusComputer('screen');
      else if(mode==='inside'){
        const selected=hit(event,[...room.artworks.map(art=>art.mesh),room.computer.group]);
        if(selected){const art=room.artworks.find(art=>art.mesh===selected.object);if(art)moveTo(art.pose,art.title);else focusComputer();}
      }
    });
    listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();pause();screenUI.hide();stepAway.hidden=true;useComputer.hidden=true;closeMenu();caption.hidden=true;root.style.setProperty('--hz-ink','#f0eee8');setMode('fallback');$('.hz-fallback').hidden=false;$('.hz-brand').hidden=false;announce('The 3D view paused. Return to the scanner, view the installation photographs, or use the Instagram and email links.');});
    listen(reduced,'change',()=>{controls.draggingSmoothTime=reduced.matches?0:.16;if(reduced.matches && moving())timeline?.progress(1);});
    listen(document, 'studio:camera-travel', event => {
      const detail = event.detail;
      if (detail.route !== 'gallery' || disposed || detail.promise) return;
      if (detail.phase === 'depart' && ['inside','computer','screen','computer-approach','screen-approach'].includes(mode)) {
        const startPosition = camera.position.clone(), startTarget = new THREE.Vector3();
        camera.getWorldDirection(startTarget); startTarget.add(startPosition);
        const startDoor = room.door.rotation.y;
        controls.enabled = false; closeMenu(); hideHint(); screenUI.hide();
        setMode('exiting'); detail.duration = 2450;
        detail.promise = new Promise(resolve => {
          timeline?.kill();
          timeline = createExitTimeline({camera,door:room.door,handle:room.handle,onComplete:resolve});
          detail.signal?.addEventListener('abort', () => {
            timeline?.kill();
            if (!disposed) {
              room.door.rotation.y = startDoor; room.handle.rotation.z = 0;
              setMode('inside'); aim(startPosition.toArray(),startTarget.toArray(),false);
              controls.enabled = !paused; exit.hidden = false; menuToggle.hidden = false;
              stepAway.hidden = true; useComputer.hidden = true;
            }
            resolve();
          }, {once:true});
          if (reduced.matches) timeline.progress(1); else timeline.play();
        });
        return;
      }
      const target = new THREE.Vector3(...GALLERY_OUTSIDE.t);
      camera.position.fromArray(GALLERY_OUTSIDE.p); camera.lookAt(target);
      controls.enabled = false; navigationCamera = true;
      detail.promise = animateCameraJourney(THREE, camera, target, {...detail, render: () => {
        if (!disposed) renderer.render(room.scene, camera);
      }}).finally(() => { navigationCamera = false; });
    });
    // Loading the gallery presents its existing closed doorway immediately.
    // Only the explicit Enter action starts the original physical entrance.
    room.update(elapsed);renderer.render(room.scene,camera);
    renderer.setAnimationLoop(runFrame);
    document.dispatchEvent(new CustomEvent('studio:portal-travel',{detail:{phase:'arrive',from:'home',to:'gallery'}}));
    enter.focus({preventScroll:true});
    notifySpatialReady('gallery');
    return {exit:leave,cancel:()=>{if(!dismissLocalView())leave();},pause,resume,dispose};
  } catch (error) {dispose();throw error;}
}
