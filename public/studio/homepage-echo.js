// A photograph of the real page's DOM, with its actual WebGL scanner underneath.
// The gallery places this normal-reading canvas behind the doorway and mirrors it.
export function homepageCaptureLayout({viewportWidth, viewportHeight, scrollX = 0, scrollY = 0, sceneRect}) {
  const width = Math.max(1, Math.round(viewportWidth));
  const height = Math.max(1, Math.round(viewportHeight));
  const scale = Math.min(1, 1536 / Math.max(width, height));
  return {
    width, height, scale,
    scanner: {
      x: (sceneRect.left + scrollX) * scale,
      y: (sceneRect.top + scrollY) * scale,
      width: sceneRect.width * scale,
      height: sceneRect.height * scale,
    },
  };
}

export async function createHomepageEcho() {
  const mount = document.querySelector('#scanner-scene');
  if (!mount) return null;
  // Measure synchronously before the caller locks the body for its modal.
  const layout = homepageCaptureLayout({
    viewportWidth: innerWidth, viewportHeight: innerHeight,
    scrollX, scrollY, sceneRect: mount.getBoundingClientRect(),
  });
  const [{default: html2canvas}] = await Promise.all([
    import('./vendor/html2canvas.js'),
    document.fonts.ready,
  ]);
  const iconSources = new Map();
  await Promise.all([...new Set([...document.querySelectorAll('.ui-icon')].map(icon =>
    getComputedStyle(icon).getPropertyValue('--icon').trim().match(/^url\(["']?(.*?)["']?\)$/)?.[1]
  ).filter(Boolean))].map(async url => {
    try {
      const response = await fetch(url);
      if (response.ok) iconSources.set(url, await response.text());
    } catch { /* Small icon failures must not prevent entering the gallery. */ }
  }));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * layout.scale);
  canvas.height = Math.round(layout.height * layout.scale);
  const ctx = canvas.getContext('2d', {alpha: false});
  const scanner = document.createElement('canvas');
  scanner.width = Math.max(1, Math.round(layout.scanner.width));
  scanner.height = Math.max(1, Math.round(layout.scanner.height));
  let overlay = null;
  let disposed = false;
  let lastTime = -Infinity;
  let revision = -1;
  let refreshing = false;
  let dirty = true;

  // Copy immediately after the scanner renders. No preserveDrawingBuffer cost,
  // duplicate scene, or second animation loop is needed while the room is open.
  const sampleScanner = (delta = 0) => {
    const detail = {canvas: scanner, delta, ready: false, revision: -1};
    document.dispatchEvent(new CustomEvent('studio:scanner-capture', {detail}));
    return detail;
  };
  const firstFrame = sampleScanner();
  let hasLiveScanner = firstFrame.ready;
  let overlayHasScanner = false;
  revision = firstFrame.revision;

  async function captureOverlay() {
    refreshing = true;
    const captureHasScanner = hasLiveScanner;
    try {
      const result = await html2canvas(document.documentElement, {
        width: layout.width, height: layout.height, x: 0, y: 0,
        windowWidth: layout.width, windowHeight: layout.height,
        scrollX: 0, scrollY: 0, scale: layout.scale,
        backgroundColor: null, logging: false, imageTimeout: 5000,
        ignoreElements: element => element.id === 'studio-portal'
          || (captureHasScanner && element.id === 'scanner-scene')
          || (element.tagName === 'CANVAS' && element.closest('#scanner-scene')),
        onclone: clonedDocument => {
          // Always look back onto the top of the homepage, including after a
          // visitor opened the door card from further down or on a return visit.
          clonedDocument.documentElement.style.background = 'transparent';
          const body = clonedDocument.body;
          body.classList.remove('studio-open');
          Object.assign(body.style, {background: 'transparent', position: 'static', top: '0', overflow: 'visible'});
          clonedDocument.querySelector('#studio-portal')?.remove();
          if (!captureHasScanner) clonedDocument.querySelector('#scanner-scene')?.classList.remove('is-webgl');
          // html2canvas does not support CSS masks. Keep the actual site's SVG
          // icons in the snapshot instead of rendering their square backgrounds.
          for (const icon of clonedDocument.querySelectorAll('.ui-icon')) {
            const style = clonedDocument.defaultView.getComputedStyle(icon);
            const url = style.getPropertyValue('--icon').trim().match(/^url\(["']?(.*?)["']?\)$/)?.[1];
            const svg = iconSources.get(url);
            if (!svg) {icon.style.background = 'transparent'; continue;}
            const coloredSVG = svg.replaceAll('stroke="black"', `stroke="${style.color}"`).replaceAll('fill="black"', `fill="${style.color}"`);
            icon.style.background = `url("data:image/svg+xml,${encodeURIComponent(coloredSVG)}") center / contain no-repeat`;
          }
        },
      });
      if (!disposed) {overlay = result; overlayHasScanner = captureHasScanner; dirty = true;}
    } finally {
      refreshing = false;
    }
  }
  await captureOverlay();

  function paint() {
    ctx.fillStyle = '#080809';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (hasLiveScanner) {
      const box = layout.scanner;
      ctx.drawImage(scanner, box.x, box.y, box.width, box.height);
    }
    if (overlay) ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
    dirty = false;
  }
  paint();
  return {
    canvas,
    // True means the caller should set CanvasTexture.needsUpdate. The DOM layer
    // is captured only on scan changes; moving pixels are sampled at 15 fps.
    update(timeSeconds) {
      if (disposed) return false;
      if (timeSeconds - lastTime < 1 / 15 && !dirty) return false;
      const delta = Number.isFinite(lastTime) ? Math.min(.15, Math.max(0, timeSeconds - lastTime)) : 0;
      lastTime = timeSeconds;
      const frame = sampleScanner(delta);
      if (frame.ready) hasLiveScanner = true;
      if (frame.ready && (frame.revision !== revision || hasLiveScanner !== overlayHasScanner) && !refreshing) {
        revision = frame.revision;
        captureOverlay().catch(error => console.warn('Homepage reflection keeps its previous text layer:', error.message));
      }
      paint();
      return true;
    },
    dispose() {
      disposed = true;
      overlay = null;
      scanner.width = scanner.height = 1;
      canvas.width = canvas.height = 1;
    },
  };
}
