# Helen Zhang — portfolio

A site for Helen Zhang, artist (Parsons BFA Fine Arts, minor Creative Coding), working across installation, moving image and creative technology.

Built with [Astro](https://astro.build) as a fully static site. No client-side framework, no UI library, no animation library, no Three.js. Every page works without any JavaScript at all.

**Why it is built this way → [DECISIONS.md](DECISIONS.md). How to put it live → [DEPLOY.md](DEPLOY.md).**

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run check` | TypeScript and Astro diagnostics |
| `npm run links` | Verify every internal link resolves |
| `npm run verify` | `check` + `build` + `links` — run before pushing |
| `npm run og` | Regenerate the social preview image and icons |

Node 20.3+ is required. `.nvmrc` pins 22, which is what the deployment uses.

---

## Project structure

```
src/
├─ content/site/about.md     The About text
├─ content.config.ts         Schema for the prose pages
├─ data/
│  ├─ site.ts                Name, email, Instagram, navigation
│  └─ cv.ts                  CV entries
├─ styles/
│  ├─ tokens.css             Every colour, size, duration — single source of truth
│  ├─ fonts.css              @font-face
│  └─ base.css               Reset, typography, focus, reduced motion
├─ components/               Field, EdgeNav, Meta
├─ layouts/Base.astro        Page shell
├─ lib/
│  ├─ field/                 The WebGL light field (shader + loader)
│  ├─ clock.ts               Local time on the contact card
│  └─ motion.ts              Preference and capability checks
└─ pages/                    / · /about · /cv · /contact · 404

public/textures/             The scans the light reveals
public/fonts/                Self-hosted Geist variable fonts (OFL)
```

**Routes:** `/` `/about` `/cv` `/contact` and a 404 page.

---

## The entry

The homepage is a picture in a dark room. Three things light it:

- **A scan bar** travelling down and back up the full width, on a slow eased triangle wave.
- **A drifting lamp**, so something is always surfacing somewhere.
- **The pointer**, which writes into a decaying trace buffer — wherever a hand has passed opens up almost completely, then sinks back.

The picture is never displayed; you see only as much as has been lit. Every other page carries a still version of the same idea: the scan behind a mask shaped like the lamp's falloff, which is also the no-JS and no-WebGL state.

To change which image a page uses, pass a different `texture` to `<Base>`. Files live in `public/textures/`.

---

## Changing the design

Everything visual is a token in [`src/styles/tokens.css`](src/styles/tokens.css). Nothing else hardcodes a colour or a duration.

**To change the typefaces:** drop new `.woff2` files into `public/fonts/`, update the `@font-face` blocks in `src/styles/fonts.css`, and change `--font-sans` / `--font-mono` in `tokens.css`. Update the two `<link rel="preload">` tags in `src/layouts/Base.astro` to match.

**The accent colour** (`--signal`) appears in exactly two places sitewide: the current item in the navigation, and the focus ring. Please keep it that way — its whole job is to be rare.

---

## Editing content

| To change… | Edit this file |
| --- | --- |
| The About text | `src/content/site/about.md` |
| Email, Instagram, her name | `src/data/site.ts` |
| The CV | `src/data/cv.ts` |
| Colours, type sizes, timings | `src/styles/tokens.css` |

Then `npm run verify`, commit, and push. Cloudflare rebuilds and deploys in about a minute — **pushing to GitHub is the deploy**.

---

## Two things to confirm with Helen

**The About text.** Adapted from her LinkedIn, which still described her as a junior. Since she graduated in May 2026 that was changed to graduate wording; her own sentences are otherwise kept as written.

**The CV.** Every entry in `src/data/cv.ts` is transcribed from the LinkedIn profile. Nothing was added or invented, and nothing on this site claims an exhibition, award, commission or collaboration that was not in the material provided.

---

## Licence

Site code: free for Helen to use and modify.
Fonts: Geist and Geist Mono under the SIL Open Font License 1.1 (`public/fonts/LICENSE.txt`).
Artwork remains © Helen Zhang.
