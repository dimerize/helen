import { createZoomViewer, enhanceZoomTriggers } from './zoom-viewer.js';

// Out of Context itself is static markup (project.astro). This adds the zoom
// viewer, marks the section in view in the jump bar, and keeps an image that
// fails to load legible instead of showing a broken-image icon.
export function initOutOfContext(doc = document) {
  enhanceZoomTriggers(doc, createZoomViewer(doc.getElementById('zoom-viewer')));
  markSectionInView(doc);
  for (const img of doc.querySelectorAll('.zoom-trigger img')) {
    if (img.complete && !img.naturalWidth) keepLegible(img);
    else img.addEventListener('error', () => keepLegible(img), { once: true });
  }
}

function markSectionInView(doc) {
  const links = new Map([...doc.querySelectorAll('.ooc-jump a')].map(link => [link.hash.slice(1), link]));
  const inView = new Set();
  // A section is current while it crosses a line a little above the middle of the screen.
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.isIntersecting ? inView.add(entry.target.id) : inView.delete(entry.target.id);
    const current = [...links.keys()].find(id => inView.has(id));
    for (const [id, link] of links) id === current ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current');
  }, { rootMargin: '-35% 0px -60% 0px' });
  for (const section of doc.querySelectorAll('.ooc-section')) observer.observe(section);
}

function keepLegible(img) {
  const frame = img.ownerDocument.createElement('div');
  const aspect = `${img.getAttribute('width')} / ${img.getAttribute('height')}`;
  frame.className = 'artwork-gap';
  frame.style.cssText = `aspect-ratio: ${aspect}; --aspect: ${aspect}`;
  frame.append(Object.assign(img.ownerDocument.createElement('p'), { textContent: `${img.alt}: image unavailable. Please try again.` }));
  img.closest('.zoom-trigger').replaceWith(frame);
}
