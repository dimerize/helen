import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const data = readFileSync(new URL('../src/data/out-of-context.ts', import.meta.url), 'utf8');
const inArtwork = file => existsSync(new URL(`../public/artwork/${file}`, import.meta.url));

test('the page shows no mockup as if it were a finished painting', () => {
  assert.doesNotMatch(data, /thesis-dark-grid|thesis-elongated/);
  assert.equal(data.match(/thesis-installation\.webp/g).length, 1);
  assert.ok(data.includes("caption: 'The original proposal. Proposed arrangement"));
});

test('every image the page names is in public/artwork', () => {
  const named = [...data.matchAll(/'([\w-]+\.webp)'/g)].map(match => match[1]);
  for (let n = 1; n <= 8; n++) named.push(`interpretation-${n}.webp`, `interpretation-${n}-thumb.webp`);
  assert.deepEqual(named.filter(file => !inArtwork(file)), []);
});

test('missing documentation is a labeled gap', () => {
  for (const label of ['Full view: photograph to come', 'Projection video to come', 'Installation photographs to come'])
    assert.ok(data.includes(`gap: '${label}'`), label);
});

test('jump links name the five sections in page order', () => {
  const labels = [...data.matchAll(/\{ id: '[\w-]+', label: '([^']+)' \}/g)].map(match => match[1]);
  assert.deepEqual(labels, ['Source', 'Paintings', 'Image transfers', 'Projection', 'Installation']);
});

// Chrome fetches the first lazy images while parsing, even inside display:none,
// so the markup waits in <noscript>, which never parses while JavaScript runs.
test('the other projects never parse Out of Context’s images', () => {
  const page = readFileSync(new URL('../src/pages/project.astro', import.meta.url), 'utf8');
  const sections = readFileSync(new URL('../src/components/OutOfContext.astro', import.meta.url), 'utf8');
  assert.match(page, /<noscript class="thesis-markup"><ZoomFigure art=\{opening\}/);
  assert.match(sections, /^<noscript class="thesis-markup">\n<nav class="ooc-jump/m);
  assert.match(page, /if \(document\.documentElement\.dataset\.work === 'thesis'\)[^\n]*noscript\.thesis-markup/);
});

test('captions carry only what Helen supplied', () => {
  assert.ok(data.includes("caption: 'Gaping Net, full view. Acrylic on homasote.'"));
  assert.match(data, /compare: \{ file: 'thesis-painting\.webp', label: 'Gaping Net' \}/);
});
