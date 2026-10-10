import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/studio/studio-motion.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/, '').replaceAll('export function', 'function');

function fixture(reduced = false) {
  const animations = [];
  const events = [];
  const media = new EventTarget();
  media.matches = reduced;
  const style = () => ({opacity: '', transform: '', overflow: '', setProperty(key, value) {this[key] = value;}, removeProperty(key) {this[key] = '';}});
  const element = () => ({style: style(), isConnected: true, focused: false, focus() {this.focused = true;}});
  const trigger = element();
  const closeButton = element();
  const body = element();
  const dialog = Object.assign(new EventTarget(), element(), {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; events.push(() => this.dispatchEvent(new Event('close'))); }
  });
  const context = vm.createContext({
    matchMedia: () => media,
    document: {body, activeElement: trigger},
    getComputedStyle: target => ({opacity: target.style.opacity || '1', transform: target.style.transform || 'none'}),
    animate(target, frames, options) {
      for (const [key, values] of Object.entries(frames)) target.style[key] = values[0];
      const animation = {cancelled: false, cancel() {this.cancelled = true;}, finished: new Promise(() => {}), finish: options.onComplete};
      animations.push(animation);
      return animation;
    }
  });
  vm.runInContext(`${source}\nglobalThis.api = {reveal, createDialogMotion};`, context);
  const controller = context.api.createDialogMotion(dialog, {initialFocus: closeButton});
  return {controller, dialog, body, trigger, closeButton, animations, media, reveal: context.api.reveal,
    flush: () => { while (events.length) events.shift()(); }};
}

test('Escape keeps the native modal open until the exit finishes, then restores focus and scroll', () => {
  const f = fixture();
  f.controller.open(f.trigger);
  assert.equal(f.body.style.overflow, 'hidden');
  assert.equal(f.closeButton.focused, true);
  const escape = new Event('cancel', {cancelable: true});
  f.dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.dialog.open, true);
  f.animations.at(-1).finish();
  f.flush();
  assert.equal(f.dialog.open, false);
  assert.equal(f.body.style.overflow, '');
  assert.equal(f.trigger.focused, true);
  assert.equal(f.dialog.style.opacity, '');
});

test('reopening during an exit invalidates its stale completion', () => {
  const f = fixture();
  f.controller.open(f.trigger);
  f.controller.close();
  const stale = f.animations.at(-1);
  f.controller.open(f.trigger);
  stale.finish();
  assert.equal(f.dialog.open, true);
  assert.equal(f.body.style.overflow, 'hidden');
  f.animations.at(-1).finish();
  assert.equal(f.dialog.style.transform, '');
});

test('a queued native close cannot unlock a newer dialog or lose the original scroll state', () => {
  const f = fixture();
  f.body.style.overflow = 'clip';
  f.controller.open(f.trigger);
  f.controller.close();
  f.animations.at(-1).finish();
  f.controller.open(f.trigger);
  f.flush();
  assert.equal(f.dialog.open, true);
  assert.equal(f.body.style.overflow, 'hidden');
  f.controller.close();
  f.animations.at(-1).finish();
  f.flush();
  assert.equal(f.body.style.overflow, 'clip');
});

test('reduced motion opens and closes immediately without starting animations', () => {
  const f = fixture(true);
  f.controller.open(f.trigger);
  assert.equal(f.dialog.open, true);
  f.controller.close();
  f.flush();
  assert.equal(f.dialog.open, false);
  assert.equal(f.animations.length, 0);
});

test('enabling reduced motion completes an in-flight exit', () => {
  const f = fixture();
  f.controller.open(f.trigger);
  f.controller.close();
  const change = new Event('change');
  change.matches = true;
  f.media.matches = true;
  f.media.dispatchEvent(change);
  f.flush();
  assert.equal(f.dialog.open, false);
  assert.equal(f.body.style.overflow, '');
});

test('rapid reveals leave neither stale callbacks nor hidden inline styles', () => {
  const f = fixture();
  f.reveal(f.dialog);
  const stale = f.animations.at(-1);
  f.reveal(f.dialog);
  stale.finish();
  assert.equal(f.dialog.style.opacity, 0);
  f.animations.at(-1).finish();
  assert.equal(f.dialog.style.opacity, '');
  assert.equal(f.dialog.style.transform, '');
});
