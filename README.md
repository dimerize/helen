# Helen Zhang portfolio

Helen’s portfolio combines an autonomous 3D scanner, a moving selected-work strip, a tactile archive worktable, a walkable gallery, and project pages with media-specific controls. About, CV, and Contact retain the existing content and reading layouts.

Built as static Astro pages. Three.js 0.180.0, Camera Controls 3.1.2, and Motion 14.1.0 are served locally under `public/studio/vendor` with their licenses. Camera Controls owns the gallery camera; Motion provides restrained spring transitions. The work strip and archive use ordinary DOM elements and CSS transforms.

## Develop and verify

```sh
npm ci
npm run dev
npm run verify
```

`verify` runs navigation tests, checks Astro and TypeScript, builds `dist`, and checks internal links. `npm run preview` serves the production build locally.

## Structure

- `src/pages/index.astro`: scanner homepage.
- `src/pages/work.astro`: selected projects, moving strip and stationary index.
- `src/pages/archive.astro`: freely draggable image surfaces, project gathering, index, and a magnifying detail viewer.
- `src/pages/project.astro`: shared project structure. `public/studio/project.js` supplies each project's content and media.
- `src/pages/gallery.astro`: canonical redirect into the persistent gallery overlay. `gallery-scene.js` builds the installation and original scanner echo; `gallery-room.js` builds photo-informed plaster, concrete, skirting and ceiling structure; `gallery.js` provides navigation and accessible controls.
- `public/studio/scan-world/`: continuous camera travel from the original scanner into three source-derived relief worlds. `original-scanner.js` preserves the original hardware geometry; tests compare it with a production fixture. The depth is an artistic interpretation, not a measured reconstruction.
- `public/studio/spatial-navigation.js`: short perspective transitions for actual page surfaces, with native links, history and reduced-motion fallbacks.
- `public/studio/doorway.js`: lazy gallery overlay and browser history. The scanner page stays mounted beneath the room. Close restores its scroll position, lifted scans and focus.
- `public/studio/gallery-controls.js`: first-person Camera Controls adapter, damped movement, bounded eye height, and short-arc viewpoint changes.
- `public/studio/studio-motion.js`: reduced-motion-aware, cancellable reveal and native-dialog springs.
- `public/studio`: page styles and interactions, with shared navigation styles.
- `public/artwork`: optimized WebP derivatives of Helen's artwork and documentation.
- `src/content/site/about.md`, `src/data/cv.ts`, `src/data/site.ts`: existing biography, CV, contact details and navigation.

The scanner runs without input. Visitors may lift a scan into a movable print, follow its exact archive link, or use its magnifier to step into that scan. All three original images have walkable, source-derived typography and named viewpoints. Arrow buttons choose scans without a numeric counter. The scanner resumes immediately after a visit. Reduced motion uses a static scanner. WebGL failure retains a still image. The Work and Archive indexes provide a stationary route through the content. The archive’s Gather by project arrangement makes relationships visible, while Spread out keeps every image independently movable. On phones, hold an image or enable Move images; ordinary swipes continue to scroll. Interactive archive and project views require JavaScript.

Project URLs use `/project?work=thesis`, `standing`, `8ppi`, `jack`, and `side-effects`. Some film documentation is forthcoming and is labeled accordingly. Artwork captions distinguish photographed work from source installation mockups.

The Gallery tab and hinged door open the room over the scanner at `/?room=gallery`. `/gallery` also works independently. The gallery uses the supplied installation view as a reference; dimensions and lighting are interpreted. Drag to look, scroll or use WASD/arrow keys to walk, click a painting to approach it, or use named view buttons. Touch users have a direction pad. Viewer drawings can be projected on the central painting, switched, or turned off. This effect is a digital reinterpretation of supplied drawings, not footage. The original installation image is the WebGL fallback. Reduced motion makes guided movement and projection changes immediate. The full-rate scanner render pauses while the room is open; the gallery’s backward view advances and captures the same native scanner. Rendering pauses in hidden tabs. Entry moves the homepage aside and approaches the doorway; exit retreats, closes the door, and returns the homepage to its original place.

Studio pages load the existing self-hosted Geist font and use local SVG icons to avoid mobile font/emoji substitutions. `npm run vendor:studio` rebuilds the motion bundle and copies the camera library from pinned npm dependencies; the production build runs it automatically. It does not load third-party scripts at runtime.

## Publish

The existing Cloudflare Worker builds and deploys `main` automatically. `wrangler.jsonc` serves `dist` as static assets at https://helenzhang.studio. Run `npm run verify` before pushing, then verify the custom domain after the Cloudflare build completes. See `DEPLOY.md` for the original hosting setup.

The original scanner hardware is an invariant. Extend camera travel and source-surface relief without replacing its platen, frame, scan wand or native presentation. Exact scanner archive links use `/archive?scan=train-scan`, `train-scan-wide`, and `train-scan-notice`; appending the same scan ID and `explore=1` on `/` opens its walkable surface.

Artwork remains © Helen Zhang. Vendored library and font licenses are included beside their files.
