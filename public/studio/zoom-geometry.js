// Pure geometry for the zoom viewer; nothing here touches the page. Sizes are
// {width, height}. Points are {x, y} measured from the stage centre. A view is
// {scale, x, y}, where x and y move the image's centre.

export const ZOOM = { min: 1, max: 4, doubleTap: 2.5, step: 1.5, panKey: 80, swipe: 56, tapTime: 300, tapDistance: 24 };

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** The image's size when all of it fits inside the stage. */
export function fitSize(stage, natural) {
  // Multiplying before dividing keeps exact sizes exact.
  return stage.width / stage.height > natural.width / natural.height
    ? { width: stage.height * natural.width / natural.height, height: stage.height }
    : { width: stage.width, height: stage.width * natural.height / natural.width };
}

function clampAxis(offset, fitted, stage, scale) {
  const overflow = (fitted * scale - stage) / 2;
  return overflow > 0 ? clamp(offset, -overflow, overflow) : 0;
}

/** Keeps the scale between fit and ZOOM.max, and the image from leaving an empty edge it could fill. */
export function clampView(view, fit, stage) {
  const scale = clamp(view.scale, ZOOM.min, ZOOM.max);
  return { scale, x: clampAxis(view.x, fit.width, stage.width, scale), y: clampAxis(view.y, fit.height, stage.height, scale) };
}

/** Zooms to `scale` while the image point under `focus` stays where it is. */
export function zoomAt(view, scale, focus, fit, stage) {
  const next = clamp(scale, ZOOM.min, ZOOM.max), ratio = next / view.scale;
  return clampView({ scale: next, x: focus.x - (focus.x - view.x) * ratio, y: focus.y - (focus.y - view.y) * ratio }, fit, stage);
}

/** A two-finger pinch: scales with the distance between the fingers and follows their midpoint. */
export function pinchView(start, now, fit, stage) {
  const scale = clamp(start.view.scale * now.distance / start.distance, ZOOM.min, ZOOM.max), ratio = scale / start.view.scale;
  return clampView({ scale, x: now.mid.x - (start.mid.x - start.view.x) * ratio, y: now.mid.y - (start.mid.y - start.view.y) * ratio }, fit, stage);
}

/** Moves the view by dx, dy pixels, as far as the image's edges allow. */
export function panBy(view, dx, dy, fit, stage) {
  return clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy }, fit, stage);
}

/** A wheel event's scale factor. Trackpad pinches arrive as wheel events with ctrlKey. */
export function wheelFactor({ deltaY, deltaMode = 0, ctrlKey = false }) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1);
  return Math.exp(-pixels * (ctrlKey ? 0.01 : 0.0015));
}

/** The index after stepping through a section. It wraps around, like the archive viewer. */
export function stepIndex(index, delta, length) {
  return (index + delta + length) % length;
}

/** A finished one-finger drag at fit: 1 for the next image (a swipe left), -1 for the previous, 0 for neither. */
export function swipeStep({ dx, dy }) {
  if (Math.abs(dx) < ZOOM.swipe || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** Two taps close enough in time and place to count as one double tap. */
export function isDoubleTap(previous, tap) {
  return Boolean(previous) && tap.time - previous.time <= ZOOM.tapTime && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= ZOOM.tapDistance;
}

/** What a key does: arrows step through the section at fit and move a zoomed image; plus, minus and 0 zoom. */
export function keyIntent(key, zoomed) {
  switch (key) {
    case 'ArrowLeft': return zoomed ? { pan: [ZOOM.panKey, 0] } : { step: -1 };
    case 'ArrowRight': return zoomed ? { pan: [-ZOOM.panKey, 0] } : { step: 1 };
    case 'ArrowUp': return zoomed ? { pan: [0, ZOOM.panKey] } : null;
    case 'ArrowDown': return zoomed ? { pan: [0, -ZOOM.panKey] } : null;
    case '+': case '=': return { zoom: 'in' };
    case '-': case '_': return { zoom: 'out' };
    case '0': return { zoom: 'reset' };
    default: return null;
  }
}
