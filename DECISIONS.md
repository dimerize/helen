# Decisions

Why this site is built the way it is.

---

## The idea

**A picture in a dark room, and you are the light.**

The homepage carries one of Helen's scans behind near-total darkness. Three things light it:

- **A scan bar** running the full width, travelling down and back up on a slow eased triangle wave — a flatbed passing over the glass.
- **A drifting lamp**, off-axis and never quite still, so some part of the picture is always surfacing.
- **The pointer**, which writes into a decaying trace buffer. Wherever a hand has passed opens up almost completely, then sinks back over a couple of seconds.

The picture is never *displayed*. You see only as much of it as has been lit, and it closes behind you. That is the whole interaction, and it needs no caption: the bar is already moving when the page loads, and the light follows the pointer on first contact.

Every other page carries a still of the same idea — the scan behind a mask shaped like the lamp's falloff, at low strength, with the reading over the top.

### Rules the design follows

- **Nothing on the site is larger than the work.** The biggest type is her name at 20px. Restraint is the position, not merely an absence of decoration.
- **The accent colour appears exactly twice sitewide** — the current navigation item and the focus ring. It is a signal, so it has to be rare.
- **No instructional text.** Anything that needs a caption to be understood is not working.

---

## Technical decisions

### Astro, static, no UI framework

The site is a handful of short pages and one interactive surface. Astro ships zero JavaScript by default, so the reading pages are effectively instant on cellular and only the entry loads code. There is no React/Svelte/Vue runtime, because nothing here is data-driven UI — it is a canvas and some prose.

### No Three.js

The visual is a single fullscreen quad. A scene graph, camera and material system manage nothing that exists here and cost roughly 150 kB gzipped. Instead it is **raw WebGL2 with two hand-written fragment shaders** — no dependency, nothing to keep up to date, and given her Creative Coding minor, more honest to the work than importing a library to draw one rectangle.

### Dithering in the shader

This is a site made almost entirely of very dark gradients, and dark gradients band visibly across 8-bit sRGB — you get concentric rings. The composite shader adds well under one code value of noise before output, which destroys the banding and is invisible in itself.

The same problem appeared in the generated social card, so grain was added there too. That moved it from a 463 kB PNG to a 21 kB JPEG, since grain is exactly what PNG cannot compress.

### The field degrades in stages, and every stage is composed

Underneath the canvas sits a CSS still — the scan behind the same falloff mask — present in the HTML from the first byte. It is not an apology; it is a photograph of the same light, and it is what you get with JavaScript off, WebGL unavailable, a weak device, or data saving on.

The canvas fades in on top only after proving itself: it waits for load and then browser idle, refuses to start on a data-saving connection or a device reporting under 4 GB of memory or 4 cores, caps device pixel ratio at 1.5, then samples 40 frames. If the mean frame exceeds 22 ms it drops resolution once; if that is still not enough it removes itself and hands the page back to the still. It also pauses when the tab is hidden, and tears down on a lost context.

### Reduced motion is an inversion, not a subtraction

With `prefers-reduced-motion: reduce` the shader draws exactly one frame and stops — no animation loop runs at all. The result is a single composed still of the same light, rather than a stripped-down version of the page.

### Cloudflare, and the `_headers` trap

Cloudflare applies *every* matching `_headers` rule and concatenates the values with the catch-all first. A `Cache-Control` on `/*` was therefore being joined ahead of the specific rules, and browsers honour the first `max-age` they see — which silently turned a year-long asset cache into "revalidate every request". Reordering cannot fix it. The catch-all now carries only headers that are safe to combine, and `Cache-Control` is set on specific paths only.

Caught by reading response headers off the live deployment rather than trusting the file.

---

## Things worth knowing if you work on this

- **`src/styles/tokens.css` is the single source of truth.** Nothing else hardcodes a colour, size or duration.
- **Anything revealed by JavaScript is gated behind `html.js`**, a class added by an inline script in `<head>`. If scripts are blocked, fail to load, or throw, the page falls back to showing its content rather than a blank field. Keep that pattern if you add new reveal behaviour.
- **Astro's dev server caches image transforms.** After regenerating anything under `public/`, `rm -rf node_modules/.astro` or you will keep seeing the old file. Production builds are unaffected — this bit us during development.
- **A component's behaviour should travel with the component.** Scripts imported by a page rather than by the component it belongs to broke silently the moment that component moved.
- **Nothing on this site claims an exhibition, award, commission or collaboration** that was not in the material Helen provided. Please keep it that way.

---

## What was removed, and why

The site previously carried a works section: a suspended "counterweight" wall of placement rectangles with wall labels, inventory numbers, generated mounting elevations and crate-handling marks, plus per-work pages and a content collection.

It was cut in full. There was no artwork to put in it, so it amounted to an elaborate frame around six empty rectangles — and the frame had begun competing with the one thing on the site that actually works. The scans now serve as the site's material rather than as its subject.

If a works section is wanted later, it should be built when there is work to show, not before.
