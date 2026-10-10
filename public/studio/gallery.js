import * as THREE from './vendor/three.module.min.js';
import CameraControls from './vendor/camera-controls.js';
import { animate, spring } from './vendor/motion.js';
import { createGalleryRoom } from './gallery-room.js';
import { createGalleryControls } from './gallery-controls.js';
import { wheelDistance } from './gallery-navigation.js';

const $ = selector => document.querySelector(selector);
const stage = $('#gallery-stage');
const enter = $('#enter-gallery');
const status = $('#gallery-status');
const detail = $('#art-detail');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const embedded = new URLSearchParams(location.search).get('embedded') === '1' && parent !== window;
const events = new AbortController();
const animations = new Set();
const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, {...options, signal: events.signal});
const poses = {
  entrance: {position: [.38, 1.65, 3.72], target: [-.1, 1.9, -3.6], caption: 'At the entrance'},
  left: {position: [1.30, 1.65, 1.3], target: [-1.8, 1.95, 1.0], artwork: 'elongated'},
  center: {position: [0, 1.65, -1.1], target: [0, 1.95, -4.34], artwork: 'gaps'},
  right: {position: [-1.25, 1.65, -.85], target: [1.79, 1.95, -1.3], artwork: 'bent'}
};
let room, renderer, camera, scene, navigation, resizeObserver;
let entered = false, disposed = false, pausedByParent = false, contextLost = false;
let frame = 0, lastTime = 0, reading = 0, projection = true;
let gesture = null, held = null, closingDetail = false;
const keys = new Set();
const touches = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

if (embedded) {
  document.body.classList.add('gallery-embedded');
  document.querySelectorAll('a[href]').forEach(link => { link.target = '_top'; });
}
document.body.dataset.galleryState = 'loading';
const tellParent = payload => { if (embedded) parent.postMessage(payload, location.origin); };

function motion(element, keyframes, options = {}) {
  const animation = animate(element, keyframes, reducedMotion.matches ? {duration: 0} : {type: spring, stiffness: 285, damping: 31, mass: .9, ...options});
  animations.add(animation);
  animation.finished.then(() => animations.delete(animation));
  return animation.finished;
}

function clearInput() { keys.clear(); held = null; gesture = null; touches.clear(); }
function freeView() {
  document.body.dataset.activeArtwork = '';
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
}

function captionFor(pose) {
  const caption = $('#focus-caption');
  caption.replaceChildren();
  const art = room.artworks.find(item => item.id === pose.artwork);
  document.body.dataset.activeArtwork = art?.id || '';
  caption.append(document.createTextNode(art ? art.title : pose.caption));
  if (art) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'look-closer';
    button.append(document.createTextNode('Look closer '));
    const arrow = document.createElement('span');
    arrow.className = 'ui-icon icon-arrow-up-right';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(arrow);
    button.addEventListener('click', () => showArtwork(art));
    caption.append(button);
  }
  status.textContent = art ? `${art.title}. Use Look closer for an enlarged image and context.` : 'At the entrance to the room.';
}

function goTo(name) {
  const pose = poses[name];
  if (!pose || !entered) return;
  clearInput();
  const target = [...pose.target];
  if (pose.artwork && matchMedia('(max-width: 760px)').matches) target[1] -= .18;
  navigation.setView(pose.position, target);
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  captionFor(pose);
}

function showArtwork(art) {
  if (detail.open || disposed) return;
  clearInput(); navigation.interrupt(); navigation.controls.enabled = false;
  $('#detail-title').textContent = art.title;
  $('#detail-image').src = art.image;
  $('#detail-image').alt = art.title;
  $('#detail-copy').textContent = art.description;
  detail.showModal();
  stop();
  motion(detail, {opacity: [0, 1], scale: [.975, 1], y: [16, 0]});
}

async function closeArtwork() {
  if (!detail.open || closingDetail) return;
  closingDetail = true;
  await motion(detail, {opacity: 0, scale: .99, y: 8}, {type: 'tween', duration: .16, ease: 'easeOut'});
  if (disposed) return;
  detail.close();
  closingDetail = false;
  navigation.controls.enabled = entered && !pausedByParent;
  start();
}

