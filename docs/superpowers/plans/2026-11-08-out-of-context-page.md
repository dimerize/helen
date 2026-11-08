# Out of Context Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/project?work=thesis` into *Out of Context*: one long, image-first scroll with sticky jump links, labeled gaps and a full-screen zoom viewer, and use the new names everywhere on the site.

**Architecture:** The thesis page becomes static Astro markup inside the shared `src/pages/project.astro`, rendered from one content file, `src/data/out-of-context.ts`. A small inline script in `<head>` resolves `?work=` before first paint and sets `<html data-work>`. CSS then shows either the long scroll or today's tabbed layout, so the other four projects stay exactly as they are and never load thesis images. A reusable zoom viewer (`zoom-viewer.js`, with its pure math in `zoom-geometry.js`) upgrades plain links to the image files, and opens and closes through `createDialogMotion`.

**Tech Stack:** Astro 7 static pages, plain ES modules in `public/studio`, `sharp` (image sizes at build time, and the adopt script), `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-02-out-of-context-page-design.md`. Read it first. This plan argues from it.

**Branch:** `claude/out-of-context-page`, cut from `claude/website-selected-works-nav-3ea29f` (the nav PR, dimerize/helen#1). The branch's first commit holds the spec and this plan.

## Global Constraints

- Static Astro site with no UI framework and no new runtime dependencies. No third-party scripts at runtime. Fonts are self-hosted.
- `/project` stays one page for all five projects, and the URL `/project?work=thesis` doesn't change. The other four (`standing`, `8ppi`, `jack`, `side-effects`) must look and behave exactly as today.
- Names: *Out of Context*; paintings *Gaping Net* (was Gaps in Netted Mesh), *Bent Mesh* (unchanged), *Stretched Out* (was Elongated). Year 2026. No "exhibited as Beyond the Humanized Machine" line.
- "Nothing on the site is larger than the work" (DECISIONS.md): no text or control is larger than the images.
- No invented facts: no materials, dimensions, dates or exhibitions beyond what Helen supplied. Gaping Net's caption carries "Acrylic on homasote". Transfer captions say only how they're grouped.
- No mockup shown as a finished painting. `thesis-dark-grid.webp` and `thesis-elongated.webp` never appear on this page. `thesis-installation.webp` appears only labeled as the original proposal.
- Gaps: a quiet frame at the expected proportions, labeled "Full view: photograph to come", "Projection video to come" or "Installation photographs to come". Never a mockup, never a broken-image icon.
- Keep the project page's look: the `project.css` tokens (`--paper`, `--ink`, `--muted`, `--line`, `--control`, `--stage`, `--gutter`), Geist type, and `studio-motion.js` for dialogs. Its breakpoints are 800px and 480px.
- Phones first, one column. 44px touch targets. Reduced motion respected: `project.css` already removes all transitions under `prefers-reduced-motion`.
- The first screen never waits on images below it. Everything below the opening image is `loading="lazy"`, the interpretation grid uses thumbnails, and every `<img>` has `width` and `height`.
- Zoom reaches at least 3×. This plan uses 4×.
- `npm test` stays green (121 tests today). New pure logic is tested in the `tests/*.test.mjs` style (`node:test`, `node:assert/strict`).
- Copy changes only where the spec says. Helen's new text replaces it later.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or open the PR without wemby's OK. Never merge: the draft PR waits for Helen's three full-body shots and her text.

### Verifying a build (worktree quirk)

`astro check`, `astro build` and `astro dev` fail inside this worktree with "Tsconfig not found astro/tsconfigs/strict", because the parent checkout's `tsconfig.json` has no `node_modules` beside it. The workaround is to build from the scratchpad copy, then serve its output from the worktree:

```bash
SCRATCH=/private/tmp/claude-501/-Users-wemby-Code-helen--claude-worktrees-website-selected-works-nav-3ea29f/3cb4b89e-87ac-4fe0-b56e-b1ac5047cc4f/scratchpad/mine-check
rsync -a --delete --exclude node_modules --exclude dist --exclude .git --exclude .astro --exclude incoming ./ "$SCRATCH/"
npm --prefix "$SCRATCH" run check && npm --prefix "$SCRATCH" run build && npm --prefix "$SCRATCH" run links
rsync -a --delete "$SCRATCH/dist/" dist/
```

The build passes when `check` reports `0 errors`, `0 warnings` and `0 hints`, the build finishes, and `links` prints `… internal links across … pages — all resolve.` Then `preview_start` with `{name: "helen-preview"}` serves `dist` at http://localhost:4325. If `$SCRATCH/node_modules` is missing, run `npm --prefix "$SCRATCH" ci` once. Rebuild after every source change: the preview serves files and doesn't reload them on its own.

## Review Focus

1. **The other four projects.** Opening any of them, on a phone or desktop, shows today's tabbed page: no flash of the long scroll, and no thesis image requested. A bare `/project` and an unknown `?work=` show Out of Context. → Task 3, Step 9.
2. **Gestures stay in the viewer.** Pinching or dragging in the viewer moves only the image. The page behind never scrolls or zooms, and the image can't be dragged past its own edges. → Task 4 clamp tests, Task 5 Step 7.
3. **Resizing while zoomed.** Rotating a phone or resizing the window while zoomed re-fits and re-clamps the image instead of stranding it off-centre. → Task 4 test `a rotated phone re-clamps a zoomed view`, Task 5 Step 7.
4. **Fast stepping.** Stepping quickly through the drawings on a slow connection never shows an earlier drawing's full image under a later caption. → Task 5 Step 3 (load token) and Step 7.
5. **Jump links.** Tapping a jump link puts that section's heading just below the sticky bar, not under it, and the bar marks that section. → Task 3 Step 7 (`scroll-margin-top`), Task 5 Step 7.

---

### Task 1: New names across the site

**Files:**
- Create: `tests/renames.test.mjs`
- Modify:
  - `public/studio/project.js:9,14,51,59-61,111`
  - `src/pages/project.astro:30`
  - `src/pages/work.astro:38,39,63`
  - `src/components/StudioPortal.astro:8,16,20,21`
  - `src/components/ArchiveSurface.astro:33`
  - `src/pages/gallery.astro:9,15`
  - `public/studio/gallery-door.js:18`
  - `public/studio/gallery-scene.js:107-109`
  - `public/studio/archive-data.js`: every entry with `"project": "thesis"`, plus `archiveProjects`

**Interfaces:** Nothing later calls this task. Task 3 deletes the `paintings` array renamed here.

- [ ] **Step 1: Write the failing tests** in `tests/renames.test.mjs`

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test tests/renames.test.mjs`
Expected: 3 failures. The first lists the eight files that still use an old name (every file in the Modify list except `ArchiveSurface.astro`), the second can't find the room intro, and the third gets `'Thesis project'`.

- [ ] **Step 3: Make the renames**

| Where | New text |
|---|---|
| `project.js:9` | `title: 'Out of Context',` and drop `titleHTML` |
| `project.js:14` | Keep the first `<p>`. The second becomes `<p>The interpretation images are viewers’ drawings over Gaping Net. The comparison makes their different readings visible.</p>` |
| `project.js:51` | `next: ['Out of Context', 'thesis']` |
| `project.js:59-61` | titles `'Gaping Net'`, `'Bent Mesh'`, `'Stretched Out'` |
| `project.js:111` | alt `'Gaping Net, painting photograph'` |
| `project.astro:30` | `<h1 id="project-title">Out of Context</h1>` |
| `work.astro:38` | alt `Gaping Net, a painting of dark loops across a pale surface` |
| `work.astro:39` | `<h2>Out of Context</h2>` |
| `work.astro:63` | `<span class="index-title">Out of Context</span>` |
| `StudioPortal.astro:8` | alt `The original proposal for Out of Context: paintings and projected interpretations arranged in a room`; link text `View Out of Context` |
| `StudioPortal.astro:16` | `<div class="hz-intro"><h2>Out of Context</h2><span>The original proposal · Helen Zhang, 2026</span></div>` |
| `StudioPortal.astro:20-21` | `Stretched Out`, `Gaping Net` (plain names; the intro carries the label) |
| `ArchiveSurface.astro:33` | link text `Explore Out of Context.` |
| `gallery.astro:9` | description `Step through the studio door into the original proposal for Helen Zhang’s Out of Context.` |
| `gallery.astro:15` | link text `View Out of Context` |
| `gallery-door.js:18` | `ctx.fillText('Out of Context',123,460)` |
| `gallery-scene.js:107-109` | titles `'Stretched Out (proposal mockup)'`, `'Gaping Net'`, `'Bent Mesh (proposal mockup)'` |
| `archive-data.js` | Every thesis entry gets `"relatedTitle": "Out of Context"`. On the `painting` entry, the title and the name in its caption become Gaping Net. Both interpretation captions say "Gaping Net". The `bent-mesh` caption and the `elongated` title and caption change as the test expects; the `elongated` alt becomes `"The Stretched Out image mockup from the thesis proposal."`. `archiveProjects.thesis.title` becomes `'Out of Context'`. Ids and the three train scans stay untouched, because the homepage links into them. |

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: `ℹ pass 124`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add tests/renames.test.mjs public/studio/project.js public/studio/gallery-door.js public/studio/gallery-scene.js public/studio/archive-data.js src/pages/project.astro src/pages/work.astro src/pages/gallery.astro src/components/StudioPortal.astro src/components/ArchiveSurface.astro
git commit -m "Rename the thesis to Out of Context across the site" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Helen's photographs into public/artwork

**Files:**
- Create: `scripts/adopt-artwork.mjs`
- Modify: `package.json` (add `"adopt": "node scripts/adopt-artwork.mjs"` to `scripts`), `README.md` (one Structure bullet)
- Generated and committed: `public/artwork/bent-mesh-detail-1.webp`, `stretched-out-detail-1.webp`, `stretched-out-detail-2.webp`, `transfers-three.webp`, `transfers-two.webp`, `transfers-one.webp`, and `interpretation-1-thumb.webp` through `interpretation-8-thumb.webp`

**Interfaces:** Produces the file names that Task 3's content file uses.

- [ ] **Step 1: Write `scripts/adopt-artwork.mjs`**

Start it with a header comment in the style of `scripts/make-og.mjs`: what it does, "run it, then commit the output", and that originals stay in `incoming/` (which is never published). It does two jobs:
  - Every `.jpg`, `.jpeg`, `.png`, `.tif`, `.tiff` and `.webp` anywhere under `incoming/` becomes `public/artwork/<basename>.webp`, through `sharp(file).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 })`.
  - Every `public/artwork/interpretation-<n>.webp` gets `interpretation-<n>-thumb.webp`, through `.resize({ width: 400 }).webp({ quality: 78 })`.

`MAX_EDGE = 2048` matches the rest of `public/artwork`. Note beside it that sharper originals need a separate zoom file before this is raised. Print one line per file written, for example `public/artwork/transfers-two.webp  2000×1333  301 KB`.

- [ ] **Step 2: Run it**

Run: `npm run adopt`
Expected: 14 lines. Six photographs at 1333×2000 or 2000×1333, and eight thumbnails at 400×576.

- [ ] **Step 3: Check that nothing else changed**

Run: `git status --short public/artwork`
Expected: exactly those 14 files, all untracked (`??`), and no modified files.

- [ ] **Step 4: Document it** with a README Structure bullet: "`scripts/adopt-artwork.mjs` (`npm run adopt`): turns photographs dropped into `incoming/` into WebP files in `public/artwork`, and makes the interpretation-grid thumbnails." This makes the `npm run adopt` that `incoming/README.txt` already promises work again.

- [ ] **Step 5: Commit**

```bash
git add scripts/adopt-artwork.mjs package.json README.md public/artwork/*-detail-*.webp public/artwork/transfers-*.webp public/artwork/interpretation-*-thumb.webp
git commit -m "Add Helen's transfer and close-up photographs, and grid thumbnails" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The Out of Context page

**Files:**
- Create:
  - `tests/out-of-context-content.test.mjs`
  - `src/data/out-of-context.ts`
  - `src/components/ZoomFigure.astro`
  - `src/components/ArtworkGap.astro`
  - `src/components/OutOfContext.astro`
  - `public/studio/out-of-context.css`
- Modify: `src/pages/project.astro`, `public/studio/project.js`, `README.md:22`

**Interfaces:**
- Consumes: Task 2's file names.
- Produces (Task 5 relies on these):
  - Every image is `<a class="zoom-trigger" href="/artwork/<file>" data-zoom data-caption="…"><img …></a>` inside `<figure class="zoom-figure">`. Images with a comparison add `data-compare="/artwork/<file>" data-compare-label="…"`.
  - Each section is `<section class="ooc-section" id="<id>" data-zoom-group>`.
  - The jump bar is `<nav class="ooc-jump">` with one `<a href="#<id>">` per section.
  - The opening figure has no `[data-zoom-group]` ancestor.
  - `<html data-work="<key>">` is set before first paint.

- [ ] **Step 1: Write the failing content test** in `tests/out-of-context-content.test.mjs`

It reads the content file as text, so it runs on any Node version.

```js
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

test('captions carry only what Helen supplied', () => {
  assert.ok(data.includes("caption: 'Gaping Net, full view. Acrylic on homasote.'"));
  assert.match(data, /compare: \{ file: 'thesis-painting\.webp', label: 'Gaping Net' \}/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/out-of-context-content.test.mjs`
Expected: the file fails with `ENOENT … src/data/out-of-context.ts`.

- [ ] **Step 3: Write `src/data/out-of-context.ts`** with exactly this content. It is the page's copy.

```ts
/*
  Everything the Out of Context page (/project?work=thesis) shows, in page
  order. Files live in public/artwork, and their pixel sizes are read at build
  time, so a sharper file under the same name drops in with no other change.
  Captions carry only facts Helen has supplied; her new text replaces them.
*/

