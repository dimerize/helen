# Gallery Computer Implementation Plan

**Goal:** Implement the approved cream CRT, Instagram/Mail screen, and simplified site navigation.

**Spec:** User-approved interactive mock at `/Users/wemby/Documents/ChatGPT/nbarecap/output/helen-computer-review/computer-review.html`; latest user explicitly approves implementation and removing CV, About, Contact and redundant homepage door.

**Architecture:** Keep the scanner homepage and native gallery dialog. Add the approved original computer model to the existing room at [1.40,0,3.02], facing inward, scale .9. Use existing GSAP for camera approach and Camera Controls for room navigation. Render a preview of the real public Instagram profile on the CRT; overlay accessible HTML at screen focus, with real external profile/photo links and mailto. No live Instagram iframe or account automation.

**Constraints:** Preserve closed-until-click door, continuous entrance/exit, black mirrored live homepage, fonts, minimal controls, reduced motion, phone framing, and disposal/history behavior. Work in existing dedicated release checkout on codex/gallery-computer. Deployment authorization persists from prior work and current implementation approval.

## Tasks

- [x] Navigation: Home/Archive/Gallery in all public navigation; remove homepage door feature and About/CV/Contact pages, redirect old routes, keep project content reachable through Archive. Retain selected-work route as legacy content but remove it from primary navigation. Verify generated links/routes.
- [x] Model/screen: Port approved original CRT unchanged; self-host rounded geometry dependency and small approved public Instagram previews; new StudioComputer component and screen texture module. UI exposes Instagram and email from canonical site values. Graceful direct contact links on WebGL failure.
- [x] Interaction: Add computer click target and menu shortcut. Two deliberate stages (approach desk, use screen); animate camera/FOV with GSAP, disable room controls while focused. Step away/Escape returns to room; exit/history cancels motion and disposes overlay/resources. Tests verify camera framing and continuous transitions.
- [ ] Review and release: fresh independent code review, full npm verify, desktop/mobile browser entry/computer/Instagram/Mail/back/exit/reopen checks, production build and link audit. Commit/push, verify Cloudflare deployment and live functionality.

## Review focus

- Closing or navigating back mid-approach must not revive an old screen.
- Mobile resize/orientation must keep the glass/UI aligned and controls usable.
- Keyboard and Escape must move focus back to the room and preserve dialog semantics.
- Public image failure must leave profile/email links available.
- Removed routes and links must not strand visitors or expose retired pages in the sitemap.

## Progress

- Approved design reused; no new design approval required. Existing dedicated release checkout is clean and isolated from other work.

- Approved model and public Instagram previews integrated; all primary navigation is Home/Archive/Gallery and old routes redirect.
- Independent review caught resize state reset and undersized landscape controls; both fixed. Browser testing also caught Escape losing context during approach; fixed focus plus native cancel delegation, with regression coverage.
- Desktop and 390×844 / 844×390 checks verified screen alignment, Mail persistence, readable controls, actual computer raycast, Escape, and browser Back. No browser errors or warnings. Mobile Mail shows its primary action without scrolling.
- Final pre-release `npm run verify`: 40 tests passed; Astro check reports zero diagnostics; production build succeeds; all 75 internal links resolve. `git diff --check` clean.
