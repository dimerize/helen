import { clampPosition, nearestAngle } from './gallery-navigation.js';

// CameraControls owns every camera transform. The tiny orbit radius turns its
// damped orbit input into a first-person view without pointer locking the page.
export function createGalleryControls({ THREE, CameraControls, camera, domElement, reducedMotion = false }) {
  CameraControls.install({ THREE });
  const controls = new CameraControls(camera, domElement);
  const radius = .0001;
  const current = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  let reduce = Boolean(reducedMotion);
  let guided = false;

  controls.minDistance = controls.maxDistance = radius;
  controls.smoothTime = .32;
  controls.draggingSmoothTime = .11;
  controls.restThreshold = .001;
  controls.azimuthRotateSpeed = controls.polarRotateSpeed = -.30;
  controls.minPolarAngle = Math.PI / 2 - .72;
  controls.maxPolarAngle = Math.PI / 2 + .72;
  controls.mouseButtons.left = CameraControls.ACTION.ROTATE;
  controls.mouseButtons.middle = controls.mouseButtons.right = controls.mouseButtons.wheel = CameraControls.ACTION.NONE;
  controls.touches.one = CameraControls.ACTION.TOUCH_ROTATE;
  controls.touches.two = controls.touches.three = CameraControls.ACTION.NONE;
  controls.boundaryFriction = 0;
  controls.boundaryEnclosesCamera = true;
  controls.setBoundary(new THREE.Box3(new THREE.Vector3(-1.45, 1.65, -3.8), new THREE.Vector3(1.45, 1.65, 4.1)));

  function update(seconds) {
    controls.update(Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, .06)));
    camera.updateMatrixWorld();
  }

  function setView(position, lookAt, transition = true) {
    const bounded = clampPosition({x: position[0], z: position[2]});
    destination.set(bounded.x, bounded.y, bounded.z);
    direction.fromArray(lookAt).sub(destination).normalize();
    if (!direction.lengthSq()) direction.set(0, 0, -1);
    // The target is the visitor's eye position, not the artwork. The actual
    // camera sits a tenth of a millimetre behind it before boundary handling.
    eye.copy(destination).addScaledVector(direction, -radius);
    controls.normalizeRotations();
    const currentAngle = controls.getSpherical(spherical, false).theta;
    controls.setLookAt(eye.x, eye.y, eye.z, destination.x, destination.y, destination.z, transition && !reduce);
    controls.getSpherical(spherical, true);
    // normalizeRotations removes whole turns, but a target across ±PI still
    // needs its nearest equivalent angle to avoid almost a full revolution.
    controls.rotateTo(nearestAngle(currentAngle, spherical.theta), spherical.phi, transition && !reduce);
    guided = transition && !reduce;
    if (!transition || reduce) update(0);
  }

  function interrupt() {
    controls.getPosition(eye, false);
    controls.getTarget(destination, false);
    controls.setLookAt(eye.x, eye.y, eye.z, destination.x, destination.y, destination.z, false);
    // Updating zero deltas clears CameraControls' previous transition velocity.
    update(0);
    guided = false;
  }

  function translate(forward, sideways) {
    if (guided) interrupt();
    controls.getTarget(current, false);
    controls.getTarget(destination, true);
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    destination.addScaledVector(direction, forward);
    destination.x += -direction.z * sideways;
    destination.z += direction.x * sideways;
    // A fast wheel burst can queue only a short step, never a long unseen trip.
    offset.subVectors(destination, current);
    if (offset.length() > .45) destination.copy(current).add(offset.setLength(.45));
    const bounded = clampPosition(destination);
    controls.moveTo(bounded.x, bounded.y, bounded.z, !reduce);
    if (reduce) update(0);
  }

  function walk(forward, sideways, seconds) {
    const length = Math.max(1, Math.hypot(forward, sideways));
    const distance = Math.max(0, Math.min(seconds, .06)) * 1.35 / length;
    translate(forward * distance, sideways * distance);
  }

  function setReducedMotion(value) {
    reduce = Boolean(value);
    controls.draggingSmoothTime = reduce ? 0 : .11;
    if (reduce) interrupt();
  }

  setReducedMotion(reduce);
  return { controls, setView, update, interrupt, walk, advance: distance => translate(distance, 0), setReducedMotion, dispose: () => controls.dispose() };
}
