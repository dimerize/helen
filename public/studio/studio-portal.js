// Own the homepage/dialog lifecycle separately from the 3D experience.
export function createStudioPortal({dialog, createExperience, captureHomepage, prepare = () => {}, onError = () => {}, document: doc = document, window: win = window, location: loc = location, history: hist = history}) {
  let generation = 0, experience = null, echo = null, returnFocus = null, scrollPosition = 0, pushed = false, mounting = null;
  const events = new AbortController();
  const listen = (target, name, handler) => target.addEventListener(name, handler, {signal: events.signal});
  const roomURL = () => new URL(loc.href).searchParams.get('room') === 'gallery';
  const notify = open => doc.dispatchEvent(new CustomEvent('studio:gallery', {detail: {open}}));
  function finishClose(fromHistory = false) {
    if (!dialog.open) return;
    generation++; mounting?.abort(); mounting = null;
    experience?.dispose(); experience = null;
    echo?.dispose(); echo = null;
    dialog.close();
    doc.body.classList.remove('studio-open');
    win.scrollTo({top: scrollPosition, behavior: 'instant'});
    notify(false); returnFocus?.focus({preventScroll: true});
    doc.dispatchEvent(new CustomEvent('studio:portal-travel', {detail: {phase: 'returned', from: 'gallery', to: 'home'}}));
    if (!fromHistory && !win.studioShell && roomURL()) {
      if (pushed && hist.state?.studioPortal) hist.back();
      else {const url = new URL(loc.href); url.searchParams.delete('room'); hist.replaceState(hist.state, '', url);}
    }
    pushed = false;
  }
  async function open(trigger, fromHistory = false, preparing = false) {
    if (dialog.open) return;
    const token = ++generation; mounting = new AbortController();
    scrollPosition = win.scrollY; returnFocus = trigger || doc.activeElement;
    prepare();
    // Begin measuring the real page before scroll locking changes its layout.
    const capturing = captureHomepage();
    if(preparing)dialog.classList.add('is-preparing');else dialog.classList.remove('is-preparing');
    dialog.showModal();
    if(!preparing){doc.body.classList.add('studio-open');notify(true);}
    doc.dispatchEvent(new CustomEvent('studio:portal-travel', {detail: {phase: 'depart', from: 'home', to: 'gallery'}}));
    if (!fromHistory && !win.studioShell) {
      const url = new URL(loc.href); url.searchParams.set('room', 'gallery');
      hist.pushState({...hist.state, studioPortal: true}, '', url); pushed = true;
    } else pushed = Boolean(hist.state?.studioPortal);
    let localEcho, localExperience;
    try {
      localEcho = await capturing;
      if (token !== generation) {localEcho?.dispose(); return;}
      echo = localEcho;
      localExperience = await createExperience(dialog, {echo, signal: mounting.signal, onExit: () => {if (token === generation) {if(win.studioShell)win.studioShell.go('home');else finishClose();}}});
      if (token !== generation) {localExperience?.dispose(); return;}
      experience = localExperience;
      if (doc.hidden) experience.pause();
    } catch (error) {
      localExperience?.dispose();
      if (token !== generation) {localEcho?.dispose(); return;}
      echo?.dispose(); echo = null;
      onError(error);
    }
  }
  function requestClose() {if (experience) experience.exit(); else if(win.studioShell)win.studioShell.go('home');else finishClose();}
  listen(dialog, 'cancel', event => {
    event.preventDefault();
    if (typeof experience?.cancel === 'function') experience.cancel();
    else requestClose();
  });
  listen(win, 'popstate', () => {if(win.studioShell)return;if (roomURL() && !doc.querySelector?.('#archive-surface')) open(null, true); else finishClose(true);});
  listen(win, 'pagehide', event => {if (event.persisted) experience?.pause(); else finishClose(true);});
  listen(win, 'pageshow', event => {if (event.persisted && dialog.open) experience?.resume();});
  listen(doc, 'visibilitychange', () => {if (doc.hidden) experience?.pause(); else if (dialog.open) experience?.resume();});
  if (roomURL() && !doc.querySelector?.('#archive-surface')) open(null, true);
  return {open, requestClose, prepare:()=>open(null,true,true), show(){dialog.classList.remove('is-preparing');doc.body.classList.add('studio-open');notify(true);}, close:()=>finishClose(true), dispose() {finishClose(true);events.abort();}};
}
