import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/studio/doorway.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/, '');

function fixture(initialURL = 'https://helen.test/') {
  const elements = new Map();
  const timers = new Map();
  const animations = [];
  const historyEvents = [];
  const scannerEvents = [];
  const element = () => Object.assign(new EventTarget(), {
    style: {}, hidden: false, focused: false, children: [],
    focus() { this.focused = true; },
    querySelector(selector) { return elements.get(selector); },
    setAttribute() {},
    replaceChildren(...children) { this.children = children; },
    classList: {add() {}, remove() {}}
  });
  for (const selector of ['#studio-portal', '#studio-frame', '.portal-curtain', '.door-leaf', '.portal-doorway', '#close-studio', '#portal-status', '#portal-fallback']) {
    elements.set(selector, element());
  }
  const dialog = elements.get('#studio-portal');
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  const trigger = element();
  trigger.querySelector = () => null;
  elements.set('[data-open-gallery]', trigger);
  const window = Object.assign(new EventTarget(), {scroll: 0, scrollTo(options) { window.scroll = options.top; }});
  const location = {href: initialURL, origin: 'https://helen.test'};
  const stack = [{url: location.href, state: null}];
  let historyIndex = 0;
  const traverse = distance => {
    historyIndex += distance;
    location.href = stack[historyIndex].url;
    window.dispatchEvent(new Event('popstate'));
  };
  const history = {
    get state() { return stack[historyIndex].state; },
    pushState(state, _unused, url) { stack.splice(++historyIndex); stack.push({state, url: String(url)}); location.href = String(url); },
    replaceState(state, _unused, url) { stack[historyIndex] = {state, url: String(url)}; location.href = String(url); },
    back() { historyEvents.push(() => traverse(-1)); }
  };
  const document = Object.assign(new EventTarget(), {
    querySelector: selector => elements.get(selector),
    querySelectorAll: () => [trigger],
    body: element(),
    createElement() {
      return Object.assign(element(), {contentWindow: {messages: [], postMessage(message) { this.messages.push(message); }}});
    }
  });
  document.addEventListener('studio:gallery', event => scannerEvents.push(event.detail.open));
  class CustomEvent extends Event { constructor(type, options) { super(type); this.detail = options.detail; } }
  const context = vm.createContext({
    document, window, location, history, URL, scrollY: 640, CustomEvent,
    matchMedia: () => ({matches: false}),
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    animate(target, keyframes) {
      let finish;
      const finished = new Promise(resolve => { finish = resolve; });
      const animation = {
        target, keyframes, stopped: false, finished,
        then: finished.then.bind(finished),
        stop() { this.stopped = true; },
        finish() { if (!this.stopped) finish(); }
      };
      animations.push(animation);
      return animation;
    }
  });
  vm.runInContext(source, context);
  const click = target => target.dispatchEvent(Object.assign(new Event('click', {cancelable: true}), {button: 0}));
  const ready = iframe => window.dispatchEvent(Object.assign(new Event('message'), {
    origin: location.origin, source: iframe.contentWindow, data: {type: 'helen:gallery-ready'}
  }));
  return {
    elements, dialog, animations, window, location, stack, scannerEvents, timers, trigger,
    get frame() { return elements.get('#studio-frame').children[0]; },
    open: () => click(trigger), close: () => click(elements.get('#close-studio')),
    back: () => traverse(-1), forward: () => traverse(1), ready,
    flushHistory: () => { while (historyEvents.length) historyEvents.shift()(); },
    finish: async animation => { animation.finish(); await new Promise(resolve => setImmediate(resolve)); },
    lifecycle(type) { window.dispatchEvent(Object.assign(new Event(type), {persisted: true})); }
  };
}

test('Back then Forward during the close animation reopens without adding history', async () => {
  const f = fixture();
  f.open();
  const firstFrame = f.frame;
  f.back();
  const closing = f.animations.at(-1);
  f.forward();
  await f.finish(closing);
  assert.equal(f.dialog.open, true);
  assert.notEqual(f.frame, firstFrame);
  assert.equal(f.stack.length, 2, 'Forward reuses the original room entry');
  assert.equal(new URL(f.location.href).searchParams.get('room'), 'gallery');
});

test('closing while loading removes the frame and ignores its late ready message', async () => {
  const f = fixture();
  f.open();
  const oldFrame = f.frame;
  f.close();
  f.ready(oldFrame);
  await f.finish(f.animations.at(-1));
  f.flushHistory();
  const count = f.animations.length;
  f.ready(oldFrame);
  assert.equal(f.dialog.open, false);
  assert.equal(f.frame, undefined);
  assert.equal(f.animations.length, count);
  assert.equal(f.timers.size, 0);
  assert.equal(f.location.href, 'https://helen.test/');
});

test('the latest Back traversal cancels a queued reopening', async () => {
  const f = fixture();
  f.open();
  f.back();
  const closing = f.animations.at(-1);
  f.forward();
  f.back();
  await f.finish(closing);
  assert.equal(f.dialog.open, false);
  assert.equal(f.frame, undefined);
  assert.equal(f.location.href, 'https://helen.test/');
});

test('normal exit returns to the scanner at its original scroll position and history entry', async () => {
  const f = fixture();
  f.open();
  f.close();
  await f.finish(f.animations.at(-1));
  f.flushHistory();
  assert.equal(f.dialog.open, false);
  assert.equal(f.window.scroll, 640);
  assert.equal(f.trigger.focused, true);
  assert.deepEqual(f.scannerEvents, [true, false]);
  assert.equal(f.stack.length, 2, 'exit preserves the room for browser Forward');
  assert.equal(f.location.href, 'https://helen.test/');
});

test('closing a direct room URL clears its parameter without navigating away', async () => {
  const f = fixture('https://helen.test/?room=gallery');
  assert.equal(f.dialog.open, true);
  f.close();
  await f.finish(f.animations.at(-1));
  f.flushHistory();
  assert.equal(f.dialog.open, false);
  assert.equal(f.stack.length, 1);
  assert.equal(f.location.href, 'https://helen.test/');
});

test('BFCache restoration finishes a reveal whose Motion promise was stopped', async () => {
  const f = fixture();
  f.open();
  f.ready(f.frame);
  assert.equal(f.elements.get('.portal-curtain').hidden, false);
  f.lifecycle('pagehide');
  f.lifecycle('pageshow');
  assert.equal(f.dialog.open, true);
  assert.equal(f.elements.get('.portal-curtain').hidden, true);
  assert.equal(f.elements.get('#portal-status').hidden, true);
  assert.equal(f.frame.style.opacity, '1');
});

test('BFCache restoration restarts the loading fallback timer before the room is ready', () => {
  const f = fixture();
  f.open();
  f.lifecycle('pagehide');
  assert.equal(f.timers.size, 0);
  f.lifecycle('pageshow');
  assert.equal(f.timers.size, 1);
  [...f.timers.values()][0]();
  assert.equal(f.elements.get('#portal-fallback').hidden, false);
});
