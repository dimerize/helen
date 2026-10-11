# Gallery finishing details

The user's latest instruction authorizes finishing, committing and pushing the previously approved studio integration and these details. Earlier local-only instructions are superseded.

Keep the original scanner geometry intact. Preserve the approved magnifier materials, three automatic scans, restrained UI and black space between scenes.

1. Build reusable physical-detail primitives with deterministic fine surface grain, rounded edges, actual slotted screws and small cable clips.
2. Replace the gallery door factory with the same leaf dimensions and pivot, adding painted texture, fitted hinges, latch, seal and understated kick plate. Replace its label with a layered satin nameplate and shallow extrusions of the official Parsons/New School SVG, sourced from the Parsons website.
3. Add restrained conduit, collars, junction cover and repaired pin holes to the existing gallery architecture. Retain the room's dimensions, neutral artwork walls and lighting.
4. Detail the existing computer and desk with physical fixings, cable restraint, a tiny identification tab and rubber/steel joinery. Keep the screen, keyboard and interaction bounds unchanged.
5. Fit the magnifier by measured bounds so only its handle tip overhangs the original scanner's front edge. Keep the lens itself on the platen.
6. Produce a local interactive close-up study using the production model factories, with a view for each detail family. Verify the real site on desktop and mobile, run npm run verify and review the diff before committing and pushing main. Confirm production assets match the release.

Review focus: original scanner invariant; magnifier overhang; logo holes and orientation; doorway camera/handle compatibility; render cost and disposal; no unsolicited interface text.

## Verification and review

- Full `npm run verify`: 120 tests pass, Astro reports zero errors/warnings, production build succeeds, 104 internal links resolve.
- Original scanner source has no diff from HEAD596d9ab.
- Desktop: original home, gallery approach, door entry, room, computer approach and interactive Instagram/Mail panel verified in browser without errors.
- Mobile390x844: magnifier enters the scan world; return verified. Final production smoke check follows push.
- Independent review found carriage/magnifier intersection; placement now uses the accessory's actual bounds so its underside remains above the carriage's highest vent. Heel extends .03 native units beyond the base's bevelled edge.
- Added physical objects are batched by material, reducing180 finishing meshes to37 while preserving movable handle and plaque groups. Reviewer verified world positions and disposal.
- Official logo contours have mixed winding; preserve correct filled letters and enclosed counters in both wordmarks. Tests cover all twelve New School letters and counter containment.
- Interactive model studies: local8785, source in the thread workspace `mocks/helen-finishing-details`. PNG contact sheet generated from those production models. These review materials are separate from public navigation.

Logo source: https://www.newschool.edu/parsons/ → https://app-nesc01saasunj58p001.cms.optimizely.com/globalassets/images/parsons_desktop.svg (retrieved2026-10-11). Original SVG retained; paths are extruded without changing their outlines or supplied colors.
