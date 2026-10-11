import { mountCarrier } from '../carrier-preview.js';
import {createFloorOutlet} from './floor-outlet.js';
import {placeScannerMagnifier} from './magnifier-placement.js';
import { registerStudioSurface } from '../separated-journey.js';
import * as THREE from '../vendor/three.module.min.js';
import { ScannerAudio } from './audio.js';
import { createSurfaceNavigator } from './navigation.js';
import { scanCycle, elapsedForScan } from './scan-cycle.js';
import { scanArchiveURL, scanIndexFromURL } from './scan-links.js';
import { createMagnifier, renderMagnifierPreview } from './magnifier.js';
import { animate as springAnimate } from '../vendor/motion.js';
import { animateCameraJourney } from '../camera-journey.js';
import { notifySpatialReady } from '../spatial-navigation.js';
import { installPrintHandoffSource } from '../print-handoff.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');
const sound = new ScannerAudio();
const keys = new Set();
const pointer = { x: 0, y: 0 };
const joystick = { x: 0, y: 0, active: false };
const player = { x: 0, z: 8, vx: 0, vz: 0, yaw: 0, jump: 0, jumpVelocity: 0 };
const visited = new Set();
const status = $('status');
let renderer, camera, world, magnifier;
let magnifierHover = false;
const magnifierPreviews = new Map();
let galleryOpen = false;
let navigationCamera = false;
let navigator, walkPath = [], waypoint, waypointLife = 0;
let walkableMeshes = [];
const raycaster = new THREE.Raycaster();
const cameraProbe = new THREE.Vector3();
let mode = 'loading';
let reduced = prefersReduced.matches;
let manualStill = false;
let time = 0, previous = 0, frame;
let pull = 0, pullTarget = 0, entryDrag = null;
let sceneDrag = null, orbitYaw = 0, orbitPitch = .5, orbitDistance = 4.0;
let cameraTarget = new THREE.Vector3();
let transition = null, travel = null;
let scanElapsed = 3.6, scanPhase = scanCycle(3.6).progress, movedTime = 0;
let entryScanProgress = scanPhase, lastMacro = 0;
const memories = new Map();
let locationId = '', lastLocationTime = -10, toastTimer;
let memoryImage = null, memoryExport = null, memoryLocation = '', soundEnabled = false;
let lastResize = { width: 0, height: 0 };
const debug = { errors: [], mode: 'loading', ready: false };
// Read-only diagnostic snapshot used by the prototype's own smoke checks.
Object.defineProperty(window, 'scannerExperience', { get: () => ({ ...debug, player: { ...player }, visited: [...visited], camera: camera?.position.toArray(), triangles: renderer?.info.render.triangles, calls: renderer?.info.render.calls }) });

function setMode(value) {
  mode = value;
  debug.mode = value;
  document.dispatchEvent(new CustomEvent('studio:scanner-mode',{detail:{mode:value}}));
  for (const item of document.querySelectorAll('.entrances,.site-footer')) item.inert = !['home', 'error', 'loading'].includes(value);
  $('print-layer').inert = value !== 'home';
  document.body.dataset.mode = value;
  const home = value === 'home';
  document.querySelector('.home-copy').inert = !home;
  document.querySelector('.home-nav').inert = !['home', 'error', 'loading'].includes(value);
  $('entry-handle').inert = !home;
  document.querySelector('.world-controls').inert = value !== 'world';
  document.querySelector('.world-top').inert = value !== 'world';
  document.querySelector('.touch-controls').inert = value !== 'world';
  $('lift-print').inert = !home;
  $('lift-print').setAttribute('aria-hidden', String(!home));
  document.querySelector('.world-caption').setAttribute('aria-hidden', String(value !== 'world'));
  if (magnifier) magnifier.group.visible = value === 'home';
}

function announce(text) { status.textContent = text; }
function clearMovementInput() {
  keys.clear(); joystick.active = false; joystick.x = joystick.y = 0;
  $('joystick-knob').style.transform = '';
  sceneDrag = null; walkPath = []; waypointLife = 0;
  player.vx = player.vz = 0;
}

function toast(text, duration = 2800) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), duration);
}

function heroPose() {
  // Keep the production model neutral for walking. Apply the inverse of its
  // original presentation transform to the camera and lights, preserving its view.
  const scene = $('scanner-scene');
  const pose = world.originalScanner.getPose(scene.clientWidth, scene.clientHeight);
  const inverse = new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rigRotation)).invert();
  const origin = new THREE.Vector3(...pose.rigPosition);
  const scale = world.width / 9.45;
  const transform = point => new THREE.Vector3(...point).sub(origin).applyQuaternion(inverse).multiplyScalar(scale);
  world.originalLightRig.quaternion.copy(inverse);
  world.originalLightRig.position.copy(origin).negate().applyQuaternion(inverse).multiplyScalar(scale);
  world.originalLightRig.scale.setScalar(scale);
  return { position: transform(pose.position), target: transform(pose.target), fov: pose.fov };
}

function selectArtwork(index, manual = false) {
  if (!world || (mode !== 'home' && mode !== 'loading')) return;
  index = (index + world.artworks.length) % world.artworks.length;
  if (world.currentArtwork.index !== index) world.setArtwork(index);
  const art = world.currentArtwork;
  if (manual) { scanElapsed = elapsedForScan(index); scanPhase = scanCycle(scanElapsed).progress; }
  visited.clear(); locationId = ''; walkPath = [];
  walkableMeshes = [world.scanMesh, ...world.root.getObjectByName('Physical typography, traced from the scan').children];
  const memory = memories.get(index);
  memoryImage = memory?.image || null; memoryExport = memory?.export || null; memoryLocation = memory?.location || '';
  $('scan-caption').textContent = art.title;
  updateMagnifierSource();
  $('scanner-scene').setAttribute('aria-label', `${art.alt}. Look closer to explore this scan in three dimensions.`);
  document.body.dataset.scan = art.id;
  $('map-source').src = new URL(`./assets/${art.image}`, import.meta.url).href; $('map-source').alt = art.alt;
  const crop = art.crop;
  Object.assign($('map-crop').style, { left: `${crop.minimum[0]*100}%`, top: `${crop.minimum[1]*100}%`, width: `${(crop.maximum[0]-crop.minimum[0])*100}%`, height: `${(crop.maximum[1]-crop.minimum[1])*100}%` });
  buildMap();
}

