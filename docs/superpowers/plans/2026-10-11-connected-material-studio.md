# Connected material studio implementation plan

> **For agentic workers:** Use the existing parallel task assignments; root integrates and verifies before pushing main.

**Goal:** Publish the approved scanner world with a tactile archive and coherent gallery travel.
**Architecture:** Integrate the approved scanner controller and invariant factory into the Astro homepage; share its existing capture event with the gallery. Independent archive, gallery and spatial navigation modules retain native static routes and progressively enhance them.
**Tech Stack:** Astro, native ES modules, Three r180, Motion, GSAP, Cloudflare static assets.
**Spec:** `docs/superpowers/specs/2026-10-11-connected-material-studio.md`

## Global constraints
- Preserve original scanner hardware and all three source scans; no numeric scan count.
- Preserve artwork, original portfolio content and gallery computer functionality.
- No forced tour; responsive input, keyboard access and reduced motion throughout.
- Use existing origin/main and Cloudflare deploy; preserve unrelated work.

## Review focus
- Gallery capture must continue the same scanner animation while the main canvas is suspended.
- A lifted image's archive/world destination must remain correct after the scanner rotates.
- Opening/closing/reopening and browser Back must not leave inert content or stale animation callbacks.
- Mobile scrolling must coexist with archive dragging and bug movement.
- Failure to load WebGL must leave real images, navigation and project links usable.

## Tasks
- [x] Scanner integration (root): copy verified world/factory/controller and meaningful geometry/navigation tests into `public/studio/scan-world/`; adapt homepage and scoped styles. Test original hardware identity first. Remove timer stalls/count; add arrows, paper magnifier, exact archive destinations and deep-link entry. Maintain `studio:scanner-capture` and `studio:gallery` behavior.
- [x] Archive (archive_worktable): own archive page, JS/CSS, pure arrangement helpers/tests. Implement freely movable pieces, project gathering/fanning, inspection and exact scan deep links. Verify dragging and history state with focused tests and browser checks.
- [x] Gallery (gallery_materials_travel): own scene materials, gallery travel and portal modules/tests. View reference photograph, refine active scene, choreograph page/door approach and exit. Preserve geometry-safe paths, capture and computer.
- [x] Navigation (concept_review): new spatial-navigation JS/CSS/helpers/tests. Classify internal routes and preserve native modifiers; animate actual page surfaces, respecting gallery interception and reduced motion. Root loads modules on pages.
- [x] Integration: run `npm run verify`, browser-check desktop and phone home→bug→return, each scan, lifted print→archive, archive arrangements/inspection, gallery entry/computer/lookback/exit, browser Back and reduced motion. Fix evidenced failures.
- [ ] Delivery: commit tested files, fast-forward-safe push to origin/main, verify Cloudflare build/deployment and production routes. Record release and final commit.

## Verification record

- Final automated pass: 94 tests; Astro check 0 errors/warnings/hints; production build of six pages; all 84 internal links resolve.
- Browser checked at 1280×720 and 390×844: all three scan worlds, lifted print magnifier, exact archive destination, archive project gathering and free dragging, inspection loupe, archive-to-world entry, mobile map travel and reduced-motion return.
- Gallery checked for photo-informed architecture, original live scanner look-back, computer approach and interactive apps, physical exit, and mobile entry from below the fold.
- Independent review fixes include fallback navigation, homepage touch scrolling, stable-height lens projection, modal Back/Forward reversal, related-image keyboard focus, and separate canonical/viewport gallery captures.
