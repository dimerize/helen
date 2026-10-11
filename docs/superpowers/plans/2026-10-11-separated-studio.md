# Separate studio spaces — local integration

User-authorized integration, no commit, push, PR, or deployment.

- Preserve the original scanner geometry and all three walkable scans.
- Reuse the approved graphite optics and carrier, with scan illumination mapped to the actual lens position.
- Mount Archive in the existing home document; preserve standalone routes, history, inspection and dragging.
- Travel through black space with one continuous camera clock and exact scene endpoints. Preload destination resources before movement. Never show adjacent destinations at rest. Preserve the gallery's physical door entrance/exit.
- Space archive surfaces using full rotated bounds; add restrained hanging hardware.
- Verify trajectory endpoints, clear spacing, existing suite, Astro build/check/links, and desktop/mobile browser journeys. Leave all changes uncommitted and show local site.

## Verification

- 112 tests pass; Astro check reports no errors or warnings.
- Production build succeeds; 104 internal links resolve; git diff whitespace check passes.
- Browser checks: desktop and phone viewport; separated route travel, gallery threshold/exit, carrier handoff after a page refresh, archive inspection, and archive-to-notice walking view.
- Observed journey frame-time 95th percentile: 17–18 ms on the local browser (not a physical-phone benchmark).
- Original scanner model file is unchanged. All changes remain uncommitted.
- Built local preview: http://127.0.0.1:8784/

## Spatial archive restoration — latest revision

The earlier flat hanging-card arrangement is superseded by a persistent physical
room. All 15 works have authored world coordinates: five wall hangings, three
bench pieces, five loose floor pieces, and two works leaning against the wall.
Two restrained wall lights, suspension wires, a low workbench and shallow flat
files restore the mock's architectural context inside the black exterior.

Desktop and mobile use the identical geometry and bearing; only camera distance
fits the viewport. Dragging moves the actual meshes on their supporting planes;
bench clamps include rotated frame extents. Empty-space dragging pans the room;
pinch, wheel and small optical controls adjust distance. Keyboard inspection,
Alt+arrow movement, the index, related works and scan handoff remain available.
Index-only travel uses calibrated image planes; the Room never becomes a flat
snapshot during navigation.

Travel spacing is reduced from five to 2.05 viewport widths, with a 3.1-second
Home/Archive trip. The same scene and camera serve the last travel frame and the
settled room. Resizes update framing without forcing the animation to completion.
Gallery return no longer resets the incoming Home camera. An additive, muted floor
socket finishes the unchanged original cable, outside the original hardware model.
Lifted cards clear before a destination is prepared, including the gallery echo;
the archive handoff record is captured first.

Latest verification:
- 117 tests pass, including all original-scanner invariants and new support,
  viewport parity, floor-outlet connection and spacing checks.
- Astro check: zero errors and warnings. Build passes; all 104 internal links resolve.
- Browser checks: actual wall drag and raycast inspection, optical zoom, keyboard
  movement, desktop/mobile layout parity, index navigation, project link and browser
  Back restoration, gallery entry/exit, zero lifted cards after returning Home, and successful lifted-scan handoff.
- Gallery return frame-time 95th percentile: 18 ms in the local browser.
- Review fixes include BFCache preservation and rejecting unknown scan selections.
- Original scanner model remains unchanged. No commit, push, PR or deployment.
