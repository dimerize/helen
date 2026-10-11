/** Camera-only translation. Geometry, lens, horizon and field of view stay fixed. */
export function cameraJourneyOffset(THREE, camera, target, direction, phase) {
  const distance = camera.position.distanceTo(target);
  const height = 2 * distance * Math.tan(camera.fov * Math.PI / 360);
  const width = height * camera.aspect;
  const sign = phase === 'arrive' ? -1 : 1;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const backward = camera.position.clone().sub(target).normalize();
  return right.multiplyScalar(width * .14 * direction * sign).addScaledVector(backward, height * .065);
}

export function animateCameraJourney(THREE, camera, target, {direction, phase, duration, signal, render = () => {}}) {
  const origin = camera.position.clone(), look = target.clone();
  const offset = cameraJourneyOffset(THREE, camera, target, direction, phase);
  return new Promise(resolve => {
    let start, frame, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true; cancelAnimationFrame(frame); signal?.removeEventListener('abort', abort); resolve();
    };
    const place = amount => {
      camera.position.copy(origin).addScaledVector(offset, amount);
      target.copy(look).addScaledVector(offset, amount);
      camera.lookAt(target); render();
    };
    const abort = () => { place(0); finish(); };
    if (signal?.aborted) { finish(); return; }
    signal?.addEventListener('abort', abort, {once:true});
    place(phase === 'arrive' ? 1 : 0);
    function tick(now) {
      start ??= now;
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = t*t*t*(t*(t*6-15)+10);
      place(phase === 'arrive' ? 1-eased : eased);
      if (t < 1) frame=requestAnimationFrame(tick); else finish();
    }
    frame=requestAnimationFrame(tick);
  });
}
