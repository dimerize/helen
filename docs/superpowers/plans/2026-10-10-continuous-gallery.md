# Continuous gallery implementation plan

**Goal:** Implement the user-approved Step Through Studio mock exactly, with the actual mirrored scanner homepage visible through the open door when looking back.

**Spec:** The approved fragment at `/Users/wemby/.codex/visualizations/2026/10/10/01a12733-80fa-74b0-a7c3-633df4aeba92/step-through-studio.html` and the user's approval of October 10. Unhurried timing, graphite door. Homepage remains the primary page.

**Architecture:** One Three.js scene contains door, threshold, gallery, and the homepage screen outside. GSAP sequences the handle, hinged leaf, and camera; Camera Controls takes over only at arrival. A native dialog mounts the experience in the existing homepage. html2canvas records the real homepage while a scanner capture hook supplies live frames.

## Constraints

- Never open the door on page load, hover, focus, or room-ready events.
- Preserve the mock's geometry, lighting, typography, timing and restrained UI.
- Inside, only Exit and the optional menu remain permanently visible.
- Keep scanner DOM, loose scans, paused preference, scroll position and keyboard return focus.
- Self-host pinned dependencies. Support touch, keyboard, reduced motion and WebGL fallback.

## Tasks

- [x] Port approved scene and GSAP camera/door timeline. Test no movement before play, threshold crossing, arrival and return.
- [x] Capture actual homepage plus live scanner; map its backside beyond the doorway.
- [x] Replace iframe/fade entrance with direct dialog integration, retain deep links/history, and make /gallery route to the same experience. Test cancellation and history restoration.
- [x] Browser-check desktop and phone entry, look-back, artwork approach, exit, repeated entry and errors. Run npm run verify, independent review, prepare for commit/push and deployment verification.

## Review focus

- Loading/cancellation races; late asynchronous work after close.
- Camera ownership at timeline-to-controls handoff, and rotation across ±PI.
- Mirrored homepage orientation, legible text, and live scanner fidelity.
- GPU/canvas disposal, reduced motion and visibility suspension.
- Mobile uncluttered UI, dialog focus, Back/Forward and exact homepage restoration.

## Progress

- Baseline: clean dedicated release checkout on feature branch at 6f60575. Approved prototype is the visual authority; no redesign required.

- Verification: 31 tests pass; Astro check has 0 errors, warnings or hints; static build succeeds; all 124 internal links resolve.
- Browser verification: closed door on explicit Gallery navigation and deep link; continuous entry; mirrored moving homepage on desktop and phone; artwork/navigation menu; Exit returns to scanner; lifted scans and original focus survive; no runtime errors observed.
- Independent review completed. Fixed fallback return-link contrast and contextual caption cleanup.
- User refinement: lookback exterior is uniformly homepage black; removed exterior floor/horizon while inside; enlarged portrait homepage to nearly fill the view. Approved outside door/entry materials retained.
- Responsive adjustment: narrow portrait uses a wider lens to keep the entire closed door visible. Desktop retains the mock’s lens and entry/exit timing.
