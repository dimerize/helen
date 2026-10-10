# Motion and mobile audit

The scanner remains the homepage. A Gallery navigation entry and a hinged door open the installation as an optional room over that page. Closing it restores the same scroll, loose scans and focus.

## Repairs

- Replaced direct camera mutation and custom smoothstep travel with Camera Controls. Drag/touch look, wheel, walking and named views now share damped camera state. Eye level and room boundaries remain fixed; queued wheel movement is capped; interrupted travel stops at the current position. Removed floor-click teleportation.
- Replaced Unicode navigation symbols with local stroke SVGs, including dynamically created controls. Loaded the existing self-hosted Geist face on every studio page and used it for the scanner label as well.
- Added Motion springs for the physical door, lifted scans, view changes and artwork dialogs. Native dialogs retain modal focus and inertness through their exit. Reduced motion bypasses those animations.
- Made the gallery overlay lazy and same-origin. Closing unloads the room. The scanner and hidden tabs stop rendering. Messages validate both origin and source window. Direct gallery URLs remain available.
- Reduced phone control coverage, retained 44px targets for interactive gallery controls, and replaced desktop-only usage instructions on phones.
- Updated compatible dependencies after auditing the installed dependency tree; npm audit reports no vulnerabilities.

## Verification

Automated checks cover actual-library damping and bounds, angle-seam retargeting, interruptions, wheel units and bursts, modal lifecycle races, and reduced motion. Browser checks cover the scanner, its vectors and loaded font, opening/closing the door, gallery viewpoint and artwork dialogs, and phone layout. The full Astro build and internal-link check run before publication.

Libraries: [Camera Controls](https://yomotsu.github.io/camera-controls/), [Motion](https://motion.dev/docs/animate). Bundled license notices are included in `public/studio/vendor`.
