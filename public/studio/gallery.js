import * as THREE from './vendor/three.module.min.js';
import CameraControls from './vendor/camera-controls.js';
import { createGalleryScene } from './gallery-scene.js';
import { createEntranceTimeline, createExitTimeline, GALLERY_OUTSIDE, GALLERY_OVERVIEW } from './gallery-travel.js';
import { nearestAngle } from './gallery-navigation.js';

// This is the approved motion study, mounted directly into the scanner page.
export async function createGalleryExperience(root, {echo, onExit, signal}) {
  const $ = selector => root.querySelector(selector);
  const stage = $('.hz-stage'), mount = $('.hz-scene'), enter = $('.hz-enter'), exit = $('.hz-exit');
  const menuToggle = $('.hz-menu-toggle'), menu = $('.hz-menu'), hint = $('.hz-hint'), caption = $('.hz-caption');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, {...options, signal: events.signal});
  let renderer, room, controls, observer, timeline, mode = 'closed', disposed = false, paused = false, hintTimer, gesture;
  let previous = 0, elapsed = 0;
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), direction = new THREE.Vector3(), spherical = new THREE.Spherical();
  function announce(text) {$('.hz-sr').textContent = text;}
  function setMode(value) {
    mode = value; root.dataset.state = value;
    mount.setAttribute('aria-label', value === 'inside' ? 'Helen’s installation. Drag to look. Tap a work to approach. Arrow keys turn the view.' : value === 'closed' ? 'A closed studio door. Activate Enter the studio to enter.' : 'Moving through the studio doorway.');
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
    if (direction.z > .05 && echo?.update(elapsed) && room.homepageTexture) room.homepageTexture.needsUpdate = true;
    room.update(elapsed); renderer.render(room.scene, camera);
  }
  let camera;
  function pause() {if (disposed) return;paused = true;timeline?.pause();if (controls) controls.enabled = false;renderer?.setAnimationLoop(null);hideHint();}
  function resume() {if (disposed) return;paused = false;previous = 0;if (mode === 'entering' || mode === 'exiting') timeline?.play();if (controls) controls.enabled = mode === 'inside';renderer?.setAnimationLoop(runFrame);}
  function dispose() {
    if (disposed) return;disposed = true;events.abort();clearTimeout(hintTimer);timeline?.kill();observer?.disconnect();
    controls?.dispose();renderer?.setAnimationLoop(null);room?.dispose();renderer?.dispose();renderer?.domElement.remove();
  }
  try {
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    room = await createGalleryScene(renderer, {homepageCanvas: echo?.canvas});
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
    function resize() {const w = stage.clientWidth, h = stage.clientHeight;renderer.setSize(w,h);camera.aspect = w/h;camera.fov = w / h < .55 ? 67 : w < 800 ? 57 : 48;camera.updateProjectionMatrix();}
    observer = new ResizeObserver(resize);observer.observe(stage);resize();
    setMode('closed');announce('The door is closed. Activate Enter the studio when you are ready.');root.style.setProperty('--hz-ink','#f0eee8');
    $('.hz-brand').hidden = false;$('.hz-location').hidden = false;$('.hz-intro').hidden = false;
    enter.hidden = false;enter.disabled = false;enter.textContent = 'Enter the studio';exit.hidden = true;menuToggle.hidden = true;caption.hidden = true;hideHint();closeMenu();
    function arrived() {
      if (disposed) return;setMode('inside');aim(GALLERY_OVERVIEW.p,GALLERY_OVERVIEW.t,false);controls.enabled = !paused;
      menuToggle.hidden = false;$('.hz-location').hidden = true;root.style.setProperty('--hz-ink','#252b22');
      hint.hidden = false;hintTimer = setTimeout(hideHint,6000);mount.focus({preventScroll:true});
      announce('Inside the installation. Drag to look. Tap a work to approach.');
    }
    function enterRoom() {
      if (mode !== 'closed' || disposed || paused) return;
      setMode('entering');enter.hidden = true;$('.hz-intro').hidden = true;$('.hz-brand').hidden = true;exit.hidden = false;
      announce('Opening the door and entering the studio.');
      timeline = createEntranceTimeline({camera,door:room.door,handle:room.handle,onComplete:arrived});
      if (reduced.matches) timeline.progress(1); else timeline.play();
    }
    function leave() {
      if (disposed || mode === 'exiting') return;
      if (mode === 'closed') {onExit();return;}
      timeline?.kill();controls.enabled = false;hideHint();closeMenu();caption.hidden = true;menuToggle.hidden = true;setMode('exiting');
      announce('Returning through the doorway to the scanner.');
      timeline = createExitTimeline({camera,door:room.door,handle:room.handle,onComplete:()=>{if (!disposed) onExit();}});
      if (reduced.matches || paused) timeline.progress(1); else timeline.play();
    }
    function moveTo(pose, title = '') {
      if (mode !== 'inside') return;
      hideHint();closeMenu();aim(pose.p,pose.t);caption.hidden = !title;
      caption.querySelector('span').textContent = title;announce(title || 'Looking around the room.');mount.focus({preventScroll:true});
    }
    listen(enter,'click',enterRoom);listen(exit,'click',leave);
    listen(menuToggle,'click',()=>{menu.hidden = !menu.hidden;menuToggle.setAttribute('aria-expanded',String(!menu.hidden));hideHint();});
    root.querySelectorAll('[data-work]').forEach(button => listen(button,'click',()=>{const art=room.artworks[+button.dataset.work];moveTo(art.pose,art.title);}));
    listen($('.hz-overview'),'click',()=>moveTo(GALLERY_OVERVIEW));
    listen($('.hz-look-back'),'click',()=>moveTo({p:GALLERY_OVERVIEW.p,t:[0,1.62,7.3]}));
    listen($('.hz-dismiss'),'click',()=>{caption.hidden=true;mount.focus({preventScroll:true});});
    // Native dialog handles Escape after local, contextual UI has been dismissed.
    listen(root,'keydown',event=>{
      if (event.key !== 'Escape') return;
      if (!menu.hidden) {event.preventDefault();event.stopPropagation();closeMenu();menuToggle.focus();}
      else if (!caption.hidden) {event.preventDefault();event.stopPropagation();caption.hidden=true;mount.focus();}
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
      else if(mode==='inside'){const selected=hit(event,room.artworks.map(art=>art.mesh));if(selected){const art=room.artworks.find(art=>art.mesh===selected.object);if(art)moveTo(art.pose,art.title);}}
    });
    listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();pause();closeMenu();caption.hidden=true;root.style.setProperty('--hz-ink','#f0eee8');root.dataset.state='fallback';$('.hz-fallback').hidden=false;$('.hz-brand').hidden=false;announce('The 3D view paused. Return to the scanner or view the installation photographs.');});
    listen(reduced,'change',()=>{controls.draggingSmoothTime=reduced.matches?0:.16;if(reduced.matches && (mode==='entering'||mode==='exiting'))timeline?.progress(1);});
    renderer.setAnimationLoop(runFrame);enter.focus({preventScroll:true});
    return {exit:leave,pause,resume,dispose};
  } catch (error) {dispose();throw error;}
}
