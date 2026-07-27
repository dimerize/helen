import { prefersReducedMotion } from './motion';

/*
  The wall behaves as one suspended system.

  Every work is a mass on a line. Scrolling drags the rig and the masses lag
  behind it, heavier ones further. Pulling one sideways swings it. And the
  system is balanced: displace one work and the rest drift the opposite way
  to compensate, the way a counterweighted rig actually settles.

  Mass comes from the work's area, so a large piece is genuinely heavier on
  the line than a small one and moves more slowly. That is the whole trick —
  the physics is driven by the real proportions of the work.

  Deliberately slow and heavy. Nothing here bounces, overshoots sharply, or
  behaves like a toy.
*/

/** Spring constant before mass is divided out. Low, so the period is long. */
const STIFFNESS = 0.006;
/** Per-frame velocity retention. High, so it settles over several seconds. */
const DAMPING = 0.94;
/** How hard the system fights its own net displacement. This is the counterweight. */
const COUPLING = 0.55;
/** Scroll velocity to vertical lag. */
const SCROLL_GAIN = 0.14;
/** Resistance felt when dragging a mass sideways. */
const DRAG_RESISTANCE = 0.55;
/** Below this, the system is asleep and the loop stops. */
const REST = 0.02;
/** Movement beyond this counts as a drag, not a click. */
const DRAG_THRESHOLD = 8;

interface Node {
  body: HTMLElement;
  line: HTMLElement | null;
  /** Natural length of the suspension line, in px. */
  lineLength: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Stiffness divided by mass. Bigger works get a smaller number. */
  k: number;
  held: boolean;
}

const bodies = Array.from(document.querySelectorAll<HTMLElement>('[data-hang]'));

if (bodies.length > 0 && !prefersReducedMotion()) {
  const nodes: Node[] = bodies.map((body) => {
    const line = body.parentElement?.querySelector<HTMLElement>('[data-hang-line]') ?? null;
    /*
      Mass from the work's own proportions. A 16:9 projection and a small
      portrait do not weigh the same on the line.
    */
    const ratio = Number(body.dataset.ratio) || 1.5;
    const mass = 0.7 + Math.min(2.2, ratio >= 1 ? ratio : 1 / ratio) * 0.5;

    return {
      body,
      line,
      lineLength: line ? line.offsetHeight || 40 : 40,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      k: STIFFNESS / mass,
      held: false,
    };
  });

  let raf = 0;
  let running = false;

  function draw(node: Node) {
    const { body, line, x, y } = node;

    // A mass on a line does not slide, it swings. Tie the tilt to the swing.
    body.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(x * 0.035).toFixed(3)}deg)`;

    if (line) {
      const length = node.lineLength + y;
      const angle = (Math.atan2(x, Math.max(length, 1)) * 180) / Math.PI;
      line.style.height = `${Math.max(0, length).toFixed(2)}px`;
      line.style.transform = `rotate(${angle.toFixed(3)}deg)`;
    }
  }

  function step() {
    // The system's net displacement. Everything not being held pushes against it.
    let netX = 0;
    let netY = 0;
    for (const node of nodes) {
      netX += node.x;
      netY += node.y;
    }
    netX /= nodes.length;
    netY /= nodes.length;

    let energy = 0;

    for (const node of nodes) {
      if (!node.held) {
        node.vx += -node.k * node.x - COUPLING * node.k * netX;
        node.vy += -node.k * node.y - COUPLING * node.k * netY;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
      }

      energy += Math.abs(node.vx) + Math.abs(node.vy) + Math.abs(node.x) + Math.abs(node.y);
      draw(node);
    }

    if (energy < REST * nodes.length && !nodes.some((n) => n.held)) {
      // Settle exactly, then stop burning frames until something happens.
      for (const node of nodes) {
        node.x = node.y = node.vx = node.vy = 0;
        draw(node);
      }
      running = false;
      return;
    }

    raf = requestAnimationFrame(step);
  }

  function wake() {
    if (running || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(step);
  }

  /* ── Scroll drags the rig; the masses lag behind it ──────────────────── */

  let lastScroll = scrollY;
  let scrollTimer = 0;

  addEventListener(
    'scroll',
    () => {
      const delta = scrollY - lastScroll;
      lastScroll = scrollY;

      // Clamped so a flung scroll does not throw the wall across the page.
      const impulse = Math.max(-14, Math.min(14, delta)) * SCROLL_GAIN;
      for (const node of nodes) node.vy -= impulse * node.k * 90;

      clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        lastScroll = scrollY;
      }, 120);

      wake();
    },
    { passive: true },
  );

  /* ── Pulling a work ──────────────────────────────────────────────────── */

  for (const node of nodes) {
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = 0;

    node.body.addEventListener(
      'pointerdown',
      (event: PointerEvent) => {
        // Let the browser keep secondary buttons and modified clicks.
        if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        originX = node.x;
        originY = node.y;
        moved = 0;
        node.held = true;
        node.vx = node.vy = 0;
        wake();
      },
      { passive: true },
    );

    node.body.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        if (pointerId !== event.pointerId || !node.held) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));

        node.x = originX + dx * DRAG_RESISTANCE;
        node.y = originY + dy * DRAG_RESISTANCE * 0.35;
        wake();
      },
      { passive: true },
    );

    const release = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      node.held = false;
      wake();
    };

    node.body.addEventListener('pointerup', release, { passive: true });
    node.body.addEventListener('pointercancel', release, { passive: true });

    /*
      A pull is not a click. Without this, swinging a work would also open
      it, which would make the whole system feel like a trap.
    */
    node.body.addEventListener('click', (event) => {
      if (moved > DRAG_THRESHOLD) {
        event.preventDefault();
        event.stopPropagation();
        moved = 0;
      }
    });
  }

  /* ── Focus and hover give the smallest nudge ─────────────────────────── */

  for (const node of nodes) {
    const nudge = () => {
      node.vy -= 0.55 * node.k * 90;
      wake();
    };
    node.body.addEventListener('pointerenter', nudge, { passive: true });
    node.body.addEventListener('focusin', nudge);
  }

  addEventListener(
    'resize',
    () => {
      for (const node of nodes) {
        if (node.line) node.lineLength = node.line.offsetHeight || node.lineLength;
      }
      wake();
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      running = false;
    } else {
      lastScroll = scrollY;
      wake();
    }
  });
}
