# Helen Zhang portfolio

Helen’s portfolio combines an autonomous 3D scanner, a moving selected-work strip, a spatial archive, and project pages with media-specific controls. About, CV, and Contact retain the existing content and reading layouts.

Built as static Astro pages. Three.js 0.180.0 is vendored under `public/studio/vendor` with its MIT license. The work strip and archive use ordinary DOM elements, CSS transforms, and small JavaScript modules.

## Develop and verify

```sh
npm ci
npm run dev
npm run verify
```

`verify` checks Astro and TypeScript, builds `dist`, and checks internal links. `npm run preview` serves the production build locally.

## Structure

- `src/pages/index.astro`: scanner homepage.
- `src/pages/work.astro`: selected projects, moving strip and stationary index.
- `src/pages/archive.astro`: draggable image surfaces, index, detail viewer.
- `src/pages/project.astro`: shared project structure. `public/studio/project.js` supplies each project's content and media.
- `public/studio`: page styles and interactions, with shared navigation styles.
- `public/artwork`: optimized WebP derivatives of Helen's artwork and documentation.
- `src/content/site/about.md`, `src/data/cv.ts`, `src/data/site.ts`: existing biography, CV, contact details and navigation.

The scanner runs without input. Visitors may lift a scan into a movable image, pause motion, or go directly to Work and Archive. Reduced motion uses a static scanner. WebGL failure retains a still image. The Work and Archive indexes provide a stationary route through the content. Interactive archive and project views require JavaScript.

Project URLs use `/project?work=thesis`, `standing`, `8ppi`, `jack`, and `side-effects`. Some film documentation is forthcoming and is labeled accordingly. Artwork captions distinguish photographed work from source installation mockups.

## Publish

The existing Cloudflare Worker builds and deploys `main` automatically. `wrangler.jsonc` serves `dist` as static assets at https://helenzhang.studio. Run `npm run verify` before pushing, then verify the custom domain after the Cloudflare build completes. See `DEPLOY.md` for the original hosting setup.

The approved scanner-room design was integrated as a separate release before gallery development. Git history can restore that release independently.

Artwork remains © Helen Zhang. Vendored library and font licenses are included beside their files.