function worldPose(x = player.x, z = player.z, yaw = orbitYaw, pitch = orbitPitch, distance = orbitDistance) {
  const ground = world.heightAt(x, z);
  const eye = .21 + player.jump * .55;
  const target = new THREE.Vector3(x, ground + eye, z);
  const position = new THREE.Vector3(x + Math.sin(yaw) * distance, ground + .85 + Math.sin(pitch) * distance + player.jump * .35, z + Math.cos(yaw) * distance);
  return { position, target, fov: 57 };
}

function resize() {
  if (!renderer || !camera) return;
  const width = $('scanner-scene').clientWidth, height = $('scanner-scene').clientHeight;
  if (width === lastResize.width && height === lastResize.height) return;
  lastResize = { width, height };
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse.matches ? 1.45 : 1.75));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (magnifier) {
    magnifier.group.scale.setScalar(world.width / 9.45 * .73);
    updateMagnifierSource();
  }
  if (mode === 'home') {
    const p = heroPose(); camera.position.copy(p.position); cameraTarget.copy(p.target); camera.fov = p.fov; camera.lookAt(cameraTarget); camera.updateProjectionMatrix();
  }
}

function groundSafe(x, z) {
  const b = world.bounds;
  return { x: clamp(x, b.minX, b.maxX), z: clamp(z, b.minZ, b.maxZ) };
}

function clearanceHeight(x, z) {
  return Math.max(world.heightAt(x, z), world.heightAt(x + .13, z), world.heightAt(x - .13, z), world.heightAt(x, z + .13), world.heightAt(x, z - .13));
}

function walkToPointer(clientX, clientY) {
  if (mode !== 'world' || travel || player.jump > .02 || isDialogOpen() || !$('map-panel').hidden) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), camera);
  const hit = raycaster.intersectObjects(walkableMeshes, false)[0];
  if (!hit) return;
  const destination = groundSafe(hit.point.x, hit.point.z);
  const path = navigator.findPath({ x: player.x, z: player.z }, destination);
  if (!path.length) { toast('Select open ground.', 1900); return; }
  walkPath = path;
  const end = path[path.length - 1];
  waypoint.position.set(end.x, world.heightAt(end.x, end.z) + .025, end.z);
  waypointLife = 1;
}

function findSafeSpot(x, z) {
  const start = groundSafe(x, z);
  // A landing needs room for the visitor's feet, not merely a clear centre.
  const safe = p => !world.isBlocked(p.x, p.z, .16) && clearanceHeight(p.x, p.z) - world.heightAt(p.x, p.z) < .15;
  let best = safe(start) ? start : null;
  let low = best ? world.heightAt(best.x, best.z) : Infinity;
  for (let r = .25; r <= 2.5; r += .25) {
    for (let i = 0; i < 16; i++) {
      const p = groundSafe(start.x + Math.sin(i * Math.PI / 8) * r, start.z + Math.cos(i * Math.PI / 8) * r);
      const h = world.heightAt(p.x, p.z);
      if (safe(p) && h < low - .035) { best = p; low = h; }
    }
    if (best && r >= 1) break;
  }
  return best || start;
}

function buildEntryPath(fromPose, toPose) {
  const position = new THREE.CatmullRomCurve3([
    fromPose.position.clone(),
    fromPose.position.clone().lerp(new THREE.Vector3(player.x + 7, 13, world.depth / 2 + 11), .55),
    new THREE.Vector3(player.x + 4, 10, world.depth / 2 + 8),
    new THREE.Vector3(player.x + 1.4, 4.4, player.z + 6),
    toPose.position.clone(),
  ], false, 'catmullrom', .35);
  const target = new THREE.CatmullRomCurve3([
    fromPose.target.clone(),
    new THREE.Vector3(0, 1, 1),
    new THREE.Vector3(0, .2, 5.5),
    new THREE.Vector3(player.x, .4, player.z - .5),
    toPose.target.clone(),
  ], false, 'catmullrom', .3);
  return { position, target };
}

function enterWorld() {
  if (mode !== 'home' || !world || transition || navigationCamera) return;
  closeMap();
  window.scrollTo({top: 0, behavior: 'instant'});
  $('print-layer').replaceChildren();
  if ($('print-dialog').open) $('print-dialog').close();
  world.setMacro(1);
  const spawn = findSafeSpot(world.currentArtwork.spawn.x, world.currentArtwork.spawn.z);
  Object.assign(player, { ...spawn, vx: 0, vz: 0, yaw: 0, jump: 0, jumpVelocity: 0 });
  orbitYaw = world.currentArtwork.spawn.yaw || 0; orbitPitch = .55; orbitDistance = innerWidth < 600 ? 4.0 : 4.5;
  const from = { position: camera.position.clone(), target: cameraTarget.clone(), fov: camera.fov };
  const to = worldPose();
  world.setMacro(0);
  transition = { start: time, duration: reduced || manualStill ? .65 : 6.0, still: reduced || manualStill, ...buildEntryPath(from, to), fromFov: from.fov, toFov: to.fov, direction: 'enter' };
  entryScanProgress = scanPhase;
  setMode('entering');
  sound.cue('enter');
  announce('Getting closer to the scan. You will be free to move with arrow keys or W A S D.');
  $('entry-handle').blur();
  $('pull-fill').parentElement.style.opacity = 0;
}

