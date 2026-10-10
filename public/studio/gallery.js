import * as THREE from './vendor/three.module.min.js';
import { createGalleryRoom } from './gallery-room.js';
import { clampPosition, movePosition, rotateView, nearestAngle } from './gallery-navigation.js';

const $ = selector => document.querySelector(selector);
const stage = $('#gallery-stage');
const enter = $('#enter-gallery');
const status = $('#gallery-status');
const detail = $('#art-detail');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const poses = {
  entrance: {position: [.38, 1.65, 3.72], target: [-.1, 1.9, -3.6], caption: 'At the entrance'},
  left: {position: [1.30, 1.65, 1.3], target: [-1.8, 1.95, 1.0], artwork: 'elongated'},
  center: {position: [0, 1.65, -1.1], target: [0, 1.95, -4.34], artwork: 'gaps'},
  right: {position: [-1.25, 1.65, -.85], target: [1.79, 1.95, -1.3], artwork: 'bent'}
};
let room, renderer, camera, scene;
let yaw = 0, pitch = 0, entered = false, motion = null, frame = 0, lastTime = 0;
let reading = 0, projection = true;
let drag = null, held = null;
const keys = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const viewDirection = new THREE.Vector3();
const anglesFor = (position, target) => {
  const dx = target[0] - position[0], dy = target[1] - position[1], dz = target[2] - position[2];
  return {yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz))};
};

function setCamera() {
  viewDirection.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(camera.position.clone().add(viewDirection));
}

function showArtwork(art) {
  keys.clear(); held = null;
  $('#detail-title').textContent = art.title;
  $('#detail-image').src = art.image;
  $('#detail-image').alt = art.title;
  $('#detail-copy').textContent = art.description;
  detail.showModal();
}

function captionFor(pose) {
  const caption = $('#focus-caption');
  caption.replaceChildren();
  const art = room.artworks.find(item => item.id === pose.artwork);
  caption.append(document.createTextNode(art ? art.title : pose.caption));
  if (art) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'look-closer';
    button.textContent = 'Look closer ↗';
    button.addEventListener('click', () => showArtwork(art));
    caption.append(button);
  }
  status.textContent = art ? `${art.title}. Use Look closer for an enlarged image and context.` : 'At the entrance to the room.';
}

function travelTo(position, targetAngles, duration = 1.25) {
  keys.clear(); held = null;
  if (reducedMotion.matches) {
    camera.position.copy(position); yaw = targetAngles.yaw; pitch = targetAngles.pitch;
    motion = null; setCamera();
    return;
  }
  motion = {from: camera.position.clone(), to: position, fromYaw: yaw, toYaw: nearestAngle(yaw, targetAngles.yaw), fromPitch: pitch, toPitch: targetAngles.pitch, progress: 0, duration};
}

function goTo(name) {
  const pose = poses[name];
  travelTo(new THREE.Vector3(...pose.position), anglesFor(pose.position, pose.target));
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  captionFor(pose);
}

function freeMovement() {
  motion = null;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
}

function updateProjection() {
  room.setProjection(reading, projection);
  $('#projection-toggle').setAttribute('aria-pressed', String(projection));
  $('#projection-toggle').innerHTML = `<span class="projection-dot" aria-hidden="true"></span>Projection ${projection ? 'on' : 'off'}`;
  $('#reading-status').textContent = projection ? `Viewer drawing ${reading + 1} / 4` : 'The painting, without projection';
  $('#next-reading').disabled = !projection;
}

function walk(forward, sideways, dt) {
  freeMovement();
  const next = movePosition(camera.position, yaw, {forward, sideways}, dt);
  camera.position.set(next.x, next.y, next.z);
}

function cast(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(room.artworks.map(art => art.mesh).concat(room.floor), false);
}

function clickRoom(event) {
  const hit = cast(event)[0];
  if (!hit) return;
  const id = hit.object.userData.artworkId;
  if (id) {
    const name = Object.keys(poses).find(name => poses[name].artwork === id);
    if (name) goTo(name);
  } else if (hit.object === room.floor) {
    const next = clampPosition(hit.point);
    travelTo(new THREE.Vector3(next.x, next.y, next.z), {yaw, pitch}, .9);
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  }
}

