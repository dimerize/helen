#!/usr/bin/env node
/*
  Walks the built site and checks that every internal link resolves to a
  file that actually exists.

  Cheap insurance: a renamed work folder changes its URL, and a stale link
  to the old one would otherwise go unnoticed until someone clicked it.

  Run:  npm run links      (or npm run verify, which builds first)
*/

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Does this href correspond to something in dist? */
async function resolves(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return exists(join(DIST, 'index.html'));

  const path = join(DIST, clean);
  if (await exists(path)) return true;
  if (await exists(`${path}.html`)) return true;
  if (await exists(join(path, 'index.html'))) return true;
  return false;
}

try {
  await stat(DIST);
} catch {
  console.error(`No ${DIST}/ directory. Run "npm run build" first.`);
  process.exit(1);
}

const pages = await walk(DIST);
const broken = [];
let checked = 0;

for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const href of new Set(hrefs)) {
    // External, protocol-relative, anchors, mailto and data URIs are not ours.
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(href)) continue;
    if (!href.startsWith('/')) continue;

    checked += 1;
    if (!(await resolves(href))) {
      broken.push({ page: page.replace(`${DIST}/`, ''), href });
    }
  }
}

if (broken.length > 0) {
  console.error(`\n${broken.length} broken link${broken.length === 1 ? '' : 's'}:\n`);
  for (const { page, href } of broken) console.error(`  ${page}  →  ${href}`);
  process.exit(1);
}

console.log(`${checked} internal links across ${pages.length} pages — all resolve.`);
