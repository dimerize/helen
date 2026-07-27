# Helen Zhang — portfolio

A portfolio site for Helen Zhang, artist (Parsons BFA Fine Arts, minor Creative Coding), working across installation, moving image and creative technology.

Built with [Astro](https://astro.build) as a fully static site. No client-side framework, no UI library, no animation library, no Three.js. Every page works without any JavaScript at all.

Measured on the current build:

| | gzipped |
| --- | --- |
| HTML (entry page) | 2.0 kB |
| CSS (whole site) | 2.4 kB |
| JavaScript (**all** pages combined) | 3.4 kB |
| Fonts (two variable faces, latin subset) | 52.5 kB |
| **Entry page total** | **≈ 60 kB** |

The fonts are the largest thing on the site by an order of magnitude, which is the correct shape for a portfolio.

- **Adding or editing a work → [CONTENT.md](CONTENT.md)** (written for non-developers)
- **Why it is built this way → [DECISIONS.md](DECISIONS.md)**

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
| `npm run placeholders` | Regenerate placeholder plates for unfinished works |
| `npm run og` | Regenerate the social preview image and icons |

Node 20.3+ is required. `.nvmrc` pins 22, which is what the deployment uses.

> **If images look stale in `npm run dev`** after regenerating placeholders, the dev server caches image transforms. Run `rm -rf node_modules/.astro` and restart. Production builds are never affected.

---

## Project structure

```
src/
├─ content/
│  ├─ works/<slug>/          One folder per work: index.md + its images
│  └─ site/about.md          The About text
├─ content.config.ts         Content schema — the rules a work must satisfy
├─ data/
│  ├─ site.ts                Name, email, Instagram, navigation
│  └─ cv.ts                  CV entries
├─ styles/
│  ├─ tokens.css             Every colour, size, duration — single source of truth
│  ├─ fonts.css              @font-face
│  └─ base.css               Reset, typography, focus, reduced motion
├─ components/               Field, PlacementRect, WallLabel, Media, EdgeNav, Meta
├─ layouts/Base.astro        Page shell
├─ lib/
│  ├─ field/                 The WebGL light field (shader + loader)
│  ├─ resolve.ts             Works coming into focus and decaying
│  ├─ keynav.ts              Arrow keys between works
│  └─ motion.ts              Preference and capability checks
└─ pages/                    / · /works · /works/[slug] · /about · /cv · /contact · 404

public/fonts/                Self-hosted Geist variable fonts (OFL)
scripts/                     Placeholder, OG image and link-check generators
```

**Routes:** `/` `/works` `/works/<slug>` `/about` `/cv` `/contact` and a 404 page.

---

## Changing the design

Everything visual is a token in [`src/styles/tokens.css`](src/styles/tokens.css). Nothing else hardcodes a colour or a duration, so a change there applies everywhere.

**To change the typefaces:** drop new `.woff2` files into `public/fonts/`, update the `@font-face` blocks in `src/styles/fonts.css`, and change `--font-sans` / `--font-mono` in `tokens.css`. Update the two `<link rel="preload">` tags in `src/layouts/Base.astro` to match. Nothing else refers to a font by name.

**The accent colour** (`--signal`) appears in exactly three places sitewide: the registration marks at the moment a work resolves, the current item in the navigation, and the focus ring. Please keep it that way — its whole job is to be rare.

---

## Video

Video is not processed by the build. Put encoded files in `public/media/<slug>/` and reference them with an absolute path (see [CONTENT.md](CONTENT.md)).

Encode before committing. Aim for **under 15 MB per file**:

```bash
# 1080p H.264 — plays everywhere
ffmpeg -i source.mov -vf "scale=-2:1080" -c:v libx264 -profile:v high \
  -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart -an out.mp4

# Poster frame at 3 seconds
ffmpeg -i source.mov -ss 3 -frames:v 1 -q:v 2 poster.jpg
```

`-movflags +faststart` matters: without it the video will not begin playing until the whole file has downloaded. Drop `-an` if the work has sound.

If the repository grows past roughly 150 MB of media, move video to Cloudflare R2 or Stream rather than committing it — see *Recurring costs* below.

---

# Deployment

**Host: Cloudflare Pages. Registrar: Cloudflare. Total recurring cost: the domain, about $10–12 a year. Everything else is free.**

### 1. Why this host

Cloudflare Pages' free tier has **unlimited bandwidth** and 500 builds a month. That matters here: an art portfolio with video documentation is exactly the kind of site that can blow through a bandwidth cap, and the two obvious alternatives both cap at 100 GB/month. Vercel's free tier additionally restricts use to non-commercial projects, which is an awkward fit for a portfolio whose purpose is getting hired.

Pages also gives free HTTPS, per-branch preview deployments, and one-click rollback to any previous build.

### 2. Source repository

Yes — GitHub, at `dimerize/helen`. Connect it through the Cloudflare Pages **Git integration** in the dashboard rather than a GitHub Action. The integration needs no API token stored in the repository, so **this project has no secrets at all**.

### 3. Environment variables and secrets

None. Set `NODE_VERSION` to `22` in the Pages build settings — that is a build setting, not a secret.

### 4. Build settings

| Setting | Value |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` (env var `NODE_VERSION`) |

Push to `main` → production deploy. Any other branch or pull request → its own preview URL.

### 5. Domain

`helenzhang.com` is likely taken. Realistic alternatives to check: `helenzhang.studio`, `helen-zhang.com`, `hzhang.studio`, `helenzhang.art`.

1. Cloudflare dashboard → **Domain Registration → Register Domain**, search, buy. Cloudflare sells at wholesale with no markup and includes WHOIS privacy — about $10–12/year for `.com`, $20–30 for `.studio` or `.art`.
2. Pages project → **Custom domains → Set up a domain** → enter it.
3. Because the domain is registered at Cloudflare, DNS is created automatically. Nothing to copy or paste.
4. Update `SITE` in [`astro.config.mjs`](astro.config.mjs) to the real domain and redeploy, so canonical URLs and the sitemap are correct.

The site goes live on a free `*.pages.dev` subdomain the moment it is connected, so it can be shared and reviewed before any money is spent.

### 6. HTTPS

Automatic. Cloudflare issues and renews a Universal SSL certificate. After the domain is attached, enable **SSL/TLS → Edge Certificates → Always Use HTTPS**, and turn on HSTS once you are confident the site is working.

### 7. Updating content later

1. Edit or add a work under `src/content/works/` (see [CONTENT.md](CONTENT.md)).
2. `npm run verify` to confirm it builds and nothing broke.
3. Commit and push to `main`.
4. Cloudflare rebuilds and deploys in about a minute.

The schema will refuse to build if a work is marked `installed` without a medium, description, year or image, or if any image is missing alt text. That is deliberate — it catches the mistakes that are otherwise only noticed once they are public.

### 8. When a deployment fails

- Cloudflare emails on a failed build; nothing is published, so the live site is untouched.
- Running `npm run verify` locally first catches essentially all of it.
- If a bad deploy does go out: Pages → **Deployments** → find the last good one → **Rollback to this deployment**. It is instant and needs no rebuild.
- Then fix forward on a branch, check the preview URL, and merge.

### 9. Recurring costs

| Item | Cost |
| --- | --- |
| Cloudflare Pages hosting | $0 |
| HTTPS certificate | $0 |
| Preview deploys, rollbacks | $0 |
| Cloudflare Web Analytics | $0 |
| **Domain** | **~$10–12/year** |

If media outgrows the repository: Cloudflare R2 is about $0.015/GB/month with no egress fees (pennies at this scale), and Cloudflare Stream is $5/month per 1,000 minutes stored if video ever becomes central.

### 10. Analytics

Not installed. If wanted, Cloudflare **Web Analytics** is free, cookieless, and needs no consent banner — enable it in the dashboard and paste the one script tag into `src/layouts/Base.astro`.

---

## Launch checklist

- [ ] Replace placeholder works with real documentation, or reduce the number of reserved placements
- [ ] Confirm the About text with Helen — it is adapted from her LinkedIn, which still described her as a junior (see [CONTENT.md](CONTENT.md))
- [ ] Confirm the contact email and Instagram handle in `src/data/site.ts`
- [ ] `npm run verify` passes
- [ ] Buy the domain and connect it in Pages
- [ ] Update `SITE` in `astro.config.mjs`, redeploy
- [ ] Enable **Always Use HTTPS**
- [ ] Load the site on a real iPhone and a real Android phone, on cellular
- [ ] Check the site with reduced motion enabled (macOS: System Settings → Accessibility → Display → Reduce motion)
- [ ] Tab through every page and confirm the focus ring is always visible
- [ ] Share a link into Slack, iMessage or Instagram DM and confirm the preview image renders
- [ ] Run Lighthouse on mobile
- [ ] Confirm `/sitemap-index.xml` and `/404` both respond
- [ ] Optional: enable Cloudflare Web Analytics

---

## Licence

Site code: free for Helen to use and modify.
Fonts: Geist and Geist Mono under the SIL Open Font License 1.1 (`public/fonts/LICENSE.txt`).
Artwork and its documentation remain © Helen Zhang.
