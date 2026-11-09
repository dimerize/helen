# Out of Context page: design

**Date:** 2026-11-02 · **Status:** approved by wemby, 2026-11-08 · **Branch:** `claude/out-of-context-page`, off `claude/website-selected-works-nav-3ea29f` (see Shipping) · **Plan:** `docs/superpowers/plans/2026-11-08-out-of-context-page.md`

## Why

Helen has renamed her thesis from *Beyond the Humanized Machine* to *Out of Context*, and she now has real photographs of the finished work. The current project page (`/project?work=thesis`) was built from the thesis proposal: two of its three paintings are digital mockups, the room view is a mockup, and every image sits small inside a tab. Helen wants the page to be about the images: big, inspectable, with a pop-out viewer for zooming in.

It has to work for curators and grad-school or job reviewers, most of them arriving from Helen's Instagram on phones.

Sources: Helen's voice brief (relayed 2026-11-02) and the decisions recorded below.

## Goals

1. Replace the thesis page's tabs with one long, image-first scroll.
2. Show only real documentation of the finished pieces. The one exception is the original proposal render, labeled as the proposal.
3. Let visitors open any image full-screen and zoom in.
4. Use the new names everywhere on the site.
5. Show missing media as honest, labeled gaps.

## Non-goals for this round

- Helen's new text. Her text deck couldn't be opened (macOS blocked the file), so the page keeps today's copy with the new names. Her text replaces it before launch.
- Animated thumbnails, video hosting, the other four project pages (they keep their tabs), the archive redesign, About/CV.
- Changing the 3D room's models or textures (real paintings, the six transfers, the real projection). The room only gets the new names, the year and its proposal labels.

## Anti-goals: a failure even if everything works

- A mockup shown as if it were the finished painting.
- Any text or interface element larger than the work. DECISIONS.md: nothing on the site is larger than the work.
- Invented facts. No materials, dimensions, dates or exhibitions beyond what Helen supplied.
- Broken links. `/project?work=thesis` is linked from the Selected Works strip, the archive and the gallery.
- Any change to how the other four project pages look or behave.
- A phone layout that's an afterthought.

## Decided

**By Helen (her brief):**
- Names: *Out of Context*; paintings *Gaping Net* (was Gaps in Netted Mesh), *Bent Mesh* (unchanged), *Stretched Out* (was Elongated).
- The body of work: three paintings, each with a full-body shot and close-ups; six image transfers; the installation; the projection, which is one large video plus many small viewer interpretations.
- Image-first. Click any image for a zoomable pop-out. Keep the site's general look.

**By wemby (accepted defaults, 2026-11-02):**
- The first screen is one big image: Gaping Net's full shot until installation photographs arrive, then an installation photograph.
- One long scroll with jump links that stay on screen. No tabs.
- The Source scans stay as the opening of the sequence.
- All viewer interpretations, as a dense grid under the projection video.
- Working title for the transfers: "Image transfers (set of six)".
- Year 2026. No "exhibited as Beyond the Humanized Machine" line.
- The page stays off the live site until Helen's three full-body shots and her new text are in. Other gaps may still show at launch.
- The 3D room gets the new title, names and 2026, and says inside the room that it shows the original proposal: its intro carries the line "The original proposal", and the captions of the two mockup paintings say "proposal mockup". Gaping Net, a real photo, keeps a plain caption. This page's link calls it the proposal too. (Chosen after the reviewer check, 2026-11-02.)
- Same URL: `/project?work=thesis`.
- In the viewer, a viewer interpretation can be compared with Gaping Net. This replaces today's "Compare with painting" checkbox.
- Phones first, one column.

## The page, top to bottom

1. **Header and nav,** as on every studio page. `StudioNav` already marks Selected Works as the current section on project pages.
2. **Opening:** the title *Out of Context* and one large image, Gaping Net's full shot. The image dominates the first screen at every width. The type line and summary follow.
3. **Jump links:** Source · Paintings · Image transfers · Projection · Installation. They stay on screen while scrolling. On phones they may scroll sideways.
4. **Source:** `thesis-source.webp`, with today's caption: "Three fragments of an advertisement. Partial handheld scans assembled together. The partial capture is the starting point for the work."
5. **Paintings,** one block each, in this order:
   - *Gaping Net:* full shot `thesis-painting.webp`, captioned "Acrylic on homasote" (the only per-painting material we have). Close-ups: a gap.
   - *Bent Mesh:* full shot: a gap. Close-up: the new photo `bent-mesh-detail-1`.
   - *Stretched Out:* full shot: a gap. Close-ups: the new photos `stretched-out-detail-1` and `-2`.

   In each block the full shot is large. Close-ups sit beside it on wide screens and below it on phones.
