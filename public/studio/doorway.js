import { animate } from './vendor/motion.js';

const dialog = document.querySelector('#studio-portal');
const container = document.querySelector('#studio-frame');
const curtain = dialog.querySelector('.portal-curtain');
const leaf = curtain.querySelector('.door-leaf');
const doorway = curtain.querySelector('.portal-doorway');
const close = document.querySelector('#close-studio');
const status = document.querySelector('#portal-status');
const fallback = document.querySelector('#portal-fallback');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let phase = 'closed', frame, returnFocus, scrollPosition = 0, generation = 0, timer;
let pushedHistory = false, reopenAfterClose = false, restoreReveal = false;
const animations = new Set();
const spring = {type: 'spring', visualDuration: .48, bounce: .07};
const isRoomURL = () => new URL(location.href).searchParams.get('room') === 'gallery';
const notifyScanner = open => document.dispatchEvent(new CustomEvent('studio:gallery', {detail: {open}}));

function play(element, keyframes, options) {
  const animation = animate(element, keyframes, options);
  animations.add(animation);
  animation.finished.then(() => animations.delete(animation));
  return animation;
}

function stopAnimations() {
  animations.forEach(animation => animation.stop());
  animations.clear();
}

function startLoadingTimer(token) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (token !== generation || phase !== 'opening') return;
    status.textContent = 'The room is taking longer to open.'; fallback.hidden = false;
  }, 15000);
}

function finishReveal(token) {
  if (token !== generation || phase !== 'revealing') return;
  curtain.hidden = true; status.hidden = true;
  phase = 'open';
}

async function reveal(token, isFallback = false) {
  if (token !== generation || phase !== 'opening') return;
  phase = 'revealing'; clearTimeout(timer);
  fallback.hidden = true;
  status.textContent = isFallback ? 'Installation view' : 'Come in.';
  frame.style.opacity = '1';
  if (!reduced.matches) {
    // Explicit start values also reset Motion's cached transforms on repeat visits.
    await play(leaf, {rotateY: [-9, -108]}, {...spring, visualDuration: .62, bounce: .025});
    if (token !== generation) return;
    play(doorway, {scale: [1, 2.2]}, {type: 'spring', visualDuration: .65, bounce: 0});
    await play(curtain, {opacity: [1, 0]}, {duration: .5, delay: .13, ease: 'easeInOut'});
  }
  finishReveal(token);
}

function openRoom(trigger, fromHistory = false) {
  // A Forward traversal can arrive before the previous exit has finished.
  if (phase === 'closing') { if (fromHistory) reopenAfterClose = true; return; }
  if (phase !== 'closed') return;
  stopAnimations(); reopenAfterClose = false; restoreReveal = false;
  phase = 'opening'; const token = ++generation;
  returnFocus = trigger || document.querySelector('[data-open-gallery]');
  scrollPosition = scrollY;
  curtain.hidden = false; curtain.style.opacity = '1';
  doorway.style.transform = 'none'; leaf.style.transform = 'rotateY(-9deg)';
  status.hidden = false; status.textContent = 'Opening the room…'; fallback.hidden = true;
  document.body.classList.add('studio-open');
  dialog.showModal(); close.focus({preventScroll: true});
  notifyScanner(true);
  if (!reduced.matches) play(dialog, {opacity: [0, 1]}, {duration: .2});
  if (!fromHistory) {
    const url = new URL(location.href); url.searchParams.set('room', 'gallery');
    history.pushState({...history.state, studioPortal: true}, '', url); pushedHistory = true;
  } else pushedHistory = Boolean(history.state?.studioPortal);
  frame = document.createElement('iframe');
  frame.title = 'Walk through Beyond the Humanized Machine';
  frame.src = '/gallery?embedded=1';
  frame.setAttribute('allow', 'fullscreen');
  container.replaceChildren(frame);
  startLoadingTimer(token);
}

async function closeRoom(fromHistory = false) {
  if (phase === 'closing') { if (fromHistory) reopenAfterClose = false; return; }
  if (phase === 'closed') return;
  phase = 'closing'; reopenAfterClose = false; restoreReveal = false;
  ++generation; clearTimeout(timer); stopAnimations();
  frame?.contentWindow?.postMessage({type: 'helen:gallery-pause', paused: true}, location.origin);
  if (!reduced.matches) await play(dialog, {opacity: 0, scale: [1, .985]}, {type: 'spring', visualDuration: .3, bounce: 0});
  dialog.close(); container.replaceChildren(); frame = null;
  dialog.style.opacity = ''; dialog.style.transform = '';
  document.body.classList.remove('studio-open');
  window.scrollTo({top: scrollPosition, behavior: 'instant'});
  notifyScanner(false); returnFocus?.focus({preventScroll: true});
  phase = 'closed';
  if (reopenAfterClose && isRoomURL()) { openRoom(returnFocus, true); return; }
  if (!fromHistory && isRoomURL()) {
    if (pushedHistory && history.state?.studioPortal) history.back();
    else {const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(history.state, '', url);}
  }
  pushedHistory = false;
}

document.querySelectorAll('[data-open-gallery]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); openRoom(link);
  });
  const leaf = link.querySelector('.door-leaf');
  if (leaf) {
    for (const type of ['pointerenter', 'focus']) link.addEventListener(type, () => {
      if (!reduced.matches) animate(leaf, {rotateY: -23}, {...spring, visualDuration: .55});
    });
    for (const type of ['pointerleave', 'blur']) link.addEventListener(type, () => {
      if (!reduced.matches) animate(leaf, {rotateY: -9}, {...spring, visualDuration: .65});
    });
  }
});
close.addEventListener('click', () => closeRoom());
dialog.addEventListener('cancel', event => {event.preventDefault(); closeRoom();});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || !frame || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'helen:gallery-ready') reveal(generation, Boolean(event.data.fallback));
  if (event.data?.type === 'helen:gallery-close') closeRoom();
});
window.addEventListener('popstate', () => {
  if (isRoomURL()) openRoom(null, true);
  else closeRoom(true);
});
window.addEventListener('pagehide', event => {
  clearTimeout(timer);
  if (event.persisted && phase === 'revealing') {
    // Motion stop() does not resolve its finished promise. Invalidate the old
    // async reveal and finish it explicitly when this document is restored.
    ++generation; restoreReveal = true;
  }
  // Leave an exit running during BFCache suspension so its awaited completion
  // resumes naturally. A reveal is restored without replaying the doorway.
  if (!event.persisted || phase !== 'closing') stopAnimations();
});
window.addEventListener('pageshow', event => {
  if (!event.persisted || !dialog.open) return;
  if (phase !== 'closing') dialog.style.opacity = '1';
  if (restoreReveal) { restoreReveal = false; finishReveal(generation); }
  else if (phase === 'opening') startLoadingTimer(generation);
  frame?.contentWindow?.postMessage({type: 'helen:gallery-pause', paused: false}, location.origin);
});
if (isRoomURL()) openRoom(null, true);