function exitWorld() {
  if (mode !== 'world' || transition) return;
  closeMap(); travel = null; clearMovementInput();
  if ($('print-dialog').open) $('print-dialog').close();
  captureMemory(false);
  const from = { position: camera.position.clone(), target: cameraTarget.clone(), fov: camera.fov };
  const to = heroPose();
  const position = new THREE.CatmullRomCurve3([from.position, new THREE.Vector3(player.x * .6, 7, player.z + 6), new THREE.Vector3(8, 19, 27), to.position], false, 'catmullrom', .35);
  const target = new THREE.CatmullRomCurve3([from.target, new THREE.Vector3(player.x * .5, 0, player.z * .6), new THREE.Vector3(0, 0, 0), to.target], false, 'catmullrom', .3);
  transition = { start: time, duration: reduced || manualStill ? .65 : 4.5, still: reduced || manualStill, position, target, fromFov: from.fov, toFov: to.fov, direction: 'leave' };
  setMode('leaving');
  sound.cue('exit');
  announce('Returning to the scanner. Lift a print, or look closer again.');
}

function tickTransition() {
  const tr = transition;
  const progress = clamp((time - tr.start) / tr.duration);
  // One continuous curve keeps the object and landscape spatially connected.
  const t = tr.still ? (progress < .5 ? 0 : 1) : smoother(progress);
  camera.position.copy(tr.position.getPoint(t));
  cameraTarget.copy(tr.target.getPoint(t));
  camera.fov = lerp(tr.fromFov, tr.toFov, tr.still ? t : smooth(progress));
  camera.updateProjectionMatrix();
  const visualProgress = tr.still ? t : progress;
  const macro = tr.direction === 'enter' ? smooth(clamp((visualProgress - .20) / .67)) : 1 - smooth(clamp(visualProgress / .80));
  world.setMacro(macro);
  scanPhase = tr.direction === 'enter' ? lerp(entryScanProgress, 1, smooth(clamp(visualProgress / .34))) : lerp(1, entryScanProgress, smooth(clamp((visualProgress - .7) / .3)));
  world.visitor.visible = macro > .82;
  // Soft exposure lift accompanies crossing the scan light; never a hard cut.
  const crossing = Math.sin(Math.PI * clamp((progress - .4) / .4));
  $('transition-wash').style.background = tr.still ? '#09090b' : '#eee7d5';
  $('transition-wash').style.opacity = tr.still ? Math.sin(Math.PI * progress) : Math.max(0, crossing) * .045;
  if (progress < 1) return macro;
  transition = null;
  $('transition-wash').style.opacity = 0;
  if (tr.direction === 'enter') {
    setMode('world'); world.setMacro(1); scanPhase = 1; world.visitor.visible = true; movedTime = 0;
    updateLocation(true); announce('Beneath the glass. Move with W A S D or arrow keys. Drag to look. Space to hop. Escape returns to the surface.');
    $('return-home').focus({ preventScroll: true });
    setTimeout(() => { if (mode === 'world') $('return-home').blur(); }, 150);
  } else {
    setMode('home'); pull = pullTarget = 0; world.setMacro(0); world.visitor.visible = false;
    $('entry-handle').focus({ preventScroll: true });
  }
  return tr.direction === 'enter' ? 1 : 0;
}

function hop() {
  if (mode !== 'world' || player.jump > .02 || travel || isDialogOpen() || !$('map-panel').hidden) return;
  player.jumpVelocity = 3.4;
  walkPath = []; waypointLife = 0;
  player.jump = .002;
  sound.cue('hop');
}