6. **Image transfers (set of six):** three group photos, shown large: the group of three, the pair, the single. Captions say only how they're grouped, for example "Three of the six".
7. **Projection:** a large video slot (a gap for now), then all eight viewer interpretations (`interpretation-1.webp` to `-8.webp`) as a dense grid of small images, captioned "Viewer drawings over Gaping Net".
8. **Installation:** a slot for the installation photographs (a gap for now). Then **The original proposal:** `thesis-installation.webp`, captioned as the arrangement proposed in the thesis materials, with a link "Walk through the proposal in 3D" to `/gallery`.
9. **About the work:** today's heading, context, details and "Read the process" text, with the process note's mockup sentences removed (see Copy).
10. **Continue exploring** and **All work,** as now.

## Zoom viewer

- Every image on the page opens it, including grid thumbnails, the source and the proposal render.
- Full-screen. Pinch, scroll or double-tap to zoom, and drag to move. A visible way to zoom in, zoom out and reset. Escape or Close exits.
- Swipe, on-screen arrows and arrow keys move through the images of the same section. The caption shows below the image.
- An interpretation can be compared, inside the viewer, with the Gaping Net photo it was drawn over (`thesis-painting.webp`): side by side where there's room, a switch on phones.
- Allow at least 3× zoom even though today's files are only about 2000 px. Higher-resolution files must drop in later without layout changes.
- Accessible: a native dialog, focus returns to the image that opened it, keyboard operable, 44 px touch targets, reduced motion respected. Use `studio-motion.js` as the existing project and archive dialogs do.
- Build it as its own module so the other project pages can adopt it later. Wiring them up is out of scope.

## Gaps

A gap is a quiet frame at the expected proportions, labeled with what's coming: "Full view: photograph to come", "Projection video to come", "Installation photographs to come". Never a mockup, never a broken-image icon. When the file arrives it replaces the gap with no layout change.

## Copy on this page

- *Out of Context* everywhere the project title appears: the heading, the browser title, and the "Continue exploring" link on Side Effects May Include.
- Process note: keep the first paragraph. Replace the second with: "The interpretation images are viewers' drawings over Gaping Net. The comparison makes their different readings visible."
- Everything else stays as it is until Helen's text arrives.

## Renames elsewhere

| Where | Change |
|---|---|
| `src/pages/work.astro` | Strip card and index title become Out of Context; the card image's alt text names Gaping Net. |
| `src/components/StudioPortal.astro` | Intro becomes "Out of Context", with the line "The original proposal · Helen Zhang, 2026". Works menu: Stretched Out, Gaping Net, Bent Mesh, as plain names, because the intro carries the label. The fallback image's alt text describes the proposal render. The fallback link "View the installation photographs" points to the Out of Context page with accurate wording. |
| `public/studio/gallery-door.js` | Door sign text becomes Out of Context. |
| `public/studio/gallery-scene.js` | Painting titles, shown as captions in the room: "Stretched Out (proposal mockup)", "Gaping Net", "Bent Mesh (proposal mockup)". |
| `src/pages/gallery.astro` | Meta description: the original proposal for Out of Context. |
| `public/studio/archive-data.js` | Gaps in Netted Mesh becomes Gaping Net (titles and captions); Elongated becomes Stretched Out; "Thesis project" becomes Out of Context; `archiveProjects.thesis.title` becomes Out of Context. The two mockup entries keep the type "Mockup", with honest captions such as "An early mockup of Bent Mesh from the thesis proposal; the finished painting differs." The three train scans stay untouched, because the homepage links into them. |
| `public/studio/project.js` | Thesis title, painting names, and Side Effects' "next" label. |

No test references the old names (checked).

## Assets