function bindControls() {
  enter.addEventListener('click', () => {
    entered = true;
    $('#gallery-intro').hidden = true;
    $('#gallery-controls').hidden = false;
    stage.focus({preventScroll: true});
    const position = [.15, 1.65, 2.55];
    travelTo(new THREE.Vector3(...position), anglesFor(position, poses.entrance.target), 1.7);
    status.textContent = 'You are inside. Drag to look around, use the arrow keys to walk, or choose a painting.';
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => goTo(button.dataset.view)));
  $('#gallery-reset').addEventListener('click', () => goTo('entrance'));
  $('#projection-toggle').addEventListener('click', () => { projection = !projection; updateProjection(); });
  $('#next-reading').addEventListener('click', () => { reading = (reading + 1) % 4; updateProjection(); });
  $('#detail-close').addEventListener('click', () => detail.close());
  detail.addEventListener('click', event => {
    if (event.target !== detail) return;
    const rect = detail.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) detail.close();
  });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', event => {
    if (!entered || event.button !== 0) return;
    stage.focus({preventScroll: true});
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!entered) return;
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.distance += Math.hypot(dx, dy); drag.x = event.clientX; drag.y = event.clientY;
      if (drag.distance > 4) { freeMovement(); ({yaw, pitch} = rotateView(yaw, pitch, dx, dy)); }
    } else if (event.pointerType === 'mouse') {
      const hit = cast(event)[0];
      const pointed = hit?.object.userData.artworkId || null;
      canvas.style.cursor = pointed ? 'pointer' : 'grab';
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const clicked = drag.distance < 5;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (clicked) clickRoom(event);
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', event => {
    if (!entered || detail.open) return;
    event.preventDefault();
    walk(Math.sign(event.deltaY), 0, Math.min(Math.abs(event.deltaY) * .0018, .25));
  }, {passive: false});
  const direction = {forward: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1]};
  document.querySelectorAll('[data-move]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      held = direction[button.dataset.move];
      walk(...held, .08);
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => { held = null; });
    button.addEventListener('click', event => { if (event.detail === 0) walk(...direction[button.dataset.move], .2); });
  });
  const navigationKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  document.addEventListener('keydown', event => {
    if (!entered || detail.open || !navigationKeys.includes(event.code) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault(); keys.add(event.code);
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); held = null; drag = null; });
}

function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  camera.aspect = width / height;
  camera.fov = width < 760 ? 73 : 61;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function tick(time) {
  frame = requestAnimationFrame(tick);
  const dt = Math.min((time - lastTime) / 1000 || 0, .06); lastTime = time;
  if (motion) {
    motion.progress = Math.min(1, motion.progress + dt / motion.duration);
    const t = motion.progress * motion.progress * (3 - 2 * motion.progress);
    camera.position.lerpVectors(motion.from, motion.to, t);
    yaw = THREE.MathUtils.lerp(motion.fromYaw, motion.toYaw, t);
    pitch = THREE.MathUtils.lerp(motion.fromPitch, motion.toPitch, t);
    if (motion.progress === 1) motion = null;
  }
  if (entered && !detail.open) {
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + (held?.[0] || 0);
    const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + (held?.[1] || 0);
    if (forward || sideways) walk(forward, sideways, dt);
  }
  setCamera();
  room.update(time / 1000);
  renderer.render(scene, camera);
}

function stop() { cancelAnimationFrame(frame); frame = 0; keys.clear(); held = null; drag = null; }
function start() { if (!frame && renderer && room && !document.hidden) { lastTime = performance.now(); frame = requestAnimationFrame(tick); } }

async function init() {
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#e7e6e1');
    scene.fog = new THREE.Fog('#e7e6e1', 16, 28);
    renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    camera = new THREE.PerspectiveCamera(61, 1, .055, 45);
    camera.position.set(...poses.entrance.position);
    ({yaw, pitch} = anglesFor(poses.entrance.position, poses.entrance.target));
    room = await createGalleryRoom(scene, renderer);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.append(renderer.domElement);
    resize(); setCamera(); renderer.render(scene, camera);
    $('#gallery-fallback').hidden = true;
    enter.disabled = false;
    $('#gallery-loading').textContent = 'Take your time. There is no prescribed route.';
    updateProjection(); bindControls(); start();
    new ResizeObserver(resize).observe(stage);
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); stop();
      $('#gallery-fallback').hidden = false;
      $('#gallery-controls').hidden = true;
      $('#gallery-intro').hidden = false;
      enter.disabled = true;
      $('#gallery-loading').textContent = 'The room paused. Reload to enter, or explore the project images.';
    });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', event => { if (event.persisted) start(); });
  } catch (error) {
    console.error('Gallery could not open:', error);
    renderer?.dispose();
    $('#gallery-loading').textContent = 'This device cannot open the 3D room. The installation image and project remain available.';
    enter.hidden = true;
  }
}
init();