function tickMovement(dt) {
  if (travel) { tickTravel(); return; }
  const blocked = isDialogOpen() || !$('map-panel').hidden;
  let ix = blocked ? 0 : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joystick.x;
  let iz = blocked ? 0 : (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + joystick.y;
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  if (len > .05) { walkPath = []; waypointLife = 0; }
  const maxSpeed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.1 : 1.8;
  let vx = (ix * Math.cos(orbitYaw) + iz * Math.sin(orbitYaw)) * maxSpeed;
  let vz = (iz * Math.cos(orbitYaw) - ix * Math.sin(orbitYaw)) * maxSpeed;
  if (!blocked && walkPath.length) {
    while (walkPath.length && Math.hypot(walkPath[0].x - player.x, walkPath[0].z - player.z) < .16) walkPath.shift();
    if (walkPath.length) {
      const point = walkPath[0], dx = point.x - player.x, dz = point.z - player.z;
      const length = Math.hypot(dx, dz), pace = Math.min(1.55, length * 4);
      vx = dx / length * pace; vz = dz / length * pace;
    } else waypointLife = 0;
  }
  if (!blocked) orbitYaw += ((keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0)) * dt * 1.2;
  player.vx = damp(player.vx, vx, len > .05 ? 7 : 11, dt);
  player.vz = damp(player.vz, vz, len > .05 ? 7 : 11, dt);
  const ground = world.heightAt(player.x, player.z);
  let next = groundSafe(player.x + player.vx * dt, player.z + player.vz * dt);
  const canStep = (x, z) => clearanceHeight(x, z) - ground < .3 + player.jump;
  if (canStep(next.x, next.z)) { player.x = next.x; player.z = next.z; }
  else if (canStep(next.x, player.z)) { player.x = next.x; player.vz *= .3; }
  else if (canStep(player.x, next.z)) { player.z = next.z; player.vx *= .3; }
  else { player.vx *= .2; player.vz *= .2; }
  const speed = Math.hypot(player.vx, player.vz);
  if (speed > .08) {
    player.yaw = angleLerp(player.yaw, Math.atan2(-player.vx, -player.vz), 1 - Math.exp(-12 * dt));
    movedTime += dt;
  }
  if (player.jump > 0 || player.jumpVelocity > 0) {
    player.jumpVelocity -= 8 * dt;
    player.jump += player.jumpVelocity * dt;
    if (player.jump <= 0) { player.jump = 0; player.jumpVelocity = 0; sound.cue('land'); }
  }
  const pose = worldPose();
  // Lift just enough to see the little visitor over a nearby paper ridge.
  for (let s = 1; s <= 28; s++) {
    const t = s / 28;
    const sample = cameraProbe.lerpVectors(pose.target, pose.position, t);
    if (Math.abs(sample.x) > world.width / 2 || Math.abs(sample.z) > world.depth / 2) continue;
    if (world.heightAt(sample.x, sample.z) + .24 > sample.y && t > .075) {
      pose.position.y = Math.min(pose.target.y + 8, Math.max(pose.position.y, pose.target.y + (world.heightAt(sample.x, sample.z) + .24 - pose.target.y) / t));
    }
  }
  const camRate = reduced || manualStill ? 25 : 5.5;
  camera.position.lerp(pose.position, 1 - Math.exp(-camRate * dt));
  cameraTarget.lerp(pose.target, 1 - Math.exp(-8 * dt));
  const camFloor = world.heightAt(clamp(camera.position.x, world.bounds.minX, world.bounds.maxX), clamp(camera.position.z, world.bounds.minZ, world.bounds.maxZ));
  camera.position.y = Math.max(camera.position.y, camFloor + .35);
  updateLocation();
}

function visitStation(id) {
  if (mode !== 'world') return;
  const station = world.landmarks.find(s => s.id === id); if (!station) return;
  closeMap(); keys.clear(); walkPath = []; waypointLife = 0;
  const destination = findSafeSpot(station.position.x, station.position.z);
  player.jumpVelocity = 0;
  const toYaw = station.viewYaw ?? 0;
  const endPose = worldPose(destination.x, destination.z, toYaw);
  travel = { start: time, duration: reduced || manualStill ? .65 : 2.7, still: reduced || manualStill, from: { x: player.x, z: player.z }, to: destination, fromYaw: orbitYaw, toYaw, fromCamera: camera.position.clone(), toCamera: endPose.position, fromTarget: cameraTarget.clone(), toTarget: endPose.target, fromHeight: world.heightAt(player.x, player.z) + player.jump, toHeight: world.heightAt(destination.x, destination.z) };
  sound.cue('landmark');
  announce(`Moving to ${station.title}.`);
}

function tickTravel() {
  const t = clamp((time - travel.start) / travel.duration);
  const p = travel.still ? (t < .5 ? 0 : 1) : smoother(t);
  player.x = lerp(travel.from.x, travel.to.x, p);
  player.z = lerp(travel.from.z, travel.to.z, p);
  player.vx = player.vz = 0;
  const flightHeight = lerp(travel.fromHeight, travel.toHeight, p) + (travel.still ? 0 : Math.sin(Math.PI * p) * 5);
  player.jump = flightHeight - world.heightAt(player.x, player.z);
  orbitYaw = angleLerp(travel.fromYaw, travel.toYaw, p);
  camera.position.lerpVectors(travel.fromCamera, travel.toCamera, p);
  camera.position.y += travel.still ? 0 : Math.sin(Math.PI * p) * 5;
  cameraTarget.lerpVectors(travel.fromTarget, travel.toTarget, p);
  cameraTarget.y += travel.still ? 0 : Math.sin(Math.PI * p) * 2;
  if (travel.still) { $('transition-wash').style.background = '#09090b'; $('transition-wash').style.opacity = Math.sin(Math.PI * t); }
  if (t === 1) { travel = null; player.jump = player.jumpVelocity = 0; $('transition-wash').style.opacity = 0; updateLocation(true); }
}

function updateLocation(force = false) {
  if (!world?.landmarks.length) return;
  let closest, distance = Infinity;
  for (const p of world.landmarks) { const d = Math.hypot(player.x - p.position.x, player.z - p.position.z); if (d < distance) { closest = p; distance = d; } }
  if (closest && (force || closest.id !== locationId && time - lastLocationTime > 2.5)) {
    locationId = closest.id; lastLocationTime = time;
    $('location-title').textContent = closest.title;
    $('location-description').textContent = closest.subtitle;
    $('location-kicker').textContent = 'Beneath the glass';
  }
  if (closest && distance < 2.2 && !visited.has(closest.id)) {
    visited.add(closest.id);
    document.querySelector(`[data-pin="${closest.id}"]`)?.classList.add('visited');
    if (visited.size > 1) sound.cue('landmark');
    announce(closest.title + '. ' + closest.subtitle);
  }
  const marker = $('map-player');
  const uv = world.currentArtwork.worldToSource(player.x, player.z);
  marker.style.left = `${uv[0] * 100}%`;
  marker.style.top = `${uv[1] * 100}%`;
  marker.firstElementChild.style.transform = `rotate(${player.yaw}rad)`;
}

function buildMap() {
  $('map-pins').replaceChildren(); $('station-list').replaceChildren();
  for (const [index, station] of world.landmarks.entries()) {
    const pin = document.createElement('button'); pin.className = 'map-pin'; pin.dataset.pin = station.id; pin.textContent = String(index + 1); pin.setAttribute('aria-label', `Visit ${station.title}`);
    const uv = world.currentArtwork.worldToSource(station.position.x, station.position.z);
    pin.style.left = `${uv[0] * 100}%`; pin.style.top = `${uv[1] * 100}%`;
    pin.addEventListener('click', () => visitStation(station.id)); $('map-pins').append(pin);
    const button = document.createElement('button'); button.className = 'station-button';
    const name = document.createElement('span'); name.textContent = station.title; const arrow = document.createElement('span'); arrow.className = 'ui-icon icon-arrow-up-right'; arrow.setAttribute('aria-hidden', 'true'); button.append(name, arrow);
    button.addEventListener('click', () => visitStation(station.id)); $('station-list').append(button);
  }
}
function openMap() { if (mode !== 'world') return; $('map-panel').hidden = false; $('map-toggle').setAttribute('aria-expanded', 'true'); clearMovementInput(); $('map-close').focus(); }
function closeMap() { const wasOpen = !$('map-panel').hidden; $('map-panel').hidden = true; $('map-toggle').setAttribute('aria-expanded', 'false'); if (wasOpen && mode === 'world') $('map-toggle').focus(); }
function isDialogOpen() { return $('help-dialog').open || $('print-dialog').open; }

function captureMemory(open = true) {
  if (!renderer || !world || !camera) return;
  renderer.render(world.scene, camera);
  memoryImage = renderer.domElement.toDataURL('image/png');
  memoryLocation = $('location-title').textContent || 'Found on the train';
  const exportCanvas = document.createElement('canvas');
  const w = Math.min(1600, renderer.domElement.width), h = Math.round(w * renderer.domElement.height / renderer.domElement.width);
  exportCanvas.width = w; exportCanvas.height = h + 95;
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#eae5d9'; ctx.fillRect(0, 0, w, h + 95);
  ctx.drawImage(renderer.domElement, 20, 20, w - 40, h * (w - 40) / w);
  ctx.fillStyle = '#282722'; ctx.font = '21px Helvetica, Arial, sans-serif'; ctx.fillText('Beneath the glass', 25, h + 36);
  ctx.fillStyle = '#696256'; ctx.font = '13px Helvetica, Arial, sans-serif'; ctx.fillText('Helen Zhang  /  ' + ($('location-title').textContent || 'Found on the train'), 25, h + 63);
  memoryExport = exportCanvas.toDataURL('image/png');
  memories.set(world.currentArtwork.index, { image: memoryImage, export: memoryExport, location: memoryLocation });
  if (!open) return;
  sound.cue('shutter');
  openPrint(true);
}

let lifted = 0;
function liftScan() {
  if (!world || mode !== 'home' || navigationCamera) return;
  const art = world.currentArtwork;
  const layer = $('print-layer');
  if (layer.children.length >= 4) layer.firstElementChild.remove();
  const card = document.createElement('article'); card.className = 'loose-print';
  const n = lifted++, turn = [-6, 5, -2, 8][n % 4];
  const width = Math.min(290, innerWidth - 80);
  card.style.width = `${width}px`; card.style.setProperty('--turn', `${turn}deg`);
  card.style.left = `${clamp(innerWidth * .52 + n % 3 * 22, 24, innerWidth - width - 46)}px`;
  card.style.top = `${Math.max(120, innerHeight * .24 + n % 3 * 22)}px`;
  card.innerHTML = '<div class="print-handle" tabindex="0" role="group" aria-label="Move print with arrow keys"><span></span><button class="print-close" aria-label="Put scan away"><span class="ui-icon icon-close" aria-hidden="true"></span></button></div><img><a class="print-archive-link"><span>View in archive</span><span class="ui-icon icon-arrow-up-right" aria-hidden="true"></span></a><button class="paper-lens" aria-label="Explore this scan in three dimensions"><img class="magnifier-preview" alt=""><span class="sr-only">Explore scan</span></button>';
  card.querySelector('img').src = new URL(`./assets/${art.image}`, import.meta.url).href;
  card.querySelector('img').alt = art.alt;
  card.querySelector('.print-archive-link').href = scanArchiveURL(art.index);
  const preview = card.querySelector('.magnifier-preview');
  try {
    if (!magnifierPreviews.has(art.index)) magnifierPreviews.set(art.index, renderMagnifierPreview(THREE, {texture: world.scanMesh.material.map, sourceOptions: magnifierSourceOptions(), size:256}).toDataURL());
    preview.src = magnifierPreviews.get(art.index);
  } catch { preview.hidden = true; card.querySelector('.paper-lens .sr-only').className = 'lens-fallback-label'; }
  card.querySelector('.paper-lens').addEventListener('click', () => { selectArtwork(art.index, true); enterWorld(); });
  card.querySelector('.print-close').addEventListener('click', async () => {
    if (!reduced && !manualStill) await springAnimate(card, {opacity: 0, y: 22, rotate: turn - 3}, {duration: .22});
    card.remove(); $('lift-print').focus({preventScroll: true});
  });
  layer.append(card);
  const printImage=card.querySelector(':scope > img');
  printImage.decode().then(()=>{if(card.isConnected)mountCarrier(card,printImage,art.title);}).catch(()=>{});
  if (!reduced && !manualStill) springAnimate(card, {opacity: [0, 1], y: [70, 0], rotate: [turn - 8, turn], scale: [.82, 1]}, {type: 'spring', visualDuration: .5, bounce: .12});
  const handle = card.querySelector('.print-handle'); handle.focus({preventScroll: true});
  let drag = null;
  const setPosition = (x, y) => { card.style.left = `${clamp(x, 10, innerWidth - width - 32)}px`; card.style.top = `${clamp(y, 90, innerHeight - 95)}px`; };
  handle.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || event.button !== 0) return;
    event.preventDefault(); handle.setPointerCapture(event.pointerId);
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,left:card.offsetLeft,top:card.offsetTop}; card.style.zIndex = String(++lifted);
  });
  handle.addEventListener('pointermove', event => { if (drag?.id === event.pointerId) setPosition(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y); });
  for (const name of ['pointerup','pointercancel']) handle.addEventListener(name, () => { drag = null; });
  handle.addEventListener('keydown', event => {
    const movement = {ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[event.key];
    if (!movement) return; event.preventDefault(); setPosition(card.offsetLeft + movement[0], card.offsetTop + movement[1]);
  });
  announce(`Lifted ${art.title}. Find this image in the archive, or use the magnifier to enter its surface.`);
}