/** An image on the page. `file` opens in the zoom viewer; `thumb`, when given, is what the page shows. */
export interface Artwork {
  file: string;
  thumb?: string;
  alt: string;
  /** Shown under the image and in the zoom viewer. */
  caption: string;
  /** Another image the zoom viewer can show beside this one. */
  compare?: { file: string; label: string };
}

/** A labeled frame for documentation still to come. `aspect` is a CSS aspect-ratio. */
export interface Gap {
  gap: string;
  aspect: string;
}

export type Slot = Artwork | Gap;

export const isGap = (slot: Slot): slot is Gap => 'gap' in slot;

/** Jump links, in page order. Each id is a section on the page. */
export const sections = [
  { id: 'source', label: 'Source' },
  { id: 'paintings', label: 'Paintings' },
  { id: 'transfers', label: 'Image transfers' },
  { id: 'projection', label: 'Projection' },
  { id: 'installation', label: 'Installation' },
];

// Helen's new full shot (her image 1) replaces this file on this page only.
// The 3D room, the Selected Works card, the archive and the drawing
// comparison keep thesis-painting.webp: the viewer drawings were made over it.
export const gapingNet: Artwork = {
  file: 'thesis-painting.webp',
  alt: 'Gaping Net, full view',
  caption: 'Gaping Net, full view. Acrylic on homasote.',
};

