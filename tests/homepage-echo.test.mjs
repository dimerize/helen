import test from 'node:test';
import assert from 'node:assert/strict';

const echo = await import('../public/studio/homepage-echo.js').catch(() => ({}));

test('homepage echo maps the scanner from document origin when entered below the fold', () => {
  assert.equal(typeof echo.homepageCaptureLayout, 'function');
  const layout = echo.homepageCaptureLayout({
    viewportWidth: 1280, viewportHeight: 800, scrollX: 0, scrollY: 900,
    sceneRect: {left: 0, top: -900, width: 1280, height: 685},
  });
  assert.deepEqual(layout.scanner, {x: 0, y: 0, width: 1280, height: 685});
  assert.equal(layout.width, 1280);
  assert.equal(layout.height, 800);
  assert.equal(layout.scale, 1);
});

test('homepage echo bounds large textures without changing page or scanner proportions', () => {
  assert.equal(typeof echo.homepageCaptureLayout, 'function');
  const layout = echo.homepageCaptureLayout({
    viewportWidth: 2560, viewportHeight: 1440, scrollX: 0, scrollY: 500,
    sceneRect: {left: 0, top: -500, width: 2560, height: 1100},
  });
  assert.equal(layout.scale, .6);
  assert.equal(layout.width * layout.scale, 1536);
  assert.equal(layout.height * layout.scale, 864);
  assert.deepEqual(layout.scanner, {x: 0, y: 0, width: 1536, height: 660});
});
