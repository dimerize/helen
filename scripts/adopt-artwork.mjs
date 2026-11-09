#!/usr/bin/env node
/*
  Turns Helen's photographs into the files the site serves.

  Drop originals anywhere under incoming/ (git-ignored, never published),
  then run:

      npm run adopt

  Each photograph becomes public/artwork/<name>.webp, and each viewer drawing
  gets the small thumbnail the Out of Context grid shows. Run it, then commit
  the output. The originals stay in incoming/ until you delete them.
*/

import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const INCOMING = 'incoming';
const ARTWORK = 'public/artwork';
// Matches the rest of public/artwork. Sharper originals need a separate zoom
// file before this is raised, or every page would download them in full.
const MAX_EDGE = 2048;
const PHOTO = /\.(jpe?g|png|tiff?|webp)$/i;
const DRAWING = /^interpretation-\d+\.webp$/;

async function photos(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await photos(path)));
    else if (PHOTO.test(entry.name)) out.push(path);
  }
  return out;
}

async function write(image, target) {
  const { width, height, size } = await image.toFile(target);
  console.log(`${target}  ${width}×${height}  ${Math.round(size / 1024)} KB`);
}

for (const file of await photos(INCOMING)) {
  const name = basename(file, extname(file));
  await write(
    sharp(file).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }),
    join(ARTWORK, `${name}.webp`),
  );
}

for (const name of (await readdir(ARTWORK)).filter((name) => DRAWING.test(name))) {
  await write(
    sharp(join(ARTWORK, name)).resize({ width: 400 }).webp({ quality: 78 }),
    join(ARTWORK, name.replace(/\.webp$/, '-thumb.webp')),
  );
}