function openPrint(photo = false) {
  const hasPhoto = photo && memoryImage;
  $('print-image').src = hasPhoto ? memoryImage : new URL(`./assets/${world.currentArtwork.image}`, import.meta.url).href;
  $('print-image').alt = hasPhoto ? 'Your view from inside the scan, printed on a cream sheet' : world.currentArtwork.alt;
  $('print-heading').textContent = hasPhoto ? 'Photo' : 'Scan';
  $('print-title').textContent = hasPhoto ? memoryLocation : world.currentArtwork.title;
  $('print-subtitle').textContent = 'Helen Zhang';
  $('print-archive').href = scanArchiveURL(world.currentArtwork.index);
  $('print-enter').hidden = Boolean(hasPhoto) || mode !== 'home';
  $('photo-download').hidden = !hasPhoto;
  if (hasPhoto) $('photo-download').href = memoryExport;
  clearMovementInput(); $('print-dialog').showModal();
}

function magnifierSourceOptions() {
  const art = world.currentArtwork, position = magnifier.group.position;
  const centerUV = world.originalScanner.platenToImageUV(position.x/world.width+.5,position.z/world.depth+.5,art.index);
  const diameter = 1.59 * magnifier.group.scale.x;
  return {centerUV, sourceSpan: [diameter / world.width * (art.crop.maximum[0]-art.crop.minimum[0]), diameter / world.depth * (art.crop.maximum[1]-art.crop.minimum[1])], magnification: 2, scanProgress: scanPhase, platenCenterV: .5-position.z/world.depth, platenSpanV: diameter/world.depth};
}
function updateMagnifierSource() {
  if (magnifier && world) magnifier.setSource(world.scanMesh.material.map, magnifierSourceOptions());
}
function updateEntryHandle() {
  if (!magnifier) return;
  updateMagnifierSource();
  const {clientWidth: width, clientHeight: height} = $('scanner-scene');
  magnifier.group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(magnifier.group);
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
    const point=new THREE.Vector3(x,y,z).project(camera);
    const px=(point.x*.5+.5)*width, py=(-point.y*.5+.5)*height;
    minX=Math.min(minX,px); maxX=Math.max(maxX,px); minY=Math.min(minY,py); maxY=Math.max(maxY,py);
  }
  const handle=$('entry-handle');
  handle.style.left=`${(minX+maxX)/2}px`; handle.style.top=`${(minY+maxY)/2}px`;
  handle.style.width=`${Math.max(48,maxX-minX+12)}px`; handle.style.height=`${Math.max(48,maxY-minY+12)}px`;
  magnifier.update({hover:magnifierHover,time,reduced:reduced||manualStill});
}