/** The first screen. Becomes an installation photograph when those arrive. */
export const opening: Artwork = gapingNet;

export const source: Artwork = {
  file: 'thesis-source.webp',
  alt: 'Three fragments of an advertisement, assembled from partial handheld scans',
  caption: 'Three fragments of an advertisement. Partial handheld scans assembled together. The partial capture is the starting point for the work.',
};

const fullViewToCome: Gap = { gap: 'Full view: photograph to come', aspect: '4 / 5' };

export const paintings: { name: string; full: Slot; closeUps: Slot[] }[] = [
  { name: 'Gaping Net', full: gapingNet, closeUps: [{ gap: 'Close-ups: photographs to come', aspect: '2 / 3' }] },
  {
    name: 'Bent Mesh',
    full: fullViewToCome,
    closeUps: [{ file: 'bent-mesh-detail-1.webp', alt: 'Bent Mesh, close-up', caption: 'Bent Mesh, close-up.' }],
  },
  {
    name: 'Stretched Out',
    full: fullViewToCome,
    closeUps: [
      { file: 'stretched-out-detail-1.webp', alt: 'Stretched Out, close-up', caption: 'Stretched Out, close-up.' },
      { file: 'stretched-out-detail-2.webp', alt: 'Stretched Out, second close-up', caption: 'Stretched Out, close-up.' },
    ],
  },
];

export const transfers: Artwork[] = [
  { file: 'transfers-three.webp', alt: 'Image transfers, three of the six', caption: 'Image transfers, three of the six.' },
  { file: 'transfers-two.webp', alt: 'Image transfers, two of the six', caption: 'Image transfers, two of the six.' },
  { file: 'transfers-one.webp', alt: 'Image transfer, one of the six', caption: 'Image transfers, one of the six.' },
];

export const projectionVideo: Gap = { gap: 'Projection video to come', aspect: '16 / 9' };

export const interpretations: Artwork[] = Array.from({ length: 8 }, (_, i) => ({
  file: `interpretation-${i + 1}.webp`,
  thumb: `interpretation-${i + 1}-thumb.webp`,
  alt: `Viewer drawing ${i + 1} over Gaping Net`,
  caption: `Viewer drawing ${i + 1} of 8, over Gaping Net.`,
  compare: { file: 'thesis-painting.webp', label: 'Gaping Net' },
}));

export const installationPhotos: Gap = { gap: 'Installation photographs to come', aspect: '3 / 2' };

