#!/usr/bin/env node
/*
  Generates the social preview image and the app icon.

  The preview is a miniature of the entry screen: dark ground, one off-centre
  light spill, the 57" hanging line, registration corner marks, her name.

  Run once, commit the output. It only needs regenerating if her name or the
  discipline line changes.

      npm run og

  Note: the type here falls back to a system sans, because the build machine
  has no Geist installed. That is fine — the output is a 1200×630 raster
  nobody compares side by side with the site.
*/

import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const NAME = 'HELEN ZHANG';
const LINE = 'INSTALLATION  /  MOVING IMAGE  /  NEW YORK';

const GROUND = '#050505';
const INK = '#e6e8ea';
const MUTED = '#8a9099';
const FAINT = '#4a5057';
const SANS = 'Geist, Helvetica Neue, Helvetica, Arial, sans-serif';
const MONO = 'Geist Mono, SF Mono, Menlo, Consolas, monospace';

function entrySvg(w, h) {
  const lineY = Math.round(h * 0.57);
  const pad = Math.round(w * 0.055);
  const c = Math.round(Math.min(w, h) * 0.035);
  const sw = Math.max(1, Math.round(w / 900));

  const corner = (x, y, sx, sy) =>
    `<path d="M${x} ${y}h${sx * c}M${x} ${y}v${sy * c}" stroke="${FAINT}" stroke-width="${sw}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="spill" cx="63%" cy="33%" r="70%">
      <stop offset="0%"   stop-color="#d6dee6" stop-opacity="0.11"/>
      <stop offset="42%"  stop-color="#d6dee6" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#050505" stop-opacity="0"/>
    </radialGradient>
    <!--
      A dark gradient across 8-bit sRGB bands badly — you get visible rings.
      A little grain over the top dithers the steps away. The live site does
      the same thing in the composite shader.
    -->
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" fill="${GROUND}"/>
  <rect width="${w}" height="${h}" fill="url(#spill)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.055"/>

  <path d="M0 ${lineY}H${w}" stroke="${INK}" stroke-opacity="0.15" stroke-width="${sw}"/>
  <path d="M${pad} ${lineY - 5}v10M${w - pad} ${lineY - 5}v10" stroke="${INK}" stroke-opacity="0.3" stroke-width="${sw}"/>
  <text x="${w - pad}" y="${lineY - 18}" text-anchor="end" font-family="${MONO}"
        font-size="15" letter-spacing="1.4" fill="${MUTED}">57&#8221; CENTER</text>

  ${corner(pad, pad, 1, 1)}
  ${corner(w - pad, h - pad, -1, -1)}

  <text x="${pad}" y="${h - pad - 34}" font-family="${SANS}" font-size="42"
        letter-spacing="6" fill="${INK}">${NAME}</text>
  <text x="${pad}" y="${h - pad}" font-family="${MONO}" font-size="16"
        letter-spacing="2" fill="${MUTED}">${LINE}</text>
</svg>`;
}

/* The mark: a registration cross. Same language as the calibration plates. */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#050505"/>
  <circle cx="16" cy="16" r="7.5" fill="none" stroke="#e6e8ea" stroke-width="1.5"/>
  <path d="M16 3v26M3 16h26" stroke="#e6e8ea" stroke-width="1.5"/>
</svg>
`;

await writeFile('public/favicon.svg', FAVICON);
console.log('  public/favicon.svg');

/*
  The preview goes out as JPEG: it carries film grain, and grain is exactly
  what PNG cannot compress (463kb as PNG, ~70kb here). The icon stays PNG —
  flat shapes, no grain, and it needs the alpha channel.
*/
await sharp(Buffer.from(entrySvg(1200, 630)))
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true })
  .toFile('public/og-default.jpg');
console.log('  public/og-default.jpg');

await sharp(
  Buffer.from(FAVICON.replace('viewBox="0 0 32 32"', 'width="512" height="512" viewBox="0 0 32 32"')),
)
  .png({ compressionLevel: 9 })
  .toFile('public/icon-512.png');
console.log('  public/icon-512.png');
