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

## Follow-up: visibility, a quieter doorway, and authored keepsakes

The latest correction supersedes item5's lens-containment constraint: preserve the earlier -.18 group yaw, and move the tool **down in screen space**, enough that part of the handle visibly clears the scanner on both camera layouts. Keep the original scanner byte-for-byte unchanged and retain carriage clearance. The former -.48 yaw incorrectly straightened the handle.

Reduce the jamb face from75mm to26mm, reduce its protrusion and match the leaf's paint. Keep the leaf, hinge axis and handle pivots. Raise the header underside from2.755m to2.804m to clear the unchanged2.79m leaf top; the former header overlapped it. The fine reveal projects only6mm beyond the exterior wall.

New geometry is grounded in the documented painting/engineering background, the actual train scans, Bent Mesh, and the site's bug experience. These are design interpretations, not biographical claims: a copper-and-wire beetle on the CRT; folded contact proofs of the actual scans; a shortened graphite pencil with cedar shaving; a torn, taped scan fragment on the bezel; a cut, bent wire-cloth study on a card at the archive workbench; and a small laminated offcut doorstop with a cotton retrieval loop. Use quiet materials, physical contact and safe clearance from the screen, keyboard, mouse and artworks. Batch fixed pieces by material and dispose all new resources.

Update actual-model studies with isolated close-ups and contextual views. Verify magnifier screen-space clearance at desktop and phone aspect ratios, inspect each object visually, run the full verification and an independent review, then push the authorized correction and check the deployed assets.

The user rejected the added lean-in object interactions during review. Remove that behavior, both menu entries, and its camera helper entirely; the objects remain small physical details. The separate model-study preview remains for reviewing the work.

Independent follow-up review found and resolved a mouse-cable/paper intersection and a jamb recessed inside the front wall. Final proof clearance is at least19.68mm from the mouse cable, pencil at least1.13mm. No outstanding code findings; new resources use existing disposal paths, small paper maps are limited to384px before GPU upload, and stationery/bug parts are batched.