function animate(now) {
  frame = requestAnimationFrame(animate);
  const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
  previous = now;
  if (document.hidden || !world || galleryOpen || (document.body.dataset.studioRoute==='archive' && !navigationCamera)) return;
  time += dt;
  if (mode === 'home' && !manualStill && !reduced && !entryDrag && !isDialogOpen()) {
    scanElapsed += dt;
    const cycle = scanCycle(scanElapsed);
    if (cycle.index !== world.currentArtwork.index) selectArtwork(cycle.index);
    scanPhase = cycle.progress;
  }
  let macro = mode === 'world' ? 1 : 0;
  if (transition) macro = tickTransition();
  else if (mode === 'home' && !navigationCamera) {
    pull = damp(pull, pullTarget, 10, dt);
    const pose = heroPose();
    const approach = pull * .16;
    const close = new THREE.Vector3(2, 12, world.depth / 2 + 10);
    pose.position.lerp(close, approach);
    camera.position.lerp(pose.position, 1 - Math.exp(-4 * dt)); cameraTarget.lerp(pose.target, 1 - Math.exp(-4 * dt));
    camera.fov = damp(camera.fov, pose.fov, 4, dt); camera.updateProjectionMatrix();
    world.setMacro(0); world.visitor.visible = false;
    $('pull-fill').style.width = `${pull * 100}%`;
  } else if (mode === 'world') tickMovement(dt);
  camera.lookAt(cameraTarget);
  if (mode === 'home') updateEntryHandle();
  world.setVisitor({ x: player.x, z: player.z, yaw: player.yaw, moving: Math.hypot(player.vx, player.vz) > .08 ? Math.hypot(player.vx, player.vz) : 0, time, jump: player.jump });
  world.update(time, dt, { macro, scanProgress: scanPhase, paused: manualStill || reduced });
  world.setScan(scanPhase);
  lastMacro = macro;
  renderer.toneMappingExposure = lerp(1.3, 1.18, macro);
  if (waypoint) {
    waypoint.material.opacity = damp(waypoint.material.opacity, mode === 'world' ? waypointLife * .8 : 0, 7, dt);
    waypoint.visible = waypoint.material.opacity > .01;
    const ringScale = reduced || manualStill ? 1 : 1 + Math.sin(time * 3) * .08;
    waypoint.scale.setScalar(ringScale);
  }
  sound.update({ mode, speed: player.jump ? 0 : clamp(Math.hypot(player.vx, player.vz) / 2.8), scale: macro, scan: scanPhase, time });
  renderer.render(world.scene, camera);
}

