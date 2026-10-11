# Scanner optics and camera navigation

The user requests stronger visible lens optics, quieter UI, autonomous scan selection only, and deliberate 3D travel on navigation. The original scanner hardware is unchanged.

Implementation uses the existing Three.js renderer and real scene cameras. No captured page is used as a flying surface. The archive transition reconstructs only the artwork sheets as image slabs matching their actual visible positions. Home, Archive and Gallery occupy a consistent left-to-right route order (Archive, Home, Gallery). Each departure takes 1.2 seconds and each arrival .85 seconds; camera position and target move together, retaining orientation and FOV. Native document loading separates cross-page legs; this is not an uninterrupted persistent scene. Reduced motion and unavailable WebGL use native navigation. Lifted prints use the separately approved preserved-object archive handoff.

- [x] Lens: nonlinear refraction, restrained edge dispersion, curved reflection bands, detailed rim and grip. Only reflection changes slowly; reduced motion freezes it. Validate source texture ownership and geometry.
- [x] Home: remove scan controls and listeners; no replacement selection control. Muted charcoal lift button; bottom left on mobile. Enlarge and position magnifier without changing hardware. Check 390px and desktop layout.
- [x] Print handoff: one-use, expiring record; identical artwork, rotation, size and screen position in archive inspector. Native links remain usable and reduced motion immediate.
- [x] Camera navigation: coordinate source/arrival hooks, abort safely, preserve native modified clicks/history, avoid replay on reload/back. Integrate actual home/gallery cameras and temporary archive image slabs. Verify every directed route, fallback and reduced motion.
- [ ] Run full verify, review integrations, visually check actual production build, push main and confirm Cloudflare and live source.
