import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as geometry from '../public/studio/zoom-geometry.js';

const source = readFileSync(new URL('../public/studio/zoom-viewer.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replaceAll('export function', 'function');
const css = readFileSync(new URL('../public/studio/zoom-viewer.css', import.meta.url), 'utf8');
const NATURAL = { '/artwork/interpretation-1.webp': [1423, 2048], '/artwork/interpretation-2.webp': [1423, 2048], '/artwork/thesis-painting.webp': [1604, 2048] };

// A stand-in for ZoomViewer.astro and two trigger links: only what zoom-viewer.js
// touches, laid out the way zoom-viewer.css lays out a 1000 × 800 stage.
class Node {
  constructor(name, parent = null) {
    Object.assign(this, { name, parent, hidden: false, textContent: '', dataset: {}, style: {}, attrs: {}, listeners: {} });
    const classes = this.classes = new Set();
    this.classList = { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: c => classes.has(c) };
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
  setPointerCapture() {}
  insertAdjacentHTML() {}
}

function fire(target, type, props = {}) {
  const event = { type, target, timeStamp: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
  for (let n = target; n; n = n.parent) for (const fn of n.listeners[type] ?? []) fn(event);
  return event;
}

function page({ narrow = false, animating = false, touch = 0 } = {}) {
  const dialog = new Node('dialog');
  dialog.open = false;
  const top = new Node('top', dialog), stage = new Node('stage', dialog), bottom = new Node('bottom', dialog);
  const position = new Node('position', top), close = new Node('close', top);
  const caption = new Node('caption', bottom), status = new Node('status', bottom), compare = new Node('compare', bottom), compareLabel = new Node('span', compare);
  const steps = ['-1', '1'].map(step => Object.assign(new Node('step', bottom), { dataset: { zoomStep: step } }));
  const actions = ['out', 'in', 'reset'].map(action => Object.assign(new Node('action', bottom), { dataset: { zoomAction: action } }));
  const panes = ['item', 'compare'].map(name => {
    const element = new Node(name, stage), img = new Node('img', element), label = new Node('label', element);
    element.querySelector = selector => ({ img, '.zoom-pane-label': label })[selector] ?? null;
    return { element, img, label };
  });
  const comparing = () => dialog.classes.has('is-comparing');
  const visible = element => dialog.open && (element.name === 'item' ? !(narrow && comparing()) : comparing());
  const box = element => {
    const half = !narrow && comparing(), width = half ? 492 : 1000;
    return { left: half && element.name === 'compare' ? 508 : 0, top: 60, width, height: 800 };
  };
  for (const { element } of panes) {
    element.getClientRects = () => (visible(element) ? [box(element)] : []);
    Object.defineProperty(element, 'clientWidth', { get: () => (visible(element) ? box(element).width : 0) });
    Object.defineProperty(element, 'clientHeight', { get: () => (visible(element) ? box(element).height : 0) });
    // While the dialog animates open it is drawn at scale(.985); its layout is not.
    element.getBoundingClientRect = () => {
      const b = visible(element) ? box(element) : { left: 0, top: 0, width: 0, height: 0 }, k = animating ? .985 : 1;
      return { ...b, width: b.width * k, height: b.height * k };
    };
  }
  const one = { '.zoom-stage': stage, '#zoom-caption': caption, '.zoom-position': position, '.zoom-status': status, '.zoom-compare': compare, '.zoom-close': close };
  const many = { '.zoom-pane': panes.map(pane => pane.element), '[data-zoom-step]': steps, '[data-zoom-action]': actions };
  dialog.querySelector = selector => one[selector] ?? null;
  dialog.querySelectorAll = selector => many[selector] ?? [];
  compare.querySelector = () => compareLabel;

  const group = new Node('section');
  const triggers = [1, 2].map(n => {
    const link = new Node('a', group), thumb = { alt: `Viewer drawing ${n}`, complete: true, naturalWidth: 400, naturalHeight: 576, currentSrc: `/artwork/interpretation-${n}-thumb.webp`, getAttribute: key => ({ width: '400', height: '576' })[key] };
    Object.assign(link, { href: `/artwork/interpretation-${n}.webp`, querySelector: () => thumb, closest: selector => (selector === '[data-zoom-group]' ? group : null) });
    Object.assign(link.dataset, { caption: `Viewer drawing ${n} over Gaping Net.`, compare: '/artwork/thesis-painting.webp', compareLabel: 'Gaping Net' });
    return link;
  });
  group.querySelectorAll = () => triggers;

  const images = [], onWindow = {};
  class FakeImage { constructor() { images.push(this); } }
  const context = vm.createContext({
    ...geometry, setTimeout, clearTimeout, Image: FakeImage, navigator: { maxTouchPoints: touch },
    createDialogMotion: target => ({ open() { target.open = true; }, close() { target.open = false; } }),
    addEventListener: (type, fn) => { (onWindow[type] ??= []).push(fn); },
  });
  vm.runInContext(`${source}\nglobalThis.api = { createZoomViewer };`, context);
  const viewer = context.api.createZoomViewer(dialog);
  const loadAll = () => { for (const image of images.splice(0)) { [image.naturalWidth, image.naturalHeight] = NATURAL[image.src] ?? [100, 100]; image.onload?.(); } };
  const view = () => {
    const [, x, y, scale] = panes[0].img.style.transform.match(/translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\(([\d.]+)\)/).map(Number);
    return { x, y, scale };
  };
  return { dialog, stage, bottom, panes, steps, compare, status, viewer, triggers, loadAll, view };
}

test('the fit is measured from the layout, not the dialog’s opening animation', () => {
  const f = page({ animating: true });
  f.viewer.open(f.triggers[0]);
  f.loadAll();
  // A 1423 × 2048 drawing fitted into the 1000 × 800 stage is 800 tall.
  assert.equal(parseFloat(f.panes[0].img.style.height), 800);
});

test('a trackpad pinch anywhere in the viewer zooms the image, never the page', () => {
  const f = page();
  f.viewer.open(f.triggers[0]);
  f.loadAll();
  const pinch = fire(f.bottom, 'wheel', { deltaY: -20, deltaMode: 0, ctrlKey: true, clientX: 500, clientY: 840 });
  assert.equal(pinch.defaultPrevented, true);
  assert.ok(f.view().scale > 1);
});

test('Safari’s trackpad pinch zooms the image', () => {
  const f = page({ touch: 0 });
  f.viewer.open(f.triggers[0]);
  f.loadAll();
  fire(f.stage, 'gesturestart', { scale: 1, clientX: 500, clientY: 460 });
  const change = fire(f.stage, 'gesturechange', { scale: 2, clientX: 500, clientY: 460 });
  assert.equal(change.defaultPrevented, true);
  assert.equal(f.view().scale, 2);
});

test('on touch screens the system pinch is left alone outside the stage', () => {
  const f = page({ touch: 5 });
  f.viewer.open(f.triggers[0]);
  f.loadAll();
  const change = fire(f.bottom, 'gesturechange', { scale: 2, clientX: 500, clientY: 840 });
  assert.equal(change.defaultPrevented, false);
  assert.equal(f.view().scale, 1);
  assert.doesNotMatch(css.match(/\.zoom-viewer\{[^}]*\}/)[0], /touch-action:none/);
  assert.match(css.match(/\.zoom-stage\{[^}]*\}/)[0], /touch-action:none/);
});

test('a pinch on the right-hand pane zooms around that pane', () => {
  const f = page();
  f.viewer.open(f.triggers[0]);
  f.loadAll();
  fire(f.compare, 'click');
  f.loadAll();
  const right = f.panes[1].img, touch = { pointerType: 'touch', button: 0, clientY: 460 };
  fire(right, 'pointerdown', { ...touch, pointerId: 1, clientX: 704 });
  fire(right, 'pointerdown', { ...touch, pointerId: 2, clientX: 804 });
  fire(right, 'pointermove', { ...touch, pointerId: 1, clientX: 654 });
  fire(right, 'pointermove', { ...touch, pointerId: 2, clientX: 854 });
  assert.deepEqual(f.view(), { x: 0, y: 0, scale: 2 });
});

test('on phones, stepping while comparing shows the next drawing', () => {
  const f = page({ narrow: true });
  f.viewer.open(f.triggers[0]);
  f.loadAll();
  fire(f.compare, 'click');
  assert.equal(f.dialog.classes.has('is-comparing'), true);
  fire(f.steps[1], 'click');
  f.loadAll();
  assert.equal(f.dialog.classes.has('is-comparing'), false);
  assert.equal(f.panes[0].img.src, '/artwork/interpretation-2.webp');
});

test('side by side, stepping keeps the comparison', () => {
  const f = page();
  f.viewer.open(f.triggers[0]);
  fire(f.compare, 'click');
  fire(f.steps[1], 'click');
  assert.equal(f.dialog.classes.has('is-comparing'), true);
});

test('stepping announces the new image; opening leaves that to the dialog’s name', () => {
  const f = page();
  f.viewer.open(f.triggers[0]);
  assert.equal(f.status.textContent, '');
  fire(f.steps[1], 'click');
  assert.equal(f.status.textContent, '2 / 2. Viewer drawing 2 over Gaping Net.');
});