function bindInput() {
  const handle = $('entry-handle');
  for (const event of ['pointerenter','focus']) handle.addEventListener(event, () => { magnifierHover=true; });
  for (const event of ['pointerleave','blur']) handle.addEventListener(event, () => { magnifierHover=false; });
  handle.addEventListener('pointerdown', e => {
    if (mode !== 'home') return;
    e.preventDefault(); handle.setPointerCapture(e.pointerId);
    entryDrag = { y: e.clientY, x: e.clientX, max: 0, pointerId: e.pointerId };
    $('pull-fill').parentElement.style.opacity = 1;
  });
  handle.addEventListener('pointermove', e => {
    if (!entryDrag) return;
    const distance = entryDrag.y - e.clientY;
    entryDrag.max = Math.max(entryDrag.max, Math.abs(distance));
    pullTarget = clamp(distance / Math.min(190, innerHeight * .24));
  });
  handle.addEventListener('pointerup', () => {
    if (!entryDrag) return;
    const activate = pullTarget > .48 || entryDrag.max < 7;
    entryDrag = null;
    if (activate) enterWorld(); else { pullTarget = 0; $('pull-fill').parentElement.style.opacity = 0; }
  });
  handle.addEventListener('pointercancel', () => { entryDrag = null; pullTarget = 0; $('pull-fill').parentElement.style.opacity = 0; });
  handle.addEventListener('click', e => { if (e.detail === 0) enterWorld(); });
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', e => {
    if ((e.pointerType !== 'touch' && (e.button !== 0 || !e.isPrimary)) || sceneDrag || mode !== 'world' || isDialogOpen() || !$('map-panel').hidden) return;
    sceneDrag = { x: e.clientX, y: e.clientY, originX: e.clientX, originY: e.clientY, distance: 0, pointerId: e.pointerId }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth - .5; pointer.y = e.clientY / innerHeight - .5;
    if (!sceneDrag || sceneDrag.pointerId !== e.pointerId || mode !== 'world') return;
    sceneDrag.distance = Math.max(sceneDrag.distance, Math.hypot(e.clientX - sceneDrag.originX, e.clientY - sceneDrag.originY));
    orbitYaw -= (e.clientX - sceneDrag.x) * .0045;
    orbitPitch = clamp(orbitPitch + (e.clientY - sceneDrag.y) * .003, .10, 1.15);
    sceneDrag.x = e.clientX; sceneDrag.y = e.clientY;
  });
  canvas.addEventListener('pointerup', e => {
    if (sceneDrag?.pointerId === e.pointerId && sceneDrag.distance < 6) walkToPointer(e.clientX, e.clientY);
    sceneDrag = null;
  });
  canvas.addEventListener('pointercancel', () => { sceneDrag = null; });
  canvas.addEventListener('wheel', e => { if (mode !== 'world') return; e.preventDefault(); orbitDistance = clamp(orbitDistance + e.deltaY * .004, 2.0, 7); }, { passive: false });
  const stick = $('joystick');
  function updateStick(e) {
    const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / 31, y = (e.clientY - r.top - r.height / 2) / 31;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    joystick.x = x; joystick.y = y; $('joystick-knob').style.transform = `translate(${x * 26}px,${y * 26}px)`;
  }
  stick.addEventListener('pointerdown', e => { e.preventDefault(); joystick.active = true; stick.setPointerCapture(e.pointerId); updateStick(e); });
  stick.addEventListener('pointermove', e => { if (joystick.active) updateStick(e); });
  const resetStick = () => { joystick.active = false; joystick.x = joystick.y = 0; $('joystick-knob').style.transform = ''; };
  stick.addEventListener('pointerup', resetStick); stick.addEventListener('pointercancel', resetStick);
  $('touch-hop').addEventListener('pointerdown', e => { e.preventDefault(); hop(); });
  $('touch-hop').addEventListener('click', e => { if (e.detail === 0) hop(); });
  addEventListener('keydown', e => {
    if (isDialogOpen()) return;
    if (e.code === 'Space' && e.target.closest?.('button, a, input, select, textarea, [role=button]')) return;
    if (e.code === 'Escape') { if (!$('map-panel').hidden) closeMap(); else exitWorld(); return; }
    if (mode === 'world' && ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code); if (e.code === 'Space' && !e.repeat) hop(); }
    if (mode === 'world' && e.code === 'KeyM' && !e.repeat) { e.preventDefault(); $('map-panel').hidden ? openMap() : closeMap(); }
    if (mode === 'world' && e.code === 'KeyP' && !e.repeat) captureMemory();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); resetStick(); sceneDrag = null; if (mode === 'home') { entryDrag = null; pullTarget = 0; } });
  $('return-home').addEventListener('click', exitWorld);
  $('brand-home').addEventListener('click', e => { e.preventDefault(); if (mode === 'world') exitWorld(); });
  $('home-link').addEventListener('click', e => e.preventDefault());
  $('lift-print').addEventListener('click', liftScan);
  $('print-close').addEventListener('click', () => $('print-dialog').close());
  $('print-enter').addEventListener('click', enterWorld);
  $('photo-button').addEventListener('click', () => captureMemory());
  $('map-toggle').addEventListener('click', () => $('map-panel').hidden ? openMap() : closeMap());
  $('map-close').addEventListener('click', closeMap);
  $('help-button').addEventListener('click', () => { clearMovementInput(); $('help-dialog').showModal(); });
  for (const id of ['help-close','help-done']) $(id).addEventListener('click', () => $('help-dialog').close());
  $('motion-button').addEventListener('click', () => {
    manualStill = !manualStill; $('motion-button').textContent = manualStill || reduced ? 'Reduced motion enabled' : 'Reduce motion'; $('motion-button').setAttribute('aria-pressed', String(manualStill || reduced));
    document.body.dataset.motion = manualStill || reduced ? 'reduced' : 'full';
  });
  $('sound-button').addEventListener('click', async () => {
    if (soundEnabled) { sound.disable(); soundEnabled = false; }
    else soundEnabled = await sound.enable();
    $('sound-button').setAttribute('aria-pressed', String(soundEnabled)); $('sound-label').textContent = soundEnabled ? 'Disable sound' : 'Enable sound';
    if (soundEnabled) sound.cue('landmark');
  });
  prefersReduced.addEventListener('change', e => { reduced = e.matches; document.body.dataset.motion = manualStill || reduced ? 'reduced' : 'full'; $('motion-button').textContent = reduced || manualStill ? 'Reduced motion enabled' : 'Reduce motion'; $('motion-button').setAttribute('aria-pressed', String(reduced || manualStill)); });
  if (reduced) { $('motion-button').textContent = 'Reduced motion enabled'; $('motion-button').setAttribute('aria-pressed', 'true'); }
  document.addEventListener('visibilitychange', () => { previous = 0; keys.clear(); if (document.hidden) sound.disable(); else if (soundEnabled) sound.enable(); });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); toast('3D view paused. Reload to resume.', 15000); cancelAnimationFrame(frame); });
}

function bindGalleryCapture() {
  document.addEventListener('studio:gallery', event => {
    galleryOpen = Boolean(event.detail.open); previous = 0; clearMovementInput();
    if (!galleryOpen) {
      // During a shared-scene arrival the camera is already the final camera.
      // A second hero-pose reset here made the cable jump at the canvas handoff.
      if(!navigationCamera){const pose=heroPose();camera.position.copy(pose.position);cameraTarget.copy(pose.target);camera.fov=pose.fov;camera.lookAt(cameraTarget);camera.updateProjectionMatrix();}
      notifySpatialReady('home');
    }
  });
  galleryOpen = document.body.classList.contains('studio-open');
  document.addEventListener('studio:scanner-capture', event => {
    const request = event.detail;
    if (!request?.canvas || !world) return;
    const ctx = request.canvas.getContext('2d'); if (!ctx) return;
    if (galleryOpen && !manualStill && !reduced && !document.hidden) {
      scanElapsed += clamp(request.delta || 0, 0, .15);
      const cycle = scanCycle(scanElapsed);
      if (cycle.index !== world.currentArtwork.index) selectArtwork(cycle.index);
      scanPhase = cycle.progress;
    }
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect, exposure: renderer.toneMappingExposure, waypoint: waypoint.visible, visitor: world.visitor.visible };
    const pose = heroPose();
    camera.position.copy(pose.position); camera.lookAt(pose.target); camera.fov = pose.fov; camera.updateProjectionMatrix();
    world.setMacro(0); world.setScan(mode === 'home' ? scanPhase : entryScanProgress); waypoint.visible = false; renderer.toneMappingExposure = 1.3;
    renderer.render(world.scene, camera);
    ctx.clearRect(0, 0, request.canvas.width, request.canvas.height);
    ctx.drawImage(renderer.domElement, 0, 0, request.canvas.width, request.canvas.height);
    request.ready = true; request.revision = world.currentArtwork.index;
    world.setMacro(lastMacro); world.setScan(scanPhase); waypoint.visible = saved.waypoint; world.visitor.visible = saved.visitor;
    camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion); camera.fov = saved.fov; camera.aspect = saved.aspect; camera.updateProjectionMatrix(); renderer.toneMappingExposure = saved.exposure;
    renderer.render(world.scene, camera);
  });
}