export const proposal: Artwork = {
  file: 'thesis-installation.webp',
  alt: 'The original proposal: paintings and projected interpretations arranged in a room',
  caption: 'The original proposal. Proposed arrangement of paintings and projected interpretations, from the thesis materials.',
};
```

- [ ] **Step 4: Write the three components**

**`src/components/ZoomFigure.astro`**
- Props: `{ art: Artwork; caption?: boolean; class?: string }`, with `caption` defaulting to `true`.
- It shows `art.thumb ?? art.file`, and reads that file's pixel size at build time with `await sharp(\`public/artwork/${shown}\`).metadata()`. Every build runs from the project root, and a missing file fails the build.
- It renders `<figure class:list={['zoom-figure', className]}>`, then the trigger link from the Interfaces block wrapping `<img src width height alt loading="lazy" decoding="async">`, then `<figcaption>{art.caption}</figcaption>` when `caption` is true.
- All images are lazy, including the opening; the head script preloads the opening image.

**`src/components/ArtworkGap.astro`**
- Props: `{ label: string; aspect: string }`.
- Renders `<div class="artwork-gap" style={`aspect-ratio: ${aspect}`}><p>{label}</p></div>`.

**`src/components/OutOfContext.astro`**

It renders two siblings, so the bar can stay sticky to the end of `main`:
- `<nav class="ooc-jump thesis-only" aria-label="On this page">`, with one link per entry in `sections`.
- `<div class="ooc-sections thesis-only">`, holding the five sections in this order. Each is `<section class="ooc-section" id={id} aria-labelledby={`${id}-title`} data-zoom-group>` with `<h2 id={`${id}-title`}>`.
  1. `source`: h2 "Source", then `ZoomFigure` of `source`.
  2. `paintings`: h2 "Paintings". Then, per painting, an `<article class="ooc-painting">` containing:
     - an h3 with the name;
     - `<div class="ooc-painting-images">` holding `<div class="ooc-full">` (a `ZoomFigure` or an `ArtworkGap`, by `isGap`) and `<div class="ooc-closeups">` (each close-up, the same way).
  3. `transfers`: h2 "Image transfers (set of six)", then the three `ZoomFigure`s.
  4. `projection`: h2 "Projection", then the `ArtworkGap` for `projectionVideo`, then:
     - `<figure class="ooc-drawings">`, containing `<ul class="ooc-drawing-grid">` with one `<li>` per interpretation (`ZoomFigure` with `caption={false}`);
     - `<figcaption>Viewer drawings over Gaping Net</figcaption>`.
  5. `installation`: h2 "Installation", then the `ArtworkGap` for `installationPhotos`, then `<div class="ooc-proposal">` containing:
     - h3 "The original proposal";
     - `ZoomFigure` of `proposal`;
     - `<a class="gallery-project-link" href="/gallery">Walk through the proposal in 3D <span class="ui-icon icon-arrow-up-right" aria-hidden="true"></span></a>`.

- [ ] **Step 5: Wire the page into `src/pages/project.astro`**

**Frontmatter**
- Import `OutOfContext`, `ZoomFigure` and `{ opening }`.
- Add `const works = ['thesis', 'standing', '8ppi', 'jack', 'side-effects'];`. These are the same keys as `projects` in `project.js`.

**`<head>`**
- First, right after the viewport meta:

```astro
<script is:inline define:vars={{ works, opening: `/artwork/${opening.file}` }}>
  // Pick the layout before first paint: Out of Context is one long scroll,
  // the other projects keep their tabs. project.js reads the same key.
  const requested = new URLSearchParams(location.search).get('work');
  const work = works.includes(requested) ? requested : 'thesis';
  document.documentElement.dataset.work = work;
  // The opening image is lazy so the other projects never fetch it. Here it
  // still starts loading at once.
  if (work === 'thesis') document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'image', href: opening, fetchPriority: 'high' }));
</script>
```

- Add `<link rel="stylesheet" href="/studio/out-of-context.css">` directly after the `project.css` link.

**Body**
- Inside `.project-intro`, between the h1 and `.intro-bottom`: `<ZoomFigure art={opening} class="ooc-opening thesis-only" />`.
- Change `<section class="project-media" …>` to `class="project-media tabs-only"`.
- Put `<OutOfContext />` directly after `.project-intro`.

- [ ] **Step 6: Let `public/studio/project.js` skip the tabs for the thesis**

- Lines 54–55 become:

```js
  // project.astro resolves ?work= before first paint and leaves the key on <html>.
  const key = Object.hasOwn(projects, document.documentElement.dataset.work) ? document.documentElement.dataset.work : 'thesis';
```

- In the thesis entry, delete `views` and `defaultView`.
- After the two `next-project` lines, add `if (key === 'thesis') return;`. Then move the `view-tabs` line below it.
- Delete the thesis-only code:
  - the `paintings` array;
  - the `if (key === 'thesis') {…}` branch of `render()`, so the chain starts at `if (key === '8ppi' …)`;
  - the compare condition on the `content.innerHTML = imageMarkup(file, title)` line, leaving `if (file) …`;
  - `painting`, `drawing` and `compare` in `state` and in the reset handler;
  - the `compare-toggle` change listener.

Nothing else changes: the other four projects run the same code as today.

- [ ] **Step 7: Write `public/studio/out-of-context.css`**

The layout switch comes first, word for word:

```css
/* project.astro picks the layout from ?work= before first paint. Without
   JavaScript there is no data-work, and the page shows Out of Context. */
html[data-work]:not([data-work="thesis"]) .thesis-only{display:none}
html:not([data-work]) .tabs-only,html[data-work="thesis"] .tabs-only{display:none}
```

The rest is at the builder's discretion within `project.css`'s scale, but these rules are fixed:
- **Images.** `.zoom-figure` gets `margin:0`. Its `img` gets `display:block; width:auto; height:auto; max-width:100%; max-height:88svh; cursor:zoom-in`, so no painting is taller than the screen on desktop.
- **Captions.** `figcaption` gets 13px `--muted` text, with about 12px above it.
- **Opening.** `.ooc-opening` is a `--stage` field with the image centred, and the image's height is `min(calc(100svh - 300px), 1000px)` with a 320px floor. At 800px and below, the image is `width:100%; height:auto`. Acceptance: at 1440×900 and at 390×844 the opening image's bottom edge is on the first screen.
- **Jump bar.**
  - `.ooc-jump`: `position:sticky; top:0; z-index:5; display:flex; overflow-x:auto`, on a `--paper` background with a 1px `--line` bottom border, and inset by `--gutter`.
  - Links: `min-height:44px`, `white-space:nowrap`, `--muted`.
  - `[aria-current="true"]`: `--control`, with a 2px `--control` underline like `.view-tabs`.
- **Sections.** Each `.ooc-section` gets `scroll-margin-top:72px` and generous top margin, about `clamp(72px,9vw,130px)`. Each h2 is weight 400, never larger than `clamp(28px,2.6vw,40px)`.
- **Paintings.** Above 800px, `.ooc-painting-images` is `grid-template-columns:minmax(0,2fr) minmax(0,1fr)` with the close-ups stacked on the right. At 800px and below it's one column with the close-ups below the full view.
- **Transfers.** Large: one per row at full content width.
- **Drawing grid.** `.ooc-drawing-grid` is a list with no bullets, `display:grid`, an 8px gap, and `repeat(4,minmax(0,1fr))`, becoming `repeat(8,…)` above 800px.
- **Gaps.** `.artwork-gap` is a `--stage` box with a 1px `--line` border and `display:grid; place-items:center`, with its label in 13px `--muted`.

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: `ℹ pass 129`, `ℹ fail 0`.

- [ ] **Step 9: Build and check in the browser**

Build with the snippet under Global Constraints, then preview. Check each of these:
- **The thesis page.** `/project?work=thesis`, using `resize_window` at 1440×900 and at 390×844:
  - the sections appear in order;
  - the opening image's bottom edge is on the first screen;
  - the jump bar stays at the top all the way to "Continue exploring";
  - each jump link puts its h2 just below the bar: `h2.getBoundingClientRect().top` is at least the bar's bottom;
  - the gaps show their labels at their proportions;
  - no images are stretched, and the console is clean.
- **The other four.** For `standing`, `8ppi`, `jack` and `side-effects`:
  - the media area matches https://helenzhang.studio/project?work=<key> (same tabs, default image and caption);
  - `performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/artwork/'))` lists only that project's images, with no `thesis-*`, `transfers-*`, `*-detail-*` or `interpretation-*`.
- **Defaults.** `/project` and `/project?work=nope` show Out of Context.
- **Without JavaScript.** After `document.documentElement.removeAttribute('data-work')`, the long scroll shows and the tabs are hidden.
- **Links.** Clicking an image opens the image file itself; the viewer comes in Task 5.

- [ ] **Step 10: Document it.** `README.md:22` becomes: "`src/pages/project.astro`: shared project structure. Out of Context (`?work=thesis`) is static markup from `src/data/out-of-context.ts`, one long scroll; an inline script picks its layout before first paint. `public/studio/project.js` supplies the other four projects' content and tabbed media."

- [ ] **Step 11: Commit**

```bash
git add tests/out-of-context-content.test.mjs src/data/out-of-context.ts src/components/ZoomFigure.astro src/components/ArtworkGap.astro src/components/OutOfContext.astro public/studio/out-of-context.css src/pages/project.astro public/studio/project.js README.md
git commit -m "Build Out of Context as one image-first scroll" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Zoom geometry

**Files:**
- Create: `public/studio/zoom-geometry.js`, `tests/zoom-geometry.test.mjs`

**Interfaces:**
- Produces (pure, no DOM; Task 5 imports all of it):
  - `ZOOM = { min: 1, max: 4, doubleTap: 2.5, step: 1.5, panKey: 80, swipe: 56, tapTime: 300, tapDistance: 24 }`.
  - Sizes are `{width, height}`. Points are `{x, y}`, measured from the stage centre. A view is `{scale, x, y}`, where `x` and `y` translate the image's centre.
  - `fitSize(stage, natural) → size`
  - `clampView(view, fit, stage) → view`
  - `zoomAt(view, scale, focus, fit, stage) → view`
  - `pinchView({view, mid, distance}, {mid, distance}, fit, stage) → view`
  - `panBy(view, dx, dy, fit, stage) → view`
  - `wheelFactor({deltaY, deltaMode = 0, ctrlKey = false}) → number`
  - `stepIndex(index, delta, length) → number`
  - `swipeStep({dx, dy}) → -1 | 0 | 1`
  - `isDoubleTap(previous | null, tap) → boolean`, where a tap is `{time, x, y}`
  - `keyIntent(key, zoomed) → {step} | {pan: [dx, dy]} | {zoom: 'in' | 'out' | 'reset'} | null`

- [ ] **Step 1: Write the failing tests** in `tests/zoom-geometry.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM, fitSize, clampView, zoomAt, pinchView, panBy, wheelFactor, stepIndex, swipeStep, isDoubleTap, keyIntent } from '../public/studio/zoom-geometry.js';

