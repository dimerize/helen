#!/usr/bin/env node
/*
  Takes images out of incoming/ and installs them into the work placements.

  This is the whole handover process. Drop photographs into incoming/, run
  one command, and they are in the site with the calibration plates removed
  and the status moved on. Filenames are sorted, so 01-, 02- prefixes control
  which placement each one lands in.

      npm run adopt
      npm run adopt -- --og sign.jpg     also make it the link preview

  --og takes one image and builds the social card from it: the picture that
  appears when the address is sent in iMessage, Slack or anywhere else. It is
  centre-cropped to 1200x630, which is the shape those previews expect.

  Nothing is destroyed: originals stay in incoming/ until you delete them,
  and the script refuses to overwrite a placement that already has real
  documentation.
*/

import { readdir, readFile, writeFile, copyFile, unlink, stat, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const INCOMING = 'incoming';
const WORKS = 'src/content/works';
const OG_OUT = 'public/og-default.jpg';
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);

const args = process.argv.slice(2);
const ogIndex = args.indexOf('--og');
const ogName = ogIndex > -1 ? args[ogIndex + 1] : undefined;

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

await mkdir(INCOMING, { recursive: true });

const files = (await readdir(INCOMING))
  .filter((f) => EXT.has(extname(f).toLowerCase()) && !f.startsWith('.'))
  .sort();

if (files.length === 0) {
  console.log(`
  Nothing in ${INCOMING}/.

  Drop the photographs in there and run this again. Name them 01-…, 02-…
  if you want to control which placement each one goes into.
`);
  process.exit(0);
}

/* ── The link preview ──────────────────────────────────────────────────── */

if (ogName) {
  const src = join(INCOMING, basename(ogName));
  if (!(await exists(src))) {
    console.error(`  --og: no such file "${src}"`);
    process.exit(1);
  }

  /*
    Cropped from the top, not the centre. A social card is a wide letterbox
    and most artwork is not, so a centre crop of an upright image takes a
    band out of its middle and loses whatever is at the top. Chroma
    subsampling stays off: hard graphic edges fringe badly with 4:2:0.
  */
  const { height = 0, width = 0 } = await sharp(src).metadata();
  const position = height > width ? 'top' : 'centre';

  await sharp(src)
    .resize(1200, 630, { fit: 'cover', position })
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(OG_OUT);

  const { size } = await stat(OG_OUT);
  console.log(`  link preview   ${basename(src)} -> ${OG_OUT}  ${(size / 1024).toFixed(0)} kB`);
}

/* ── The placements ────────────────────────────────────────────────────── */

const folders = (await readdir(WORKS, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

/** Aspect ratio of an image, to two decimals, for the placement rectangle. */
async function ratioOf(path) {
  const { width, height, orientation } = await sharp(path).metadata();
  if (!width || !height) return 1.5;
  // Respect EXIF rotation, or a portrait phone photo comes out landscape.
  const rotated = orientation && orientation >= 5;
  const w = rotated ? height : width;
  const h = rotated ? width : height;
  return Math.round((w / h) * 100) / 100;
}

let placed = 0;

for (const file of files) {
  // The preview image is placed as a work too. Being the picture that shows
  // up in a text message is not a reason to leave it out of the portfolio.
  const folder = folders[placed];
  if (!folder) {
    console.log(`  ! no placement left for ${file} — add another folder under ${WORKS}/`);
    break;
  }

  const mdPath = join(WORKS, folder, 'index.md');
  const source = await readFile(mdPath, 'utf8');

  if (!source.includes('./plate.png')) {
    console.log(`  · ${folder} already has real documentation — left alone`);
    placed += 1;
    continue;
  }

  const ext = extname(file).toLowerCase();
  const target = join(WORKS, folder, `documentation${ext}`);
  await copyFile(join(INCOMING, file), target);

  const ratio = await ratioOf(target);

  let next = source
    .replace(/^ratio: .*$/m, `ratio: ${ratio}`)
    /*
      Photographed, but not yet titled, dated or described. That is exactly
      what "uncatalogued" means, and it is the honest state to publish in.
    */
    .replace(/^status: placeholder$/m, 'status: uncatalogued')
    .replace(
      /^assets:\n(?: {2}- image: \.\/plate\.png\n)(?: {4}alt: .*\n)/m,
      `assets:\n  - image: ./documentation${ext}\n    alt: "TODO: describe this image for someone who cannot see it."\n`,
    );

  // If the assets block did not match exactly, fall back to a direct swap.
  if (next.includes('./plate.png')) {
    next = next.replace('./plate.png', `./documentation${ext}`);
  }

  await writeFile(mdPath, next);

  const plate = join(WORKS, folder, 'plate.png');
  if (await exists(plate)) await unlink(plate);

  console.log(`  ${folder}   ${file}   ratio ${ratio}`);
  placed += 1;
}

console.log(`
  ${placed} placement${placed === 1 ? '' : 's'} filled.

  Next: open each src/content/works/*/index.md and replace the TODO alt text
  with a real description, then add title, year and medium and set
  status: installed. See CONTENT.md.
`);
