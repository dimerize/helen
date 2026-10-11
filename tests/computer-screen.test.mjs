import test from 'node:test';
import assert from 'node:assert/strict';

const screenModule = await import('../public/studio/computer-screen.js').catch(() => ({}));

// Browser boundaries only: real event dispatch exercises the module's listeners.
// A missing 2D context represents a browser where the optional texture cannot draw.
class Element extends EventTarget {
  constructor(dataset = {}) {
    super();
    this.dataset = dataset;
    this.hidden = true;
    this.inert = true;
    this.style = {};
    this.attributes = new Map();
    this.classList = {add() {}, remove() {}, toggle() {}};
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  focus() { this.ownerDocument.activeElement = this; }
  click() { this.dispatchEvent(new Event('click')); }
}

function fixture({loadingImage = false} = {}) {
  const instagram = new Element(), mail = new Element(), profile = new Element();
  const buttons = [new Element({computerApp: 'instagram'}), new Element({computerApp: 'mail'})];
  const title = new Element(), location = new Element(), status = new Element(), hint = new Element();
  const images = loadingImage ? [Object.assign(new Element(), {complete: false, naturalWidth: 0})] : [];
  const doc = {activeElement: null, createElement() {return {width: 0, height: 0, getContext() {return null;}};}};
  const container = new Element({profileName: 'Helen Zhang', instagram: 'helen100087'});
  for (const element of [container, instagram, mail, profile, ...buttons, title, location, status, hint, ...images]) element.ownerDocument = doc;
  const elements = new Map([
    ['[data-computer-pane="instagram"]', instagram], ['[data-computer-pane="mail"]', mail],
    ['[data-computer-profile]', profile], ['[data-computer-title]', title],
    ['[data-computer-location]', location], ['[data-computer-status]', status], ['[data-computer-hint]', hint],
  ]);
  container.querySelector = selector => elements.get(selector) || null;
  container.querySelectorAll = selector => selector === '[data-computer-app]' ? buttons : images;
  return {container, instagram, mail, profile, buttons, doc, images};
}

test('screen switches apps and reopening resets Instagram and keyboard focus', async () => {
  assert.equal(typeof screenModule.createComputerScreen, 'function');
  const f = fixture();
  const screen = await screenModule.createComputerScreen(f.container);
  screen.show();
  assert.equal(f.container.hidden, false);
  assert.equal(f.container.inert, false);
  assert.equal(f.doc.activeElement, f.profile);
  f.buttons[1].click();
  assert.equal(f.mail.hidden, false);
  assert.equal(f.instagram.hidden, true);
  screen.hide();
  assert.equal(f.container.hidden, true);
  assert.equal(f.container.inert, true);
  screen.show();
  assert.equal(f.instagram.hidden, false);
  assert.equal(f.mail.hidden, true);
  screen.dispose();
});

test('placing a compact overlay maps its dimensions onto the glass bounds', async () => {
  assert.equal(typeof screenModule.createComputerScreen, 'function');
  const f = fixture();
  const screen = await screenModule.createComputerScreen(f.container);
  screen.place({left: 25, top: 100, width: 360, height: 261, compact: true});
  assert.equal(f.container.style.left, '25px');
  assert.equal(f.container.style.top, '100px');
  assert.equal(f.container.style.width, '400px');
  assert.equal(f.container.style.height, '300px');
  assert.equal(f.container.style.transform, 'scale(0.9, 0.87)');
  screen.dispose();
});

test('abort settles pending images and prevents a disposed screen from reopening', async () => {
  assert.equal(typeof screenModule.createComputerScreen, 'function');
  const f = fixture({loadingImage: true});
  const controller = new AbortController();
  const pending = screenModule.createComputerScreen(f.container, {signal: controller.signal});
  controller.abort();
  const screen = await pending;
  screen.show();
  f.buttons[1].click();
  assert.equal(f.container.hidden, true);
  assert.equal(f.container.inert, true);
  assert.notEqual(f.mail.hidden, false);
  assert.equal(f.doc.activeElement, null);
});

test('disposing removes app listeners and remains safe to repeat', async () => {
  assert.equal(typeof screenModule.createComputerScreen, 'function');
  const f = fixture();
  const screen = await screenModule.createComputerScreen(f.container);
  screen.show();
  screen.dispose();
  screen.dispose();
  f.buttons[1].click();
  screen.show();
  assert.equal(f.container.hidden, true);
  assert.equal(f.container.inert, true);
  assert.equal(f.mail.hidden, true);
});