const square = { width: 800, height: 800 };

test('the viewer zooms to at least 3×', () => {
  assert.equal(ZOOM.min, 1);
  assert.ok(ZOOM.max >= 3);
});

test('fitSize contains the whole image in the stage', () => {
  assert.deepEqual(fitSize({ width: 1000, height: 800 }, { width: 1604, height: 2048 }), { width: 626.5625, height: 800 });
  assert.deepEqual(fitSize({ width: 390, height: 600 }, { width: 2000, height: 1000 }), { width: 390, height: 195 });
});

test('clampView keeps the scale between fit and the maximum', () => {
  assert.equal(clampView({ scale: .5, x: 0, y: 0 }, square, square).scale, 1);
  assert.equal(clampView({ scale: 9, x: 0, y: 0 }, square, square).scale, ZOOM.max);
});

test('at fit the image stays centred', () => {
  assert.deepEqual(clampView({ scale: 1, x: 50, y: -30 }, { width: 626.5625, height: 800 }, { width: 1000, height: 800 }), { scale: 1, x: 0, y: 0 });
});

test('a zoomed image pans only as far as its own edges', () => {
  assert.deepEqual(clampView({ scale: 2, x: 500, y: -900 }, { width: 626.5625, height: 800 }, { width: 1000, height: 800 }), { scale: 2, x: 126.5625, y: -400 });
});

test('zoomAt keeps the point under the pointer still', () => {
  const view = zoomAt({ scale: 1, x: 0, y: 0 }, 2, { x: 200, y: 100 }, square, square);
  assert.deepEqual(view, { scale: 2, x: -200, y: -100 });
  assert.deepEqual(zoomAt(view, 1, { x: 200, y: 100 }, square, square), { scale: 1, x: 0, y: 0 });
});

