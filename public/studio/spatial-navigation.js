// Full-document travel moves the real scene. The gallery portal keeps ownership
// of its capture, camera, query-string history, and same-homepage doorway.
const TRAVEL_KEY = 'studio:spatial-travel';
const LAST_PAGE_KEY = 'studio:spatial-last-page';
const MAX_AGE = 8000;
const EASE = 'cubic-bezier(.22,.72,.18,1)';
const bounded = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));

export function studioRoute(href, base = 'https://helenzhang.studio/') {
  try {
    const url = new URL(href, base), origin = new URL(base).origin;
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return null;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/index.html') return url.searchParams.get('room') === 'gallery' ? 'gallery' : 'home';
    if (path === '/archive' || path === '/archive.html') return 'archive';
    if (path === '/gallery' || path === '/gallery.html') return 'gallery';
  } catch { /* Invalid links keep their native handling. */ }
  return null;
}

export function navigationIntent(options) {
  const {currentURL, href, button = 0, target = '', rel = '', sceneMode} = options;
  if (!href || button !== 0 || options.metaKey || options.ctrlKey || options.altKey || options.shiftKey || options.defaultPrevented || options.download || options.galleryTrigger || options.portalActive) return null;
  if ((target && target.toLowerCase() !== '_self') || /(?:^|\s)external(?:\s|$)/i.test(rel) || ['entering', 'world', 'leaving'].includes(sceneMode)) return null;
  try {
    const current = new URL(currentURL), next = new URL(href, current);
    const to = studioRoute(next.href, current.href), from = studioRoute(current.href, current.href) || 'other';
    if (!to || next.hash || next.href === current.href || to === from) return null;
    return {from, to, fromURL: current.href, toURL: next.href};
  } catch { return null; }
}

export function createTravelState() {
  let busy = false, portal = false;
  return {
    get busy() { return busy; },
    get portal() { return portal; },
    begin() { if (busy || portal) return false; busy = true; return true; },
    setPortal(value) { portal = Boolean(value); },
    reset() { busy = false; },
  };
}

export function readTravelRecord(raw, currentURL, now = Date.now()) {
  try {
    const record = JSON.parse(raw), current = new URL(currentURL);
    if (!record || record.version !== 1 || !Number.isFinite(record.at) || now < record.at || now - record.at > MAX_AGE) return null;
    const from = new URL(record.fromURL), to = new URL(record.toURL);
    if (from.origin !== current.origin || to.href !== current.href || !['http:', 'https:'].includes(from.protocol)) return null;
    if (record.from !== (studioRoute(from.href, current.href) || 'other') || record.to !== studioRoute(to.href, current.href)) return null;
    return record;
  } catch { return null; }
}

export function travelGeometry(route, phase, {width = 1200, height = 800, reducedMotion = false} = {}) {
  const identity = {x:0, y:0, z:0, rx:0, ry:0, scale:1, duration:0};
  if (reducedMotion) return identity;
  const h = bounded(height, 800, 320, 1000), w = bounded(width, 1200, 320, 1600);
  const arrive = phase === 'arrive';
  const duration = arrive ? 420 : 180;
  if (route === 'archive') return {...identity, y:h * (arrive ? .1 : .13), z:arrive ? -150 : -240, rx:arrive ? 16 : 22, scale:arrive ? .94 : .9, duration};
  if (route === 'home') return {...identity, y:h * (arrive ? -.075 : .06), z:arrive ? -120 : -210, rx:arrive ? -10 : 13, scale:arrive ? .95 : .82, duration};
  if (route === 'gallery') return {...identity, x:-w * .035, y:-h * .025, z:180, ry:-4, scale:1.035, duration};
  return identity;
}

export function fragmentFlight(rect, anchor, index = 0) {
  const dx = anchor.x - (rect.left + rect.width / 2), dy = anchor.y - (rect.top + rect.height / 2);
  return {x:bounded(dx * .32, 0, -180, 180), y:bounded(dy * .24, 0, -120, 120), z:-55, rz:bounded(-dx / 80, 0, -7, 7), scale:.89, delay:Math.min(Math.max(0, index), 7) * 10};
}

