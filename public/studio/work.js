(() => {
  'use strict';
  const conveyor = document.getElementById('conveyor');
  const original = document.getElementById('original-group');
  const strip = document.getElementById('strip');
  const index = document.getElementById('index');
  const stripButton = document.getElementById('strip-view');
  const indexButton = document.getElementById('index-view');
  const motionButton = document.getElementById('motion-button');
  const motionLabel = document.getElementById('motion-label');
  const hint = document.getElementById('motion-hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(hover: none), (max-width: 760px)');
  const duplicate = original.cloneNode(true);
  duplicate.removeAttribute('id');
  duplicate.setAttribute('aria-hidden', 'true');
  duplicate.querySelectorAll('a').forEach(link => link.tabIndex = -1);
  document.getElementById('track').append(duplicate);
  let userPaused = false;
  let hovered = false;
  let focused = false;
  let inIndex = false;
  let position = 0;
  let previousTime = 0;
  let holdUntil = 0;

  function manualMode() { return reduce.matches || touch.matches; }
  function updateControls() {
    motionButton.hidden = manualMode() || inIndex;
    motionButton.setAttribute('aria-pressed', String(userPaused));
    motionLabel.textContent = userPaused ? 'Resume motion' : 'Pause motion';
    motionButton.firstElementChild.textContent = userPaused ? '▷' : 'Ⅱ';
    hint.textContent = touch.matches ? 'Swipe through the work. Tap one to open.' : reduce.matches ? 'Scroll through the work, or use the arrows.' : 'Hold over a work to look closer.';
  }
  function showIndex(show) {
    inIndex = show;
    strip.hidden = show;
    index.hidden = !show;
    stripButton.setAttribute('aria-pressed', String(!show));
    indexButton.setAttribute('aria-pressed', String(show));
    updateControls();
  }
  stripButton.addEventListener('click', () => showIndex(false));
  indexButton.addEventListener('click', () => showIndex(true));
  motionButton.addEventListener('click', () => { userPaused = !userPaused; updateControls(); });
  conveyor.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovered = true; });
  conveyor.addEventListener('pointerleave', () => { hovered = false; });
  conveyor.addEventListener('focusin', () => { focused = true; });
  conveyor.addEventListener('focusout', event => { focused = conveyor.contains(event.relatedTarget); });
  conveyor.addEventListener('scroll', () => { position = conveyor.scrollLeft; }, {passive: true});
  conveyor.addEventListener('wheel', () => { holdUntil = performance.now() + 3000; }, {passive: true});
  function step(direction) {
    userPaused = true;
    updateControls();
    const width = original.getBoundingClientRect().width;
    // Bring the duplicate back to its identical original before seeking a work.
    if (!manualMode() && conveyor.scrollLeft >= width) conveyor.scrollLeft -= width;
    const cards = [...original.querySelectorAll('.work-sheet')];
    const visibleLeft = conveyor.scrollLeft;
    const stops = cards.map(card => Math.max(0, card.offsetLeft - 40));
    let destination = direction > 0 ? stops.find(stop => stop > visibleLeft + 20) : stops.filter(stop => stop < visibleLeft - 20).pop();
    if (destination === undefined) destination = direction > 0 ? 0 : stops.at(-1);
    conveyor.scrollTo({left: destination, behavior: reduce.matches ? 'instant' : 'smooth'});
  }
  document.getElementById('previous').addEventListener('click', () => step(-1));
  document.getElementById('next').addEventListener('click', () => step(1));
  [reduce, touch].forEach(query => query.addEventListener('change', () => { position = conveyor.scrollLeft; updateControls(); }));
  function animate(time) {
    const elapsed = previousTime ? Math.min(time - previousTime, 60) : 0;
    previousTime = time;
    if (!manualMode() && !userPaused && !hovered && !focused && !inIndex && !document.hidden && time > holdUntil) {
      const groupWidth = original.getBoundingClientRect().width;
      if (groupWidth) {
        position = (position + elapsed * .033) % groupWidth;
        conveyor.scrollLeft = position;
      }
    }
    requestAnimationFrame(animate);
  }
  updateControls();
  requestAnimationFrame(animate);
})();