test('pinchView scales with the fingers and follows their midpoint', () => {
  const start = { view: { scale: 1, x: 0, y: 0 }, mid: { x: 0, y: 0 }, distance: 100 };
  assert.deepEqual(pinchView(start, { mid: { x: 30, y: 0 }, distance: 200 }, square, square), { scale: 2, x: 30, y: 0 });
});

test('panBy moves a zoomed image and stops at its edge', () => {
  assert.deepEqual(panBy({ scale: 2, x: 0, y: 0 }, -80, 0, square, square), { scale: 2, x: -80, y: 0 });
  assert.deepEqual(panBy({ scale: 2, x: -390, y: 0 }, -80, 0, square, square), { scale: 2, x: -400, y: 0 });
});

test('a rotated phone re-clamps a zoomed view', () => {
  const view = { scale: 3, x: 800, y: 0 }; // valid on an 800 × 800 stage
  const stage = { width: 400, height: 800 };
  assert.deepEqual(clampView(view, fitSize(stage, { width: 1000, height: 1000 }), stage), { scale: 3, x: 400, y: 0 });
});

test('wheelFactor: scrolling up zooms in, down zooms out, a trackpad pinch is stronger', () => {
  assert.ok(wheelFactor({ deltaY: -100 }) > 1);
  assert.ok(wheelFactor({ deltaY: 100 }) < 1);
  assert.ok(wheelFactor({ deltaY: -10, ctrlKey: true }) > wheelFactor({ deltaY: -10 }));
  assert.equal(wheelFactor({ deltaY: -3, deltaMode: 1 }), wheelFactor({ deltaY: -48 }));
});

test('stepIndex wraps around a section, like the archive viewer', () => {
  assert.equal(stepIndex(7, 1, 8), 0);
  assert.equal(stepIndex(0, -1, 8), 7);
  assert.equal(stepIndex(3, 1, 8), 4);
  assert.equal(stepIndex(0, 1, 1), 0);
});

test('swipeStep: a clear sideways swipe steps, a short or diagonal one does not', () => {
  assert.equal(swipeStep({ dx: -80, dy: 10 }), 1);
  assert.equal(swipeStep({ dx: 80, dy: 0 }), -1);
  assert.equal(swipeStep({ dx: -40, dy: 0 }), 0);
  assert.equal(swipeStep({ dx: -80, dy: 70 }), 0);
});

test('isDoubleTap needs two taps close in time and place', () => {
  assert.equal(isDoubleTap(null, { time: 0, x: 0, y: 0 }), false);
  assert.equal(isDoubleTap({ time: 0, x: 100, y: 100 }, { time: 250, x: 110, y: 105 }), true);
  assert.equal(isDoubleTap({ time: 0, x: 100, y: 100 }, { time: 400, x: 100, y: 100 }), false);
  assert.equal(isDoubleTap({ time: 0, x: 100, y: 100 }, { time: 200, x: 140, y: 100 }), false);
});

