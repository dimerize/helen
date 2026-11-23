import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

function files(dir, out = []) {
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`;
    if (name === 'vendor') continue;
    if (statSync(new URL(path, root)).isDirectory()) files(path, out);
    else if (/\.(astro|ts|js|css|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

test('Helen is reached at her studio email and Instagram, set once in site.ts', () => {
  const site = read('src/data/site.ts');
  assert.match(site, /email: 'helenzhang\.studio@gmail\.com'/);
  assert.match(site, /instagram: 'helenzhang\.studio'/);
  assert.match(site, /https:\/\/www\.instagram\.com\/\$\{this\.instagram\}\//);
  for (const path of [...files('src'), ...files('public/studio'), ...files('tests')]) {
    if (path.endsWith('home-screen.test.mjs')) continue;
    assert.doesNotMatch(read(path), /helen20040707|helen100087/, `${path} still names the old contact details`);
  }
});

test('the studio computer links each Instagram photo by its post code alone', () => {
  const computer = read('src/components/StudioComputer.astro');
  assert.match(computer, /href=\{`https:\/\/www\.instagram\.com\/p\/\$\{post\}\/`\}/);
  assert.doesNotMatch(computer, /new URL\(`\/p\//);
});

test('every studio page ends with the one shared footer', () => {
  for (const path of ['src/pages/index.astro', 'src/pages/work.astro', 'src/pages/project.astro', 'src/components/ArchiveSurface.astro']) {
    const page = read(path);
    assert.match(page, /import SiteFooter from/, `${path} imports SiteFooter`);
    assert.equal(page.match(/<SiteFooter\b/g)?.length, 1, `${path} renders one SiteFooter`);
    assert.doesNotMatch(page, /<footer\b/, `${path} has no footer of its own`);
  }
  // Each page keeps the link it had.
  assert.match(read('src/pages/work.astro'), /href: "\/archive", label: "Enter the archive"/);
  assert.match(read('src/pages/project.astro'), /href: "#main", label: "Back to top"/);
  assert.match(read('src/components/ArchiveSurface.astro'), /href: "\/work", label: "Selected Works"/);
  assert.doesNotMatch(read('src/pages/index.astro'), /<SiteFooter link=/);
  const footer = read('src/components/SiteFooter.astro');
  assert.match(footer, /href=\{`mailto:\$\{site\.email\}`\}/);
  assert.match(footer, /href=\{site\.instagramUrl\}/);
  assert.match(footer, /\{site\.city\}/);
  // The icons are drawn small but stay 44px targets.
  assert.match(read('public/studio/shared.css'), /\.site-footer-icon\{[^}]*width:44px;height:44px/);
});

test('the homepage shows Helen’s five projects as prints, in her order, each opening its page', () => {
  const data = read('src/data/home.ts');
  const prints = [...data.matchAll(/\{ title: '([^']+)', href: '([^']+)', image: '([^']+)' \}/g)].map(([, title, href, image]) => ({ title, href, image }));
  assert.deepEqual(prints.map(print => print.title), ['Out of Context', 'Standing Room Only', 'Jack.exe & Rose-liet', '8PPI', 'Side Effects May Include']);
  const works = read('src/pages/project.astro').match(/const works = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(key => key.slice(1, -1));
  for (const { title, href, image } of prints) {
    const work = new URL(href, 'https://helenzhang.studio').searchParams.get('work');
    assert.ok(works.includes(work), `${title} opens an existing project page`);
    assert.ok(existsSync(new URL(`public${image}`, root)), `${title} has its image at ${image}`);
  }
  const home = read('src/pages/index.astro');
  assert.match(home, /homePrints\.map/);
  assert.match(home, /loading="lazy"/, 'prints below the scanner load only when needed');
});

test('the about line is in Helen’s words, and leaves with the headline when the scan opens', () => {
  const data = read('src/data/home.ts');
  assert.match(data, /'NYC artist with too many tabs open\.'/);
  assert.match(data, /'Fine Arts & Creative Code – Parsons School of Design 2026'/);
  const css = read('public/studio/home.css');
  for (const mode of ['entering', 'world', 'leaving']) {
    assert.match(css, new RegExp(`body\\[data-mode=${mode}\\] \\.home-about`));
    assert.match(css, new RegExp(`body\\[data-mode=${mode}\\] \\.home-more`), `the prints and footer hide in ${mode}`);
  }
  assert.match(css, /body\[data-studio-route=archive\] \.home-more,body\[data-studio-route=gallery\] \.home-more\{display:none\}/);
});

test('the header is one step larger, set once and read by the archive too', () => {
  const shared = read('public/studio/shared.css');
  assert.match(shared, /:root\{--header-name:28px;--header-links:16px\}/);
  assert.match(shared, /@media\(max-width:700px\)\{:root\{--header-name:26px;--header-links:14px\}\}/);
  assert.match(shared, /@media\(max-width:360px\)\{:root\{--header-links:13px\}/, 'the narrowest phones keep 13px links so the row fits');
  const archive = read('public/studio/integrated-studio.css');
  assert.match(archive, /#archive-surface \.site-header \.wordmark\{font-size:var\(--header-name\)\}/);
  assert.match(archive, /#archive-surface \.site-header nav\{font-size:var\(--header-links\)\}/);
  assert.doesNotMatch(archive, /#archive-surface \.wordmark\{font-size:\d/);
});

test('the scanner sizes the magnifier only through its placement', () => {
  const app = read('public/studio/scan-world/app.js');
  assert.doesNotMatch(app, /magnifier\.group\.scale\.setScalar/);
  assert.equal(app.match(/placeScannerMagnifier\(/g)?.length, 2, 'placed on load and on every resize');
});
