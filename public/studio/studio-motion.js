import { animate } from './vendor/motion.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Map();
const spring = { type: 'spring', visualDuration: .35, bounce: .06 };

function restore(element, values) {
  for (const [property, value] of Object.entries(values)) {
    if (value) element.style.setProperty(property, value);
    else element.style.removeProperty(property);
  }
}

function cancel(element) {
  const previous = running.get(element);
  if (!previous) return;
  running.delete(element);
  previous.animation?.cancel();
  restore(element, previous.original);
}

function surface(element, keyframes, onComplete = () => {}, duration = .35) {
  cancel(element);
  if (reduce.matches) { onComplete(); return; }
  const job = {
    original: { opacity: element.style.opacity, transform: element.style.transform },
    animation: null,
    finish: () => {
      if (running.get(element) !== job) return;
      running.delete(element);
      job.animation?.cancel();
      restore(element, job.original);
      onComplete();
    }
  };
  running.set(element, job);
  try {
    job.animation = animate(element, keyframes, {
      ...spring, visualDuration: duration,
      opacity: { duration: Math.min(duration, .22), ease: 'easeOut' },
      onComplete: job.finish
    });
    job.animation.finished.catch(job.finish);
  } catch {
    // Content and navigation remain available if an animation cannot start.
    job.finish();
  }
}

export function reveal(element, { distance = 10 } = {}) {
  if (!element) return;
  surface(element, {
    opacity: [0, 1],
    transform: [`translateY(${distance}px)`, 'translateY(0px)']
  });
}

export function createDialogMotion(dialog, { initialFocus, fallbackFocus } = {}) {
  let phase = 'closed';
  let trigger;
  let previousOverflow = '';
  let scrollLocked = false;

  function open(from = document.activeElement) {
    const reversing = phase === 'closing';
    const visible = reversing ? getComputedStyle(dialog) : null;
    const start = visible ? { opacity: visible.opacity, transform: visible.transform } : null;
    cancel(dialog);
    if (!dialog.open) {
      trigger = from;
      if (!scrollLocked) previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      scrollLocked = true;
    }
    phase = 'opening';
    initialFocus?.focus({ preventScroll: true });
    surface(dialog, {
      opacity: [start?.opacity ?? 0, 1],
      transform: [start?.transform ?? 'translateY(14px) scale(.985)', 'translateY(0px) scale(1)']
    }, () => { phase = 'open'; });
  }

  function close() {
    if (!dialog.open || phase === 'closing') return;
    const visible = getComputedStyle(dialog);
    const start = { opacity: visible.opacity, transform: visible.transform };
    phase = 'closing';
    surface(dialog, {
      opacity: [start.opacity, 0],
      transform: [start.transform, 'translateY(8px) scale(.985)']
    }, () => {
      if (phase === 'closing' && dialog.open) dialog.close();
    }, .24);
  }

  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    // A queued close event must not clean up a newer open of the same dialog.
    if (dialog.open) return;
    phase = 'closed';
    cancel(dialog);
    document.body.style.overflow = previousOverflow;
    scrollLocked = false;
    const target = trigger?.isConnected && trigger !== document.body ? trigger : fallbackFocus;
    target?.focus({ preventScroll: true });
  });
  return { open, close };
}

reduce.addEventListener('change', event => {
  if (event.matches) [...running.values()].forEach(job => job.finish());
});
