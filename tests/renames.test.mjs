import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { archiveItems, archiveProjects } from '../public/studio/archive-data.js';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const walk = dir => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(`${dir}${entry.name}/`) : [`${dir}${entry.name}`]);
const sources = [
  ...walk('src/').filter(path => /\.(astro|ts)$/.test(path)),
  ...readdirSync(new URL('public/studio/', root)).filter(name => name.endsWith('.js')).map(name => `public/studio/${name}`),
];

test('no page, component or studio script uses a retired name', () => {
  const retired = [/humanized machine/i, /netted mesh/i, /\bElongated\b/, /\bGaps\b/];
  const hits = sources.flatMap(path => retired.filter(name => name.test(read(path))).map(name => `${path} ${name}`));
  assert.deepEqual(hits, []);
});

test('the 3D room says it shows the original proposal', () => {
  assert.ok(read('src/components/StudioPortal.astro').includes('<h2>Out of Context</h2><span>The original proposal · Helen Zhang, 2026</span>'));
  const scene = read('public/studio/gallery-scene.js');
  for (const caption of ["'Stretched Out (proposal mockup)'", "'Gaping Net'", "'Bent Mesh (proposal mockup)'"]) assert.ok(scene.includes(caption), caption);
  assert.ok(read('public/studio/gallery-door.js').includes("fillText('Out of Context'"));
});

test('the archive files the thesis under Out of Context and labels its mockups honestly', () => {
  const thesis = archiveItems.filter(item => item.project === 'thesis');
  assert.ok(thesis.length > 0);
  assert.deepEqual([...new Set(thesis.map(item => item.relatedTitle))], ['Out of Context']);
  assert.equal(archiveProjects.thesis.title, 'Out of Context');
  const byId = Object.fromEntries(thesis.map(item => [item.id, item]));
  assert.equal(byId.painting.title, 'Gaping Net');
  assert.deepEqual([byId['bent-mesh'].title, byId['bent-mesh'].type, byId['bent-mesh'].caption],
    ['Bent Mesh', 'Mockup', 'An early mockup of Bent Mesh from the thesis proposal; the finished painting differs.']);
  assert.deepEqual([byId.elongated.title, byId.elongated.type, byId.elongated.caption],
    ['Stretched Out', 'Mockup', 'An early mockup of Stretched Out from the thesis proposal; the finished painting differs.']);
});