function updateProjection() {
  room.setProjection(reading, projection);
  $('#projection-toggle').setAttribute('aria-pressed', String(projection));
  $('#projection-toggle').innerHTML = `<span class="projection-dot" aria-hidden="true"></span>Projection ${projection ? 'on' : 'off'}`;
  $('#reading-status').textContent = projection ? `Viewer drawing ${reading + 1} / 4` : 'The painting, without projection';
  $('#next-reading').disabled = !projection;
}

async function enterGallery() {
  if (entered || !navigation || disposed) return;
  entered = true;
  enter.disabled = true;
  const intro = $('#gallery-intro');
  if (!embedded) await motion(intro, {opacity: 0, y: 14}, {type: 'tween', duration: .22, ease: 'easeOut'});
  if (disposed) return;
  intro.hidden = true;
  $('#gallery-controls').hidden = false;
  motion($('#gallery-controls'), {opacity: [0, 1], y: [18, 0]});
  navigation.controls.enabled = !pausedByParent;
  navigation.setView([.15, 1.65, 2.55], poses.entrance.target);
  document.body.dataset.galleryState = 'entered';
  if (!embedded) stage.focus({preventScroll: true});
  status.textContent = 'You are inside. Drag to look around, use the arrow keys to walk, or choose a painting.';
}

function castArtwork(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(room.artworks.map(art => art.mesh), false)[0];
}

function bindControls() {
  listen(enter, 'click', enterGallery);
  document.querySelectorAll('[data-view]').forEach(button => listen(button, 'click', () => goTo(button.dataset.view)));
  listen($('#gallery-reset'), 'click', () => goTo('entrance'));
  listen($('#projection-toggle'), 'click', () => { projection = !projection; updateProjection(); });
  listen($('#next-reading'), 'click', () => { reading = (reading + 1) % 4; updateProjection(); });
  listen($('#detail-close'), 'click', closeArtwork);
  listen(detail, 'cancel', event => { event.preventDefault(); closeArtwork(); });
  listen(detail, 'click', event => {
    if (event.target !== detail) return;
    const rect = detail.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeArtwork();
  });

  const canvas = renderer.domElement;
  navigation.controls.addEventListener('controlstart', () => {
    if (!touches.size) {
      navigation.interrupt(); keys.clear(); held = null; freeView();
    }
  });
  navigation.controls.addEventListener('controlend', () => { gesture = null; touches.clear(); });
  // CameraControls owns document-level drag/touch tracking. These listeners
  // only distinguish a click on an artwork from a drag; floor clicks do nothing.
  listen(canvas, 'pointerdown', event => {
    if (!entered || detail.open || event.button !== 0) return;
    stage.focus({preventScroll: true});
    touches.add(event.pointerId);
    if (touches.size > 1) { if (gesture) gesture.cancelled = true; return; }
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, cancelled: false};
  });
  listen(canvas, 'pointermove', event => {
    if (!entered || detail.open) return;
    if (gesture?.id === event.pointerId) {
      gesture.distance = Math.max(gesture.distance, Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y));
    } else if (event.pointerType === 'mouse' && !touches.size) {
      canvas.style.cursor = castArtwork(event) ? 'pointer' : 'grab';
    }
  });
  listen(canvas, 'pointerup', event => {
    touches.delete(event.pointerId);
    if (!gesture || event.pointerId !== gesture.id) return;
    const clicked = gesture.distance < 6 && !gesture.cancelled;
    gesture = null;
    if (!clicked) return;
    const artworkId = castArtwork(event)?.object.userData.artworkId;
    const name = Object.keys(poses).find(name => poses[name].artwork === artworkId);
    if (artworkId && name) goTo(name);
  });
  listen(canvas, 'pointercancel', () => { gesture = null; touches.clear(); });
  listen(canvas, 'wheel', event => {
    if (!entered || detail.open || pausedByParent || event.ctrlKey) return;
    event.preventDefault();
    freeView();
    navigation.advance(wheelDistance(event, stage.clientHeight));
  }, {passive: false});

  const directions = {forward: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1]};
  document.querySelectorAll('[data-move]').forEach(button => {
    listen(button, 'pointerdown', event => {
      if (!entered || event.button !== 0) return;
      event.preventDefault();
      keys.clear(); held = directions[button.dataset.move]; freeView();
      navigation.walk(...held, .06);
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, () => { held = null; });
    listen(button, 'click', event => {
      if (event.detail !== 0) return;
      freeView();
      const direction = directions[button.dataset.move];
      if (direction[0]) navigation.advance(direction[0] * .25);
      else for (let i = 0; i < 3; i++) navigation.walk(...direction, .06);
    });
  });

  const navigationKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  listen(document, 'keydown', event => {
    if (event.code === 'Escape' && embedded && !detail.open) {
      event.preventDefault(); tellParent({type: 'helen:gallery-close'}); return;
    }
    if (!entered || detail.open || pausedByParent || !navigationKeys.includes(event.code) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target !== stage && event.target !== canvas && event.target !== document.body) return;
    event.preventDefault(); keys.add(event.code); freeView();
  });
  listen(document, 'keyup', event => keys.delete(event.code));
  listen(window, 'blur', () => { clearInput(); navigation.controls.cancel(); });
  listen(reducedMotion, 'change', () => navigation.setReducedMotion(reducedMotion.matches));
}

