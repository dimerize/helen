# Studio motion and mobile repair plan

**Goal:** Preserve the approved scanner homepage, make the gallery an optional room entered through a door, and repair cross-device typography, icons and motion.

**Architecture:** Keep Astro static pages and the existing Three.js room. Camera Controls owns camera movement; Motion handles deliberate user-triggered springs. A lazy, same-origin gallery frame opens over the homepage and closes back to its preserved scanner and scroll position. `/gallery` remains a direct route.

**Design:** The scanner retains its black background and colorful source images. A charcoal hinged door, a thin warm light seam and the existing gallery image form the entry. Geist, already self-hosted by the original site, becomes consistent across studio pages. Stroke SVG icons replace platform-dependent symbols. Motion settles gently; reduced motion is immediate.

## Audit findings

- Studio pages hardcode system Helvetica/Arial and omit the bundled font.
- Unicode arrow glyphs can render as emoji on mobile.
- Free movement writes camera position/angles directly; scrolling and dragging have no damping.
- Guided travel restarts hand-written easing when retargeted.
- Gallery navigation performs a full page change, losing the sense of stepping out of the scanner page.
- Mobile gallery overlays occupy too much of the artwork viewport; controls need compact grouping and safe-area spacing.
- Dialogs and loose scans enter and leave abruptly or use unrelated CSS timings.

## Tasks

1. Unify self-hosted type and SVG icons; keep existing layouts. Check font loads, icon rendering, 320/390px navigation and control sizes.
2. Pin and vendor Camera Controls and Motion with reproducible build steps and licenses. Replace custom camera interpolation and use damped, bounded, eye-level movement. Test diagonal speed, walls, interruption, wheel bursts and reduced motion with real controls.
3. Add a literal hinged door and Gallery navigation entry. Open a lazy same-origin frame in an accessible modal, pause the background scanner, handle Escape/back/close and restore focus/scroll. Retain normal links if JavaScript is unavailable.
4. Add restrained spring feedback to lifted scans and detail dialogs; compact mobile gallery controls. No gratuitous looping animations.
5. Review full diff, run tests/build/link checks, inspect desktop and mobile, then push and verify Cloudflare and the public scanner and gallery.

## Review focus

- Gallery close/back during loading or movement must leave the homepage usable.
- New motion must stop for reduced motion and hidden/closed content.
- Only same-origin messages from the gallery frame may close or mark it ready.
- Rapid viewpoint changes and input while traveling must remain bounded and smooth.
- Touch controls, browser zoom and keyboard focus must remain accessible.