const transform = g => `perspective(1100px) translate3d(${g.x}px,${g.y}px,${g.z}px) rotateX(${g.rx}deg) rotateY(${g.ry}deg) scale(${g.scale})`;

export function createSpatialNavigation({document: doc = document, window: win = window, navigate = href => win.location.assign(href)} = {}) {
  const state = createTravelState(), animations = new Set(), events = new AbortController();
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let stage = null, arrivalHandled = false, recoveryTimer = null, generation = 0;
  const listen = (target, event, handler) => target.addEventListener(event, handler, {signal:events.signal});
  const storage = (method, key, value) => { try { return win.sessionStorage[method](key, value); } catch { return null; } };
  const notify = (phase, travel) => doc.dispatchEvent(new win.CustomEvent('studio:navigation', {detail:{phase, from:travel.from, to:travel.to, route:travel.to}}));
  const portalOwnsScene = () => state.portal || doc.querySelector('#studio-portal[open]') || ['entering','world','leaving'].includes(doc.body?.dataset.mode);

  function cancelMotion() {
    for (const animation of animations) animation.cancel();
    animations.clear();
    stage?.removeAttribute('data-spatial-moving');
    stage?.style.removeProperty('--spatial-origin');
    doc.documentElement.removeAttribute('data-spatial-phase');
  }
  function restore() {
    generation++; cancelMotion(); state.reset();
    win.clearTimeout(recoveryTimer); recoveryTimer = null;
  }
  function animate(element, keyframes, options) {
    if (typeof element?.animate !== 'function') return Promise.resolve();
    try {
      const animation = element.animate(keyframes, {easing:EASE, fill:'both', ...options});
      animations.add(animation);
      return animation.finished.catch(() => {});
    } catch { return Promise.resolve(); }
  }
  function sceneOrigin(route) {
    const box = stage.getBoundingClientRect();
    const subject = doc.querySelector(route === 'home' ? '#scanner-scene' : '[data-spatial-table], #room');
    const target = subject?.getBoundingClientRect();
    const x = target ? target.left + target.width / 2 : win.innerWidth / 2;
    const y = target ? Math.min(target.top + target.height * .35, win.innerHeight * .65) : win.innerHeight * .48;
    stage.style.setProperty('--spatial-origin', `${bounded(x - box.left, 0, 0, box.width)}px ${bounded(y - box.top, 0, 0, box.height)}px`);
    return {x, y};
  }
  async function move(travel, phase) {
    if (motion.matches || portalOwnsScene()) return;
    stage = doc.querySelector('[data-spatial-stage]') || doc.querySelector('main');
    if (!stage || typeof stage.animate !== 'function') return;
    const geometry = travelGeometry(travel.to, phase, {width:win.innerWidth, height:win.innerHeight});
    const arrive = phase === 'arrive', base = win.getComputedStyle(stage).transform;
    const resting = base === 'none' ? '' : base;
    const displaced = `${transform(geometry)} ${resting}`.trim();
    const anchor = sceneOrigin(travel.to);
    stage.setAttribute('data-spatial-moving', '');
    doc.documentElement.dataset.spatialPhase = phase;
    const work = [animate(stage, arrive ? [{transform:displaced},{transform:resting || 'none'}] : [{transform:resting || 'none'},{transform:displaced}], {duration:geometry.duration})];
    // A small visible set follows its own displacement, retaining the archive's
    // original transforms and DOM order. No clone or snapshot is constructed.
    if ((arrive && travel.to === 'archive') || (!arrive && travel.from === 'archive' && travel.to === 'home')) {
      const fragments = [...doc.querySelectorAll('[data-spatial-fragment], .fragment')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.bottom > 0 && rect.top < win.innerHeight * 1.25;
      }).slice(0, 12);
      fragments.forEach((element, index) => {
        const g = fragmentFlight(element.getBoundingClientRect(), anchor, index);
        const original = win.getComputedStyle(element).transform;
        const resting = original === 'none' ? '' : original;
        const gathered = `translate3d(${g.x}px,${g.y}px,${g.z}px) rotateZ(${g.rz}deg) scale(${g.scale}) ${resting}`.trim();
        work.push(animate(element, arrive ? [{transform:gathered},{transform:resting || 'none'}] : [{transform:resting || 'none'},{transform:gathered}], {duration:arrive ? 350 : geometry.duration, delay:arrive ? g.delay : 0}));
      });
    }
    await Promise.all(work);
  }
  function arrivalTravel() {
    const currentURL = win.location.href;
    const raw = storage('getItem', TRAVEL_KEY);
    storage('removeItem', TRAVEL_KEY);
    const record = readTravelRecord(raw, currentURL);
    if (record) return record;
    // Native history traversal keeps scroll restoration and URL ownership with
    // the browser. Only the current page's geometry is animated after restore.
    const type = win.performance?.getEntriesByType('navigation')[0]?.type;
    if (type === 'reload') return null;
    const previous = storage('getItem', LAST_PAGE_KEY);
    try {
      const last = JSON.parse(previous);
      if (!last || Date.now() - last.at > MAX_AGE) return null;
      const fromURL = win.navigation?.activation?.from?.url || last.url;
      return navigationIntent({currentURL:fromURL, href:currentURL});
    } catch { return null; }
  }
  async function arrive() {
    if (arrivalHandled) return;
    arrivalHandled = true;
    const travel = arrivalTravel();
    if (!travel || travel.to === 'gallery' || portalOwnsScene()) return;
    const token = generation;
    notify('arrive', travel);
    await move(travel, 'arrive');
    if (token !== generation) return;
    cancelMotion(); notify('settled', travel);
  }
  listen(doc, 'click', event => {
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    const travel = navigationIntent({href:link.getAttribute('href'), currentURL:win.location.href,
      button:event.button, metaKey:event.metaKey, ctrlKey:event.ctrlKey, altKey:event.altKey, shiftKey:event.shiftKey,
      defaultPrevented:event.defaultPrevented, target:link.getAttribute('target') || '', rel:link.getAttribute('rel') || '',
      download:link.hasAttribute('download'), galleryTrigger:link.hasAttribute('data-open-gallery'),
      portalActive:Boolean(portalOwnsScene()), sceneMode:doc.body?.dataset.mode});
    if (!travel) return;
    event.preventDefault();
    if (!state.begin()) return;
    cancelMotion(); const token = ++generation;
    storage('setItem', TRAVEL_KEY, JSON.stringify({...travel, version:1, at:Date.now()}));
    notify('depart', travel);
    move(travel, 'depart').finally(() => {
      if (token !== generation) return;
      try { navigate(travel.toURL); }
      catch { storage('removeItem', TRAVEL_KEY); restore(); return; }
      // A denied/cancelled navigation must not leave an inert, transformed page.
      recoveryTimer = win.setTimeout(() => {storage('removeItem', TRAVEL_KEY); restore();}, 1600);
    });
  });
  listen(doc, 'studio:gallery', event => {
    state.setPortal(event.detail?.open);
    if (event.detail?.open) restore();
  });
  listen(doc, 'studio:portal-travel', event => {
    const active = event.detail?.phase !== 'returned';
    state.setPortal(active);
    if (active) restore();
  });
  listen(win, 'pagehide', () => {
    storage('setItem', LAST_PAGE_KEY, JSON.stringify({url:win.location.href, at:Date.now()}));
    restore(); arrivalHandled = false;
  });
  listen(win, 'pageshow', () => { if (!portalOwnsScene()) arrive(); });
  // Cross-document View Transitions provide the native lifecycle when present.
  // CSS excludes root snapshots; the real DOM is the sole moving scene.
  listen(win, 'pagereveal', event => {
    if (motion.matches || portalOwnsScene()) event.viewTransition?.skipTransition();
    arrive();
  });
  listen(win, 'pageswap', event => {
    if (motion.matches || portalOwnsScene()) event.viewTransition?.skipTransition();
  });
  listen(motion, 'change', () => { if (motion.matches) for (const animation of animations) animation.finish(); });
  win.requestAnimationFrame(arrive);
  return {dispose() {restore(); events.abort();}};
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') createSpatialNavigation();