function resize() {
  if (!camera || !renderer || disposed) return;
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.fov = width < 760 ? 73 : 61;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function tick(time) {
  if (disposed || pausedByParent || document.hidden || contextLost || detail.open) { frame = 0; return; }
  const dt = Math.min((time - lastTime) / 1000 || 0, .06); lastTime = time;
  if (entered) {
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + (held?.[0] || 0);
    const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + (held?.[1] || 0);
    if (forward || sideways) navigation.walk(forward, sideways, dt);
  }
  navigation.update(dt);
  room.update(time / 1000);
  renderer.render(scene, camera);
  frame = requestAnimationFrame(tick);
}
function stop() { cancelAnimationFrame(frame); frame = 0; clearInput(); navigation?.controls.cancel(); }
function start() {
  if (!frame && renderer && room && navigation && !disposed && !contextLost && !pausedByParent && !document.hidden && !detail.open) {
    lastTime = performance.now(); frame = requestAnimationFrame(tick);
  }
}
function dispose() {
  if (disposed) return;
  disposed = true; stop(); events.abort(); resizeObserver?.disconnect();
  animations.forEach(animation => animation.stop()); animations.clear();
  navigation?.dispose(); room?.dispose(); renderer?.dispose();
}
function fallback(message) {
  stop();
  document.body.dataset.galleryState = 'fallback';
  if (renderer) renderer.domElement.hidden = true;
  $('#gallery-fallback').hidden = false;
  $('#gallery-controls').hidden = true;
  $('#gallery-intro').hidden = false;
  $('#gallery-intro').style.opacity = '1';
  $('#gallery-loading').textContent = message;
  enter.hidden = true;
  tellParent({type: 'helen:gallery-ready', fallback: true});
}

listen(document, 'visibilitychange', () => document.hidden ? stop() : start());
listen(window, 'pagehide', event => { if (event.persisted) stop(); else dispose(); });
listen(window, 'pageshow', event => { if (event.persisted) start(); });
listen(window, 'message', event => {
  if (!embedded || event.origin !== location.origin || event.source !== parent || event.data?.type !== 'helen:gallery-pause') return;
  pausedByParent = Boolean(event.data.paused);
  if (navigation) navigation.controls.enabled = entered && !pausedByParent && !detail.open;
  if (pausedByParent) stop(); else start();
});

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
    room = await createGalleryRoom(scene, renderer);
    if (disposed) { room.dispose(); renderer.dispose(); return; }
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    navigation = createGalleryControls({THREE, CameraControls, camera, domElement: canvas, reducedMotion: reducedMotion.matches});
    navigation.controls.enabled = false;
    navigation.setView(poses.entrance.position, poses.entrance.target, false);
    resize(); navigation.update(0); renderer.render(scene, camera);
    $('#gallery-fallback').hidden = true;
    enter.disabled = false;
    $('#gallery-loading').textContent = 'Take your time. There is no prescribed route.';
    document.body.dataset.galleryState = 'ready';
    updateProjection(); bindControls();
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
    listen(canvas, 'webglcontextlost', event => {
      event.preventDefault(); contextLost = true;
      fallback('The room paused. Reload to enter, or explore the project images.');
    });
    if (embedded) enterGallery();
    start();
    tellParent({type: 'helen:gallery-ready'});
  } catch (error) {
    console.error('Gallery could not open:', error);
    navigation?.dispose(); room?.dispose(); renderer?.dispose();
    if (!disposed) fallback('This device cannot open the 3D room. The installation image and project remain available.');
  }
}
init();