| File | Status |
|---|---|
| `public/artwork/thesis-painting.webp` | On the site. Gaping Net full shot, an older photo. When Helen's zip image 1 arrives, it comes in as a new file used only on this page, in the opening and the Gaping Net block. `thesis-painting.webp` stays everywhere else: the 3D room's texture (its crop is hand-tuned), the Selected Works card, the archive entry, and the viewer comparison, because the viewer drawings were made over this photo. *(Claude's call)* |
| `public/artwork/thesis-source.webp`, `interpretation-1.webp` to `-8.webp`, `thesis-installation.webp` | On the site. |
| `public/artwork/thesis-dark-grid.webp`, `thesis-elongated.webp` | Mockups. Removed from this page; they stay in the archive and the 3D room for now. |
| `incoming/out-of-context/bent-mesh-detail-1.jpg` | New, 1333×2000. Identified as Bent Mesh, the brown burlap painting; confirm with Helen. |
| `incoming/out-of-context/stretched-out-detail-1.jpg`, `-2.jpg` | New, 1333×2000. |
| `incoming/out-of-context/transfers-three.jpg`, `transfers-two.jpg`, `transfers-one.jpg` | New, 2000×1333. |

New files go into `public/artwork` as WebP, like the existing ones (`sharp` is already a dependency). `incoming/` is gitignored; nothing in it is published.

**Still missing,** in Helen's numbering: full-body shots of all three paintings (1, 5, 9), the Gaping Net close-ups (2–4), two more Bent Mesh close-ups (from 6–8), the installation photographs (15–16), the projection video, any further interpretations, and her new text. Four TIFFs and four decks shared in chat couldn't be opened and may contain some of these.

## Constraints

- Static Astro site with no UI framework. Libraries are vendored under `public/studio/vendor`. No third-party scripts at runtime. Fonts are self-hosted.
- `/project` is one static page shared by all five projects. `project.js` picks the project from `?work=` and renders it. The other four must keep working exactly as today.
- Keep the project page's look: its light palette, Geist type, spacing and motion language (`project.css`, `studio-motion.js`).
- Phone performance: the first screen shouldn't wait on images below it. Lazy-load the rest, use small thumbnails for the interpretation grid rather than the full files, and give images explicit dimensions so nothing jumps.
- `npm test` (121 tests) must keep passing. Add tests for new pure logic, such as zoom math and section navigation, in the style of `tests/*.test.mjs`.
- Local quirk: inside this worktree, `astro check`, `astro build` and `astro dev` fail with "Tsconfig not found astro/tsconfigs/strict". The worktree sits inside the main checkout, whose own `tsconfig.json` has no `node_modules` beside it. The same code passes from a copy outside the checkout. Verify from such a copy, or run `npm ci` once in the main checkout after asking wemby. Cloudflare deploys are unaffected.

## Shipping

- The nav change ships first, as its own PR from `claude/website-selected-works-nav-3ea29f`.
- This work goes on its own branch as a draft PR. Merge only when Helen's three full-body shots and her new text are in.
- When installation photographs arrive, the opening image switches to one of them.

## Left to the builder

- How the thesis layout is built: static markup in `project.astro` shown for `work=thesis`, a branch in `project.js`, or a separate component. The URL and the other four pages must not change. Static markup would also make the main project readable without JavaScript.
- Exact composition, sizes and spacing within the existing look, including the opening.
- The viewer's implementation (hand-rolled or vendored), its maximum zoom and gesture details.
- File names, WebP settings and thumbnail sizes.
- Jump-link details, such as highlighting the current section.
- Gap styling, and whether captions sit under images, in the viewer, or both.

## Calls Claude made (please check)

- Identified the new frayed brown close-up as Bent Mesh, because Helen called Bent Mesh "the only brown painting". Confirm with Helen.
- Captions carry only facts we have: "Acrylic on homasote" for Gaping Net, and grouping for the transfers. No other materials or sizes until Helen's text arrives.
- Rewrote the second paragraph of the process note so it no longer calls the paintings mockups. The exact text is under Copy.
- The archive keeps the two mockup images under their new names, labeled honestly as early mockups, until the archive slice replaces its content.
- Helen's new Gaping Net photo will be used on this page only. The current photo stays in the room, on the card, in the archive and under the drawing comparison.
- The 3D room's Works menu keeps plain names. "The original proposal" lives in its intro, and "proposal mockup" in the two mockup captions.
- Gap labels, the zoom viewer's minimum of 3×, and building the viewer as a separate module for later reuse.
