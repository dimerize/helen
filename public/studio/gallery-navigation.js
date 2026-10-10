const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const limit = (value, min, max) => Math.min(max, Math.max(min, value));

// Keep the camera at a visitor's eye height and away from canvas surfaces.
export function clampPosition(position) {
  return {x: limit(finite(position.x), -1.45, 1.45), y: 1.65, z: limit(finite(position.z), -3.8, 4.1)};
}

export function movePosition(position, yaw, input, seconds) {
  const forward = finite(input.forward);
  const sideways = finite(input.sideways);
  const length = Math.max(1, Math.hypot(forward, sideways));
  const distance = limit(finite(seconds), 0, 1) * 1.35 / length;
  const angle = finite(yaw);
  return clampPosition({
    x: finite(position.x) + (Math.sin(angle) * forward + Math.cos(angle) * sideways) * distance,
    z: finite(position.z) + (-Math.cos(angle) * forward + Math.sin(angle) * sideways) * distance
  });
}

export function rotateView(yaw, pitch, deltaX, deltaY) {
  return {yaw: finite(yaw) - finite(deltaX) * .003, pitch: limit(finite(pitch) + finite(deltaY) * .003, -.72, .72)};
}

export function nearestAngle(current, target) {
  return current + Math.atan2(Math.sin(target - current), Math.cos(target - current));
}