function bindCameraNavigation() {
  document.addEventListener('studio:camera-travel-cancel', () => { navigationCamera = false; });
  document.addEventListener('studio:camera-travel', event => {
    const detail = event.detail;
    if (detail.route !== 'home' || galleryOpen || mode !== 'home' || detail.promise) return;
    if (manualStill || reduced) { detail.promise = Promise.resolve(); return; }
    const pose = heroPose();
    camera.position.copy(pose.position); cameraTarget.copy(pose.target); camera.lookAt(cameraTarget);
    navigationCamera = true; clearMovementInput();
    detail.promise = animateCameraJourney(THREE, camera, cameraTarget, detail).finally(() => {
      // Keep the departing camera where it stopped until the destination opens.
      // Arrival returns exactly to the existing production camera pose.
      if (detail.phase === 'arrive' || detail.signal?.aborted) navigationCamera = false;
    });
  });
  addEventListener('pageshow', event => {
    if (event.persisted) { navigationCamera = false; previous = 0; }
  });
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x080809);
    $('scanner-scene').append(renderer.domElement);
    camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .035, 250);
    const { createScannerWorld } = await import('./world.js');
    world = await createScannerWorld(THREE, renderer);
    world.scene.add(createFloorOutlet(THREE,world.width/9.45));
    magnifier = createMagnifier(THREE);
    placeScannerMagnifier(THREE,magnifier.group,world.width/9.45);
    world.scene.add(magnifier.group);
    navigator = createSurfaceNavigator({ bounds: world.bounds, heightAt: clearanceHeight, stepHeight: .29, cellSize: .22 });
    walkableMeshes = [world.scanMesh, ...world.root.getObjectByName('Physical typography, traced from the scan').children];
    waypoint = new THREE.Mesh(new THREE.RingGeometry(.12, .145, 36), new THREE.MeshBasicMaterial({ color: '#ffe2ae', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    waypoint.rotation.x = -Math.PI / 2; waypoint.visible = false; world.root.add(waypoint);
    const p = heroPose(); camera.position.copy(p.position); cameraTarget.copy(p.target); camera.fov = p.fov; camera.lookAt(cameraTarget);
    world.setMacro(0); world.visitor.visible = false;
    new ResizeObserver(resize).observe($('scanner-scene')); resize();
    selectArtwork(scanIndexFromURL(location.href) ?? 0, true); bindInput();
    bindGalleryCapture();
    bindCameraNavigation(); installPrintHandoffSource();
    setMode('home'); $('entry-handle').disabled = false;
    debug.ready = true;
    renderer.render(world.scene, camera);
    $('scanner-scene').classList.add('is-webgl');
    $('loading').hidden = true;
    announce('Scanner ready. Lift the current scan, or use its magnifier to explore. Scans change automatically.');
    frame = requestAnimationFrame(animate);
    registerStudioSurface('home', {
      scene:world.scene, camera, exposure:1.3,shading:true,
      prepare(){resize();const pose=heroPose();camera.position.copy(pose.position);cameraTarget.copy(pose.target);camera.fov=pose.fov;camera.lookAt(cameraTarget);camera.updateProjectionMatrix();renderer.render(world.scene,camera);},
      deactivate(){$('print-layer').replaceChildren();lifted=0;pull=pullTarget=0;entryDrag=null;},
      viewport:()=>$('scanner-scene').getBoundingClientRect(),
      async retreat(){
        if(mode==='home'||mode==='error')return;
        const waitMode=value=>mode===value?Promise.resolve():new Promise(resolve=>{const onMode=e=>{if(e.detail.mode===value){document.removeEventListener('studio:scanner-mode',onMode);resolve();}};document.addEventListener('studio:scanner-mode',onMode);});
        if(mode==='entering')await waitMode('world');
        if(mode==='world')exitWorld();
        await waitMode('home');
      },
      freeze(){navigationCamera=true;clearMovementInput();},
      release(){navigationCamera=false;previous=0;renderer.render(world.scene,camera);},
      enterScan(id){const index=scanIndexFromURL(new URL(`/?scan=${encodeURIComponent(id)}`,location.href).href);if(index!==null){selectArtwork(index,true);enterWorld();}},
    });
    document.dispatchEvent(new CustomEvent('studio:home-ready'));
    notifySpatialReady('home');
    const entryURL = new URL(location.href);
    if (entryURL.searchParams.get('explore') === '1' && scanIndexFromURL(location.href) !== null && !entryURL.searchParams.has('room')) {
      entryURL.searchParams.delete('explore'); history.replaceState(history.state, '', entryURL);
      requestAnimationFrame(enterWorld);
    }
  } catch (error) {
    console.error('Scanner experience could not start:', error);
    debug.errors.push(error.message); setMode('error');document.dispatchEvent(new CustomEvent('studio:home-ready')); $('loading').hidden = true; $('fallback').hidden = false;
    $('retry-button').addEventListener('click', () => location.reload());
  }
}
addEventListener('pagehide', e => { if (e.persisted) return; cancelAnimationFrame(frame); sound.dispose(); magnifier?.dispose(); world?.dispose?.(); renderer?.dispose(); });
init();