test('keyIntent: arrows step at fit and pan when zoomed', () => {
  assert.deepEqual(keyIntent('ArrowRight', false), { step: 1 });
  assert.deepEqual(keyIntent('ArrowLeft', false), { step: -1 });
  assert.equal(keyIntent('ArrowUp', false), null);
  assert.deepEqual(keyIntent('ArrowRight', true), { pan: [-ZOOM.panKey, 0] });
  assert.deepEqual(keyIntent('ArrowDown', true), { pan: [0, -ZOOM.panKey] });
  assert.deepEqual(keyIntent('+', false), { zoom: 'in' });
  assert.deepEqual(keyIntent('=', true), { zoom: 'in' });
  assert.deepEqual(keyIntent('-', true), { zoom: 'out' });
  assert.deepEqual(keyIntent('0', true), { zoom: 'reset' });
  assert.equal(keyIntent('a', false), null);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test tests/zoom-geometry.test.mjs`
Expected: it fails to import `../public/studio/zoom-geometry.js`.

- [ ] **Step 3: Implement `public/studio/zoom-geometry.js`** with the Interfaces signatures. The tests' exact values depend on a few details:
  - **`fitSize`** compares aspect ratios, and multiplies before dividing: `stage.height * natural.width / natural.height`.
  - **`clampView`**
    - It clamps the scale to `ZOOM.min…ZOOM.max`.
    - On each axis the overflow is `(fit * scale - stage) / 2`. With no overflow, that axis is exactly `0`. `deepEqual` tells `-0` from `0`, so the code must never return `-0`.
    - Otherwise the axis is clamped to `±overflow`.
  - **`zoomAt`** first clamps the scale, then sets `x' = focus.x - (focus.x - x) * scale' / scale` (and the same for y), then calls `clampView`.
  - **`pinchView`** uses `scale = start.view.scale * now.distance / start.distance`, clamped to `ZOOM.min…ZOOM.max` before anything else. Then `x = now.mid.x - (start.mid.x - start.view.x) * scale / start.view.scale` (and the same for y), then `clampView`.
  - **`wheelFactor`** converts the delta to pixels (`deltaMode` 1 means ×16, 2 means ×400), then returns `Math.exp(-pixels * (ctrlKey ? 0.01 : 0.0015))`.
  - **`stepIndex`** is `(index + delta + length) % length`.
  - **`swipeStep`** returns a step only when `|dx| ≥ ZOOM.swipe` and `|dx| > 1.5 |dy|`. A left swipe (`dx < 0`) is `1`, meaning next.
  - **`isDoubleTap`** needs `≤ ZOOM.tapTime` milliseconds and `≤ ZOOM.tapDistance` pixels between the taps.
  - **`keyIntent`**
    - Left and Right arrows step at fit, and pan when zoomed.
    - Up and Down arrows pan only when zoomed.
    - `+` and `=` zoom in, `-` and `_` zoom out, and `0` resets.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: `ℹ pass 143`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add public/studio/zoom-geometry.js tests/zoom-geometry.test.mjs
git commit -m "Add the zoom viewer's geometry, with tests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The zoom viewer, wired into the page

**Files:**
- Create:
  - `src/components/ZoomViewer.astro`
  - `public/studio/zoom-viewer.js`
  - `public/studio/zoom-viewer.css`
  - `public/studio/out-of-context.js`
- Modify:
  - `src/pages/project.astro`: import `ZoomViewer` in the frontmatter, link `zoom-viewer.css` after `out-of-context.css`, and put `<ZoomViewer />` after `#image-dialog`.
  - `public/studio/project.js`: the thesis early return.

**Interfaces:**
- Consumes:
  - Task 3's trigger, section and jump-bar markup.
  - Task 4's exports.
  - `createDialogMotion(dialog, {initialFocus})` from `studio-motion.js`, whose `open(trigger)` returns focus to `trigger` on close.
- Produces:
  - `createZoomViewer(dialog) → { open(trigger), close() }`
  - `enhanceZoomTriggers(root, viewer) → void`
  - `initOutOfContext(doc = document) → void`

  Other pages can adopt the viewer later with the first two alone.

- [ ] **Step 1: Write `src/components/ZoomViewer.astro`**

These hooks are fixed; the JS relies on them:
- `<dialog id="zoom-viewer" class="zoom-viewer" aria-labelledby="zoom-caption" aria-describedby="zoom-help">`.
- **Top bar:**
  - `<p class="zoom-position" aria-live="polite"></p>`;
  - `<button type="button" class="zoom-close">Close <span class="ui-icon icon-close" aria-hidden="true"></span></button>`.
- **Stage:** `<div class="zoom-stage">` holding two panes. Each is `<figure class="zoom-pane" data-pane="item|compare"><img alt="" draggable="false"><figcaption class="zoom-pane-label"></figcaption></figure>`.
- **Bottom bar:**
  - `<p id="zoom-caption" class="zoom-caption"></p>`;
  - buttons `data-zoom-action="out"` (aria-label "Zoom out", an inline SVG minus), `"in"` (aria-label "Zoom in", an inline SVG plus) and `"reset"` (text "Reset");
  - `<button type="button" class="zoom-compare" aria-pressed="false" hidden>Compare with <span></span></button>`;
  - buttons `data-zoom-step="-1"` (aria-label "Previous image") and `data-zoom-step="1"` (aria-label "Next image"), with the `icon-arrow-left` and `icon-arrow-right` icons.
- **Help text:** `<p id="zoom-help" class="zoom-visually-hidden">Pinch, scroll or double-tap to zoom, and drag to move. Arrow keys move between images, or move a zoomed image. Plus and minus zoom; 0 resets.</p>`.

- [ ] **Step 2: Write `public/studio/zoom-viewer.css`**

These rules are fixed; the look follows `project.css`:
- **Full-screen.** `.zoom-viewer` gets `width:100vw; height:100dvh; max-width:none; max-height:none; margin:0; padding:0; border:0; background:var(--paper); overscroll-behavior:contain; touch-action:none`. With `[open]` it is `display:grid; grid-template-rows:auto minmax(0,1fr) auto`. These override `project.css`'s generic `dialog` rules by specificity.
- **Stage and panes.**
  - `.zoom-stage` gets `position:relative; overflow:hidden; display:flex; gap:16px`. Its cursor is `zoom-in` at fit, `grab` when zoomed, and `grabbing` while dragging.
  - `.zoom-pane` gets `flex:1; min-width:0; margin:0; display:grid; place-items:center; overflow:hidden`.
  - Pane images get `max-width:none; user-select:none; transition:transform .25s cubic-bezier(.2,.7,.2,1)`.
  - `.is-gesturing` on the stage sets `transition:none`.
- **Compare.**
  - `.zoom-viewer:not(.is-comparing) [data-pane="compare"]` is `display:none`, and `.zoom-pane-label` shows only under `.is-comparing`.
  - At 800px and below, `.zoom-viewer.is-comparing [data-pane="item"]` is `display:none`, so on phones the compare button switches between the two images.
- **Controls.** Every control is at least 44×44px. The bars wrap on phones, and the caption is 13px `--muted`.
- **Screen-reader text.** `.zoom-visually-hidden` is the usual visually-hidden pattern (`position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap`).

- [ ] **Step 3: Write `public/studio/zoom-viewer.js`**

It exports `createZoomViewer(dialog)` and `enhanceZoomTriggers(root, viewer)`, and must behave like this:

**Opening**
- `open(trigger)` collects `a[data-zoom]` links, in DOM order, inside `trigger.closest('[data-zoom-group]')`. A trigger outside any group stands alone.
- It shows the trigger's item, then calls `motion.open(trigger)`, where `motion = createDialogMotion(dialog, {initialFocus: <close button>})`. Focus returns to the image that opened the viewer.

**Showing an item**
- The view resets to `{scale:1, x:0, y:0}`.
- The caption comes from `data-caption`, and the item pane's alt from the trigger's `img.alt`.
- The position reads `N / M`, and both it and the step buttons are hidden when M is 1.
- The compare button shows only when the item has `data-compare`, and its label reads "Compare with {data-compare-label}".
- **Loading.** If the trigger's own `<img>` has loaded (`complete && naturalWidth`), show its `currentSrc` at once. Then load `trigger.href` with `new Image()`, and swap it in on load.
- **Load token.** Each item gets a token from `++loadToken`, and a load or error whose token is no longer current is ignored. This keeps fast stepping honest.
- **Failure.** If the full image fails and nothing is showing, the pane shows "Image unavailable. Please try again." as text, never a broken image.

**Compare**
- The compare button toggles `aria-pressed` and `is-comparing` on the dialog.
- The compare pane shows `data-compare`, labeled with `data-compare-label`. The item pane is labeled with the item's alt.
- The state carries across steps and applies only to items that have `data-compare`.

**Layout**
- Each visible pane's image is sized to `fitSize(pane rect, natural size)`, with the natural size from `naturalWidth/Height`. Thumbnail and full image share an aspect ratio, so the fit doesn't change when the full image swaps in.
- One shared view is applied to every visible pane image as `translate(xpx, ypx) scale(s)`. It is clamped against the first visible pane.
- On window `resize` and on compare changes, re-fit and `clampView`.

**Pointer**
- Use Pointer Events on `.zoom-stage`, with `setPointerCapture`.
- **One pointer.** When zoomed, the image pans with the pointer (`panBy`). At fit, lifting the pointer sends `swipeStep({dx, dy})` to step. A tap moving under 10px goes to `isDoubleTap`; a double tap toggles between fit and `ZOOM.doubleTap`, zooming at the tap point with `zoomAt`.
- **Two pointers.** Pinch with `pinchView`, measured from the gesture's start.
- While pointers are down, add `is-gesturing` to the stage.

**Wheel**
- The listener is `{passive:false}`, and calls `preventDefault`.
- It uses `zoomAt(view, view.scale * wheelFactor(event), pointer, …)`.
- It sets `is-gesturing` until 150ms after the last wheel event.

**Buttons and keys**
- The zoom buttons call `zoomAt` at the centre (`{x:0, y:0}`) with `× ZOOM.step` or `÷ ZOOM.step`, and Reset sets the view to `{1,0,0}`. These animate.
- `keydown` on the dialog maps through `keyIntent(event.key, view.scale > 1)` to step, `panBy` or zoom, and calls `preventDefault` when it handles a key.
- Escape stays with `createDialogMotion`, and the Close button calls `motion.close()`.

**`enhanceZoomTriggers`**
- It sets `aria-haspopup="dialog"` on every `a[data-zoom]` under `root`.
- On a plain primary click it calls `preventDefault()` and `viewer.open(link)`. Modified clicks and middle clicks still open the file.

- [ ] **Step 4: Write `public/studio/out-of-context.js`**

`initOutOfContext(doc = document)` does three things:
- **Viewer.** `enhanceZoomTriggers(doc, createZoomViewer(doc.getElementById('zoom-viewer')))`.
- **Jump bar.** An `IntersectionObserver` on `.ooc-section`, with `rootMargin: '-35% 0px -60% 0px'`. The link for the first section in view gets `aria-current="true"` and the others lose it. With no section in view (the opening, or About), no link is current.
- **Failed images.** Each `.zoom-trigger img` that has already failed (`complete && !naturalWidth`) or later fires `error` is replaced, link and all, by an `.artwork-gap` box of the same aspect ratio, labeled "`{alt}`: image unavailable. Please try again." This mirrors `project.js`'s message.

- [ ] **Step 5: Wire it up**

In `project.js`, replace `if (key === 'thesis') return;` with:

```js
  if (key === 'thesis') {
    // The page itself is static markup; this adds the zoom viewer and the jump-bar highlight.
    import('./out-of-context.js').then(({ initOutOfContext }) => initOutOfContext());
    return;
  }
```

In `project.astro`, add the stylesheet link and `<ZoomViewer />`, as listed under Files.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: `ℹ pass 143`, `ℹ fail 0`.

- [ ] **Step 7: Build and check in the browser**

Build with the snippet, then preview `/project?work=thesis`. Check each of these:

**Desktop, 1440×900**
- Clicking the opening image opens the viewer full-screen, with the caption showing and Close focused.
- Scrolling up zooms around the pointer, and stops at 4×.
- Dragging pans, and stops at the image's edges.
- Double-click toggles between 2.5× and fit, and +, − and Reset work.
- Escape closes the viewer, and `document.activeElement` is the opening link again.

**Paintings**
- The Bent Mesh close-up reads `2 / 4`.
- ArrowRight goes to `3 / 4`, and at `4 / 4` it wraps to `1 / 4`.
- When zoomed, ArrowRight pans instead of stepping.

**Drawings**
- Drawing 3 reads `3 / 8` and shows "Compare with Gaping Net".
- Pressing it shows the two images side by side, both labeled, and zoom moves both.
- Stepping to drawing 4 keeps the comparison.
- Source has no compare button, no position and no step buttons.

**Phone, 390×844**
- Pressing Compare switches the single pane to Gaping Net, and pressing it again switches back.
- A 120px leftward `left_click_drag` at fit steps to the next image.
- Every control measures at least 44×44 (`getBoundingClientRect`).

**Resizing**
- Zoom to 3× at 1440 wide, then resize to 390. The image re-fits, with no empty band at any edge.

**Fast stepping**
- Press ArrowRight six times quickly in the drawings. The pane image's `src` matches the item the caption names.

**Jump bar**
- The link for the section in view is marked.
- Clicking "Projection" lands its h2 below the bar.

**Failed image**
- In the console, set one `.zoom-trigger img` `src` to `/artwork/missing.webp`. A labeled frame replaces it, with no broken-image icon.

**Console**
- No errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ZoomViewer.astro public/studio/zoom-viewer.js public/studio/zoom-viewer.css public/studio/out-of-context.js public/studio/project.js src/pages/project.astro
git commit -m "Open every Out of Context image in a zoom viewer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Whole-site check and hand-off

**Files:** none, unless a check fails. Fix any failure in the task that owns the code, then re-run that task's checks.

- [ ] **Step 1: Run the tests.** `npm test`. Expected: `ℹ pass 143`, `ℹ fail 0`.
- [ ] **Step 2: Build.** Use the build snippet. Expected: `0 errors`, `0 warnings`, `0 hints`, and all links resolve. The link check covers every `href` and `src` the new page adds.
- [ ] **Step 3: Check every other place the names appear**, in the preview, at 1440×900 and 390×844:
  - **The 3D room** (`/?room=gallery`): the intro reads "Out of Context" with "The original proposal · Helen Zhang, 2026" fitting on one line; the door sign reads "Out of Context"; the Works menu lists Stretched Out, Gaping Net and Bent Mesh; approaching each painting shows its caption.
  - **The archive:** Gaping Net, Bent Mesh and Stretched Out show the new titles and captions.
  - **Selected Works:** the strip card and the index both say Out of Context.
  - **The homepage scanner** behaves as before.
- [ ] **Step 4: Check the other four projects** once more at 390×844. Each shows its tabs, and there are no console errors.
- [ ] **Step 5: Hand over.** Report what's done and what is still a gap: the full-body shots, the Gaping Net close-ups, the installation photographs, the video and Helen's text. Then ask wemby before pushing.
  - On a yes: `git push -u origin claude/out-of-context-page`, then open a **draft** PR against `main` that names the merge condition (Helen's three full-body shots and her text).
  - Pushing also starts a Cloudflare preview build. That is not the live site.
  - If dimerize/helen#1 has merged by then, first rebase onto `main`: `git fetch origin`, then `git rebase --onto origin/main 9838799`.
