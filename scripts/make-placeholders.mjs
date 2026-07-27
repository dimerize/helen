#!/usr/bin/env node
/*
  Generates the placeholder image for every work that does not yet have real
  documentation.

  The placeholder is a photographic calibration plate — a six-step grey
  wedge, a registration cross, corner marks and a scale bar. The kind of
  target a photographer puts in frame to calibrate exposure and colour. It
  is obviously not artwork, it suits the site's material, and it is honest
  about being a stand-in.

  It is deliberately geometric with no text: text baked into a raster cannot
  be read by a screen reader, cannot be translated, and renders unreliably
  through librsvg. The wording ("RESERVED PLACEMENT" and the number) is DOM
  text drawn by the component instead.

  Run:  npm run placeholders

  Safety: only touches works whose status is `placeholder` or
  `documentation pending`, and only ever writes a file called plate.png.
  It will never overwrite real photographs.
*/

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const WORKS_DIR = 'src/content/works';
const LONG_EDGE = 1600;
const PLATE = 'plate.png';

/** The wedge steps, dark to light. Matches the site's ink ramp. */
const WEDGE = ['#1b1e21', '#33383d', '#565c63', '#868d95', '#b4bac1', '#e6e8ea'];
const GROUND = '#0d0f11';
const MARK = '#7e858d';
const MARK_FAINT = '#4a5057';

/** Pull a single scalar out of YAML frontmatter without a parser dependency. */
function frontmatterValue(source, key) {
  const body = source.split(/^---\s*$/m)[1] ?? '';
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    const match = trimmed.match(new RegExp(`^${key}\\s*:\\s*(.+)$`));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

function plateSvg(width, height) {
  const min = Math.min(width, height);
  const pad = Math.round(min * 0.075);
  const stroke = Math.max(1, Math.round(min * 0.0022));

  // Six-step wedge, bottom-left.
  const wedgeH = Math.round(min * 0.075);
  const wedgeW = Math.round(width * 0.46);
  const stepW = wedgeW / WEDGE.length;
  const wedgeY = height - pad - wedgeH;
  const wedge = WEDGE.map(
    (fill, i) =>
      `<rect x="${(pad + i * stepW).toFixed(2)}" y="${wedgeY}" width="${stepW.toFixed(2)}" height="${wedgeH}" fill="${fill}"/>`,
  ).join('');

  // Registration cross, optically centred a little above true centre.
  const cx = width / 2;
  const cy = height * 0.46;
  const r = Math.round(min * 0.085);
  const arm = r * 1.85;
  const cross = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${MARK}" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.34)}" fill="none" stroke="${MARK_FAINT}" stroke-width="${stroke}"/>
    <path d="M${cx} ${cy - arm}V${cy + arm}M${cx - arm} ${cy}H${cx + arm}" stroke="${MARK}" stroke-width="${stroke}"/>`;

  /*
    No corner marks here. PlacementRect draws registration marks on the
    rectangle itself, and a second set baked into the image reads as noise
    rather than as precision.
  */

  // Scale bar, bottom-right: a rule with five division ticks.
  const barW = Math.round(width * 0.2);
  const barX = width - pad - barW;
  const barY = wedgeY + Math.round(wedgeH * 0.5);
  const tick = Math.round(min * 0.018);
  const ticks = Array.from({ length: 6 }, (_, i) => {
    const x = barX + (barW / 5) * i;
    const h = i % 5 === 0 ? tick * 1.7 : tick;
    return `<path d="M${x.toFixed(2)} ${barY - h / 2}v${h}" stroke="${MARK}" stroke-width="${stroke}"/>`;
  }).join('');
  const bar = `<path d="M${barX} ${barY}h${barW}" stroke="${MARK}" stroke-width="${stroke}"/>${ticks}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${GROUND}"/>
    ${cross}${wedge}${bar}
  </svg>`;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const entries = await readdir(WORKS_DIR, { withFileTypes: true });
const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

let written = 0;
let skipped = 0;

for (const folder of folders) {
  const mdPath = join(WORKS_DIR, folder, 'index.md');
  if (!(await exists(mdPath))) {
    console.warn(`  ! ${folder} has no index.md — skipped`);
    continue;
  }

  const source = await readFile(mdPath, 'utf8');
  const status = frontmatterValue(source, 'status') ?? 'placeholder';

  if (status === 'installed') {
    skipped += 1;
    continue;
  }

  const ratio = Number(frontmatterValue(source, 'ratio') ?? 1.5);
  const [width, height] =
    ratio >= 1
      ? [LONG_EDGE, Math.round(LONG_EDGE / ratio)]
      : [Math.round(LONG_EDGE * ratio), LONG_EDGE];

  const out = join(WORKS_DIR, folder, PLATE);
  await sharp(Buffer.from(plateSvg(width, height)))
    .png({ compressionLevel: 9, palette: true })
    .toFile(out);

  const { size } = await stat(out);
  console.log(`  ${folder}  ${width}×${height}  ${(size / 1024).toFixed(1)} kB`);
  written += 1;
}

console.log(
  `\n${written} plate${written === 1 ? '' : 's'} written` +
    (skipped ? `, ${skipped} installed work${skipped === 1 ? '' : 's'} left alone` : ''),
);
