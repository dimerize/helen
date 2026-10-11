import * as THREE from './vendor/three.module.min.js';
import { gsap } from './vendor/gsap.js';

export const GALLERY_OUTSIDE = { p: [.2,1.6,8], t: [0,1.58,-2] };
export const GALLERY_OVERVIEW = { p: [.12,1.62,1.8], t: [0,1.82,-4.3] };

// The homepage is a camera-facing sheet made from the real page capture. Its
// back remains in the gallery scene; this front crosses the viewport only for
// the hand-off. The door itself is never replaced with a screenshot.
export function createPortalArrivalTimeline({camera, sheet, onComplete}) {
  camera.position.set(.2, 1.6, 9.1);
  camera.lookAt(...GALLERY_OUTSIDE.t);
  if (sheet) {
    sheet.visible = true;
    sheet.position.set(0, 0, -1);
    sheet.rotation.set(0, 0, 0);
    sheet.material.opacity = 1;
  }
  const timeline = gsap.timeline({paused: true, onUpdate: () => camera.lookAt(...GALLERY_OUTSIDE.t), onComplete: () => {
    if (sheet) sheet.visible = false;
    onComplete?.();
  }});
  timeline.to(camera.position, {z: 8, duration: .95, ease: 'power3.out'}, 0);
  if (sheet) timeline
    .to(sheet.position, {x: -Math.max(1, sheet.scale.x) * 1.6, y: .12, z: -1.35, duration: .86, ease: 'power3.inOut'}, 0)
    .to(sheet.rotation, {y: -.72, z: .028, duration: .86, ease: 'power3.inOut'}, 0);
  return timeline;
}

export function createHomepageReturnTimeline({camera, sheet, preserveSheet = false, onComplete}) {
  if (sheet) {
    sheet.visible = true;
    sheet.material.opacity = 1;
    if (!preserveSheet) {
      sheet.position.set(-Math.max(1, sheet.scale.x) * 1.6, .12, -1.35);
      sheet.rotation.set(0, -.72, .028);
    }
  }
  const timeline = gsap.timeline({paused: true, onUpdate: () => camera.lookAt(...GALLERY_OUTSIDE.t), onComplete});
  timeline.to(camera.position, {x: .2, y: 1.6, z: 9.1, duration: .9, ease: 'power2.inOut'}, 0);
  if (sheet) timeline
    .to(sheet.position, {x: 0, y: 0, z: -1, duration: .9, ease: 'power3.inOut'}, 0)
    .to(sheet.rotation, {x: 0, y: 0, z: 0, duration: .9, ease: 'power3.inOut'}, 0);
  return timeline;
}

// A paused timeline is deliberate: loading the room must never open its door.
export function createEntranceTimeline({ camera, door, handle, onComplete }) {
  const look = new THREE.Vector3(...GALLERY_OUTSIDE.t);
  const timeline = gsap.timeline({
    paused: true,
    onUpdate: () => camera.lookAt(look),
    onComplete,
  });
  timeline
    .to(handle.rotation, { z: -.33, duration: .18, ease: 'power2.out' }, 0)
    .to(door.rotation, { y: 1.67, duration: .95, ease: 'power2.inOut' }, .13)
    .to(handle.rotation, { z: 0, duration: .4 }, .38)
    .to(camera.position, { x: .12, y: 1.62, z: 1.8, duration: 2, ease: 'power2.inOut' }, .6)
    .to(look, { y: 1.82, z: -4.3, duration: 1.5 }, .9);
  return timeline;
}

export function createExitTimeline({ camera, door, handle, onComplete }) {
  const look = new THREE.Vector3();
  camera.getWorldDirection(look);
  look.multiplyScalar(5).add(camera.position);
  const timeline = gsap.timeline({
    paused: true,
    onUpdate: () => camera.lookAt(look),
    onComplete,
  });
  timeline.to(look, { x: 0, y: 1.58, z: -2, duration: .65, ease: 'power2.inOut' }, 0);

  // The approved artwork stops fit a direct retreat. If the viewer has moved
  // alongside the opening, first center them inside it instead of crossing a wall.
  if (camera.position.z < 3.7 && Math.abs(camera.position.x) > .65) {
    timeline
      .to(camera.position, { x: 0, y: 1.62, z: Math.min(camera.position.z,2.8), duration: .55, ease: 'power2.inOut' }, 0)
      .to(camera.position, { x: .2, y: 1.6, z: 8, duration: 1.35, ease: 'power2.inOut' }, .55);
  } else {
    timeline.to(camera.position, { x: .2, y: 1.6, z: 8, duration: 1.9, ease: 'power2.inOut' }, 0);
  }
  timeline
    .to(door.rotation, { y: 0, duration: .8, ease: 'power2.inOut' }, 1.65)
    .to(handle.rotation, { z: 0, duration: .3 }, 0);
  return timeline;
}
