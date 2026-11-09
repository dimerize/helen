import { createDialogMotion } from './studio-motion.js';
import { ZOOM, fitSize, clampView, zoomAt, pinchView, panBy, wheelFactor, stepIndex, swipeStep, isDoubleTap, keyIntent } from './zoom-geometry.js';

// The full-screen viewer in ZoomViewer.astro. Any link with data-zoom opens it
// and the viewer moves through the links of the same [data-zoom-group]. Each
// link carries data-caption, and data-compare (with data-compare-label) for an
// image the viewer can show beside it. One view is shared by the visible panes.

const AT_FIT = { scale: 1, x: 0, y: 0 };

export function createZoomViewer(dialog) {
  const $ = selector => dialog.querySelector(selector);
  const stage = $('.zoom-stage'), caption = $('#zoom-caption'), position = $('.zoom-position'), status = $('.zoom-status'), compareButton = $('.zoom-compare');
  const panes = [...dialog.querySelectorAll('.zoom-pane')].map(element => ({ element, img: element.querySelector('img'), label: element.querySelector('.zoom-pane-label') }));
  const [itemPane, comparePane] = panes;
  const motion = createDialogMotion(dialog, { initialFocus: $('.zoom-close') });
  const pointers = new Map();
  let items = [], index = 0, view = AT_FIT, comparing = false, loadToken = 0, gesture = null, lastTap = null, wheelTimer = 0;

  const visible = () => panes.filter(pane => pane.element.getClientRects().length > 0);
  // The pane that zoom limits are measured against; every visible pane shares its view.
  const reference = () => visible().find(pane => pane.fit);
  const paneAt = target => visible().find(pane => pane.element.contains(target)) ?? reference();
  function centred(pane, clientX, clientY) {
    const rect = (pane ?? itemPane).element.getBoundingClientRect();
    return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) };
  }

  function apply({ animate = true } = {}) {
    if (!animate) stage.classList.add('is-gesturing');
    for (const pane of panes) pane.img.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    stage.classList.toggle('is-zoomed', view.scale > 1);
    if (!animate) { void stage.offsetWidth; if (!pointers.size) stage.classList.remove('is-gesturing'); }
  }

  function layout() {
    for (const pane of visible()) {
      if (!pane.natural) continue;
      // Layout sizes, not the drawn rect, which shrinks while the dialog scales in.
      pane.size = { width: pane.element.clientWidth, height: pane.element.clientHeight };
      pane.fit = fitSize(pane.size, pane.natural);
      pane.img.style.width = `${pane.fit.width}px`;
      pane.img.style.height = `${pane.fit.height}px`;
    }
    const ref = reference();
    if (ref) view = clampView(view, ref.fit, ref.size);
    apply({ animate: false });
  }

  function load(pane, src, shown, alt, token) {
    pane.element.querySelector('.zoom-unavailable')?.remove();
    pane.img.hidden = false;
    pane.img.alt = alt;
    pane.fit = null;
    // Show what the page has already loaded at once, then swap in the full file.
    const ready = shown?.complete && shown.naturalWidth ? shown : null;
    pane.natural = ready ? { width: ready.naturalWidth, height: ready.naturalHeight }
      : shown ? { width: +shown.getAttribute('width'), height: +shown.getAttribute('height') } : null;
    if (ready) pane.img.src = ready.currentSrc;
    else pane.img.removeAttribute('src');
    const full = new Image();
    full.onload = () => {
      if (token !== loadToken) return;
      pane.img.src = full.src;
      pane.natural = { width: full.naturalWidth, height: full.naturalHeight };
      layout();
    };
    full.onerror = () => {
      if (token !== loadToken || ready) return;
      pane.img.hidden = true;
      pane.element.insertAdjacentHTML('afterbegin', '<p class="zoom-unavailable">Image unavailable. Please try again.</p>');
    };
    full.src = src;
  }

  function show(next) {
    index = next;
    view = AT_FIT;
    const trigger = items[index], shown = trigger.querySelector('img'), token = ++loadToken;
    const { caption: text = '', compare, compareLabel = '' } = trigger.dataset;
    caption.textContent = text;
    position.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    for (const button of dialog.querySelectorAll('[data-zoom-step]')) button.hidden = items.length < 2;
    compareButton.hidden = !compare;
    compareButton.querySelector('span').textContent = compareLabel;
    itemPane.label.textContent = shown?.alt ?? '';
    comparePane.label.textContent = compareLabel;
    load(itemPane, trigger.href, shown, shown?.alt ?? '', token);
    if (compare) load(comparePane, compare, null, compareLabel, token);
    setComparing(comparing);
  }

  function setComparing(on) {
    comparing = on;
    const active = comparing && !compareButton.hidden;
    dialog.classList.toggle('is-comparing', active);
    compareButton.setAttribute('aria-pressed', String(active));
    layout();
  }

  function step(delta) {
    if (items.length < 2) return;
    // On phones comparing switches between two images, so a step shows the next one.
    if (comparing && !itemPane.element.getClientRects().length) comparing = false;
    show(stepIndex(index, delta, items.length));
    status.textContent = `${position.textContent}. ${caption.textContent}`;
  }

  function zoom(action) {
    const ref = reference();
    if (!ref) return;
    view = action === 'reset' ? AT_FIT : zoomAt(view, view.scale * (action === 'in' ? ZOOM.step : 1 / ZOOM.step), { x: 0, y: 0 }, ref.fit, ref.size);
    apply();
  }

  function open(trigger) {
    const group = trigger.closest('[data-zoom-group]');
    items = group ? [...group.querySelectorAll('a[data-zoom]')] : [trigger];
    // Comparing carries across steps, but every opening starts on the image that was chosen.
    comparing = false;
    // Opening is announced by the dialog's name; the status speaks only for steps.
    status.textContent = '';
    show(Math.max(0, items.indexOf(trigger)));
    motion.open(trigger);
    // Panes have a size only once the dialog is showing.
    layout();
  }

  // Measured from the pane the pinch began on, which side by side may be the right-hand one.
  const fingers = pane => {
    const [a, b] = [...pointers.values()];
    return { mid: centred(pane, (a.x + b.x) / 2, (a.y + b.y) / 2), distance: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };
  const dragFrom = (point, afterPinch = false) => ({ kind: 'drag', origin: point, last: point, startScale: view.scale, afterPinch });

  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.classList.add('is-gesturing');
    if (pointers.size === 2) {
      const pane = paneAt(event.target);
      gesture = { kind: 'pinch', pane, start: { view, ...fingers(pane) } };
    } else gesture = dragFrom({ x: event.clientX, y: event.clientY });
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const ref = reference();
    if (!ref) return;
    if (gesture.kind === 'pinch' && pointers.size === 2) {
      view = pinchView(gesture.start, fingers(gesture.pane), ref.fit, ref.size);
      apply();
    } else if (gesture.kind === 'drag' && view.scale > 1) {
      view = panBy(view, event.clientX - gesture.last.x, event.clientY - gesture.last.y, ref.fit, ref.size);
      gesture.last = { x: event.clientX, y: event.clientY };
      stage.classList.add('is-dragging');
      apply();
    }
  });
  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    const ended = gesture;
    if (pointers.size === 1) { const [point] = pointers.values(); gesture = dragFrom(point, true); return; }
    if (pointers.size) return;
    gesture = null;
    stage.classList.remove('is-gesturing', 'is-dragging');
    if (event.type !== 'pointerup' || ended?.kind !== 'drag' || ended.afterPinch) return;
    const dx = event.clientX - ended.origin.x, dy = event.clientY - ended.origin.y;
    if (Math.hypot(dx, dy) < 10) {
      const tap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
      if (!isDoubleTap(lastTap, tap)) { lastTap = tap; return; }
      lastTap = null;
      const ref = reference();
      if (!ref) return;
      view = view.scale > 1 ? AT_FIT : zoomAt(view, ZOOM.doubleTap, centred(paneAt(event.target), event.clientX, event.clientY), ref.fit, ref.size);
      apply();
    } else if (ended.startScale === 1) {
      const delta = swipeStep({ dx, dy });
      if (delta) step(delta);
    }
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // A trackpad pinch arrives as ctrl+wheel: anywhere in the viewer it zooms the image, never the page.
  dialog.addEventListener('wheel', event => {
    if (!event.ctrlKey && !stage.contains(event.target)) return;
    event.preventDefault();
    const ref = reference();
    if (!ref) return;
    stage.classList.add('is-gesturing');
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { if (!pointers.size) stage.classList.remove('is-gesturing'); }, 150);
    view = zoomAt(view, view.scale * wheelFactor(event), centred(paneAt(event.target), event.clientX, event.clientY), ref.fit, ref.size);
    apply();
  }, { passive: false });

  // Safari on a Mac reports trackpad pinches as gesture events instead. Touch screens
  // pinch through the stage's pointers, and keep the system pinch on the bars.
  if (!navigator.maxTouchPoints) {
    let pinchStart = null;
    dialog.addEventListener('gesturestart', event => { event.preventDefault(); pinchStart = view; stage.classList.add('is-gesturing'); });
    dialog.addEventListener('gesturechange', event => {
      event.preventDefault();
      const ref = reference();
      if (!ref || !pinchStart) return;
      view = zoomAt(view, pinchStart.scale * event.scale, centred(paneAt(event.target), event.clientX, event.clientY), ref.fit, ref.size);
      apply();
    });
    dialog.addEventListener('gestureend', event => {
      event.preventDefault();
      pinchStart = null;
      if (!pointers.size) stage.classList.remove('is-gesturing');
    });
  }

  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const intent = keyIntent(event.key, view.scale > 1);
    if (!intent) return;
    event.preventDefault();
    const ref = reference();
    if (intent.step) step(intent.step);
    else if (intent.pan && ref) { view = panBy(view, ...intent.pan, ref.fit, ref.size); apply(); }
    else if (intent.zoom) zoom(intent.zoom);
  });
  $('.zoom-close').addEventListener('click', () => motion.close());
  for (const button of dialog.querySelectorAll('[data-zoom-action]')) button.addEventListener('click', () => zoom(button.dataset.zoomAction));
  for (const button of dialog.querySelectorAll('[data-zoom-step]')) button.addEventListener('click', () => step(Number(button.dataset.zoomStep)));
  compareButton.addEventListener('click', () => setComparing(!comparing));
  dialog.addEventListener('close', () => { pointers.clear(); gesture = null; stage.classList.remove('is-gesturing', 'is-dragging'); });
  addEventListener('resize', () => { if (dialog.open) layout(); });

  return { open, close: () => motion.close() };
}

/** Opens the viewer from every a[data-zoom] under root. Without JavaScript they stay plain links to the image file. */
export function enhanceZoomTriggers(root, viewer) {
  for (const link of root.querySelectorAll('a[data-zoom]')) {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      // Modified and middle clicks still open the file itself.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      viewer.open(link);
    });
  }
}
