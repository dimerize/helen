import { prefersReducedMotion } from './motion';

/*
  Brings works into alignment as they enter view, and lets them decay as
  they leave.

  Driven entirely by IntersectionObserver, never by hover — so it behaves
  identically on a phone, on a desktop, and for someone tabbing through
  with a keyboard.

  States, set on the element as data-state:
    idle      empty placement rectangle
    resolved  the work, in focus
    ghost     an afterimage, on its way back to idle
*/

const DECAY_MS = 1400; // keep in step with --dur-decay

type Plate = HTMLElement & { _decay?: number };

const plates = Array.from(document.querySelectorAll<Plate>('[data-plate]'));

if (plates.length > 0) {
  if (prefersReducedMotion()) {
    /*
      Nothing moves, so nothing needs observing: the exhibition is simply
      installed. Every work is present and stays present.
    */
    for (const plate of plates) plate.dataset.state = 'resolved';
  } else {
    const setState = (plate: Plate, state: 'idle' | 'resolved' | 'ghost') => {
      if (plate._decay) {
        clearTimeout(plate._decay);
        plate._decay = undefined;
      }

      plate.dataset.state = state;

      if (state === 'ghost') {
        // Hold the afterimage, then let the placement empty out.
        plate._decay = window.setTimeout(() => {
          plate.dataset.state = 'idle';
          plate.style.willChange = '';
          plate._decay = undefined;
        }, DECAY_MS);
      } else if (state === 'idle') {
        plate.style.willChange = '';
      }
    };

    const resolve = (plate: Plate) => {
      const img = plate.querySelector<HTMLImageElement>('[data-plate-img]');

      // Only pull focus once there is something to bring into focus.
      if (img && !img.complete) {
        img.addEventListener('load', () => setState(plate, 'resolved'), { once: true });
        img.addEventListener('error', () => setState(plate, 'resolved'), { once: true });
        return;
      }

      setState(plate, 'resolved');
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const plate = entry.target as Plate;

          /*
            will-change is applied only while a transition is actually
            running. Leaving it on permanently would keep a compositor
            layer alive for every work on the page.
          */
          plate.style.willChange = 'opacity, transform, filter';

          if (entry.isIntersecting) resolve(plate);
          else if (plate.dataset.state === 'resolved') setState(plate, 'ghost');
          else setState(plate, 'idle');
        }
      },
      {
        // Begin a little before the work is fully on screen.
        rootMargin: '12% 0px 12% 0px',
        threshold: 0.12,
      },
    );

    for (const plate of plates) observer.observe(plate);
  }
}
