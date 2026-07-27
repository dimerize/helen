# Decisions

Why this site is built the way it is, including the places where the original plan was wrong and got changed.

---

## The idea

**The site is a gallery the moment before the show is hung.**

In a real install, handlers tape out empty rectangles where each work will go, measure to a standard centre height, and print small wall labels. That vocabulary is the whole design:

- Each work begins as an **empty rectangle at its true proportion**, with registration marks at the corners.
- As it enters view the image **pulls into focus** inside it, and the corner marks strike red at the moment of alignment before settling.
- As it leaves, the image **decays to a ghost**, then back to an empty rectangle.
- On the entry page, a pointer or a finger **leaves a slowly fading trace** of light across the wall.

It is called *Stand-In* after a job Helen actually did: standing in at New York Fashion Week rehearsals so that lighting, timing and music could be calibrated against a body that was not the real one. That rhymes with the rest of her working life — art handling, running a robot arm through a calibration and emergency-stop sequence at Volvox Labs — and with her own stated interest in the gap between technical precision and human response.

**Why it earns its keep beyond being a nice metaphor:** there is no artwork documentation yet. The placeholder state *is* the concept, so the site is complete and deliberate today with zero images, and stays coherent as work is added one piece at a time. An empty placement reads as design, not as a hole.

### Rules the design follows

- **Nothing on the site is larger than the work.** The biggest type on the entry page is her name at 20px. Restraint is the position, not merely the absence of decoration.
- **The accent colour appears exactly three times sitewide** — registration marks at the instant of alignment, the current navigation item, and the focus ring. Nowhere else. It is a signal, so it has to be rare.
- **No instructional text.** The light reacts on first contact, which teaches itself. An earlier draft had a small "drag" caption; it was cut.
- **Every work is centred on the same line.** On the works index the plates vary in width and height, and a hairline runs through the centre of all of them — which is how work is hung, to a standard centre height rather than a standard top edge.

---

## Technical decisions

### Astro, static, no UI framework

The site is content with a few moments of interaction, not an application. Astro ships zero JavaScript by default, so the text pages are effectively instant on cellular, and only the two interactive pieces load code. Content collections give a typed schema that fails the build on bad content.

There is no React/Svelte/Vue runtime because nothing here is data-driven UI — it is canvas and DOM. **Total JavaScript is 3.4 kB gzipped across every page combined**, of which 2.7 kB is the WebGL field and loads only on the entry page, only after first paint.

### No Three.js

The entry visual is a single fullscreen quad. A scene graph, camera, material system and loader manage nothing that exists here, and cost roughly 150 kB gzipped.

Instead it is **raw WebGL2 with two hand-written fragment shaders** — about 4 kB, no dependency, nothing to keep up to date. Given her Creative Coding minor this is also more honest to the work than importing a library to do one rectangle.

### No GSAP, no smooth-scroll library

CSS transitions and one `requestAnimationFrame` loop cover everything. Smooth-scroll libraries are scroll-jacking under a friendlier name, and this site uses native scroll only.

### Dithering in the shader

This is a site made almost entirely of very dark gradients, and dark gradients band visibly across 8-bit sRGB — you get concentric rings. The composite shader adds well under one code value of noise before output, which destroys the banding and is invisible in itself.

The same problem showed up in the social preview image, which is generated as a flat gradient; grain was added there too. That moved it from a 463 kB PNG to a 21 kB JPEG, since grain is exactly what PNG cannot compress.

### The light field degrades in stages, and every stage is composed

Underneath the canvas is a CSS light spill plus an SVG grain overlay, present in the HTML from the first byte. It is not an apology — it is a still photograph of the same light, and it is what you get if JavaScript is off, WebGL is unavailable, the device is weak, or data saving is on.

The canvas fades in on top only after it has proved itself: it waits for load and then browser idle, refuses to start on a data-saving connection or a device reporting under 4 GB of memory or 4 cores, caps device pixel ratio at 1.5, then samples 40 frames. If the mean frame is over 22 ms it drops resolution once; if that is still not enough it removes itself entirely and hands the page back to the still. It also pauses when the tab is hidden and tears down on a lost context.

### Reduced motion is an inversion, not a subtraction

With `prefers-reduced-motion: reduce`, the shader draws exactly one frame and stops — no animation loop runs at all — and every work is set to resolved immediately with no decay.

The result is that **the site becomes a fully installed exhibition**: everything present, nothing fading. That is a designed state rather than a degraded one, and it happens to be the more restful reading of the same idea.

### Content lives in one folder per work

`src/content/works/<slug>/` holds the text file and that work's images together, and the folder name is the URL. For someone non-technical, "put the photos next to the description" is a much better model than paths that point somewhere else in the tree.

The schema is strict in two places, because both failures are invisible until they hurt someone: **every image must have alt text**, and a work marked `installed` must actually have a medium, description, year and at least one asset. The build fails otherwise.

---

## Where the plan was wrong

Four things changed once they met reality.

### 1. Low-quality image placeholders were dropped

The plan was for a blurred thumbnail that sharpens as the real image loads, doubling as the focus-pull.

Two problems. Astro's `ImageMetadata` does not expose a filesystem path, so generating one at build time is awkward. More importantly it was **wrong for the design**: here the empty taped rectangle *is* the loading state and it is the intended one. A blurred preview would give the work away before it resolves.

The focus-pull now runs on the image's `load` event instead. Simpler, and it does not undercut the idea.

### 2. Swipe navigation between assets was dropped

The plan had a horizontal swipe carousel with a position indicator and a directional lock.

A horizontal swipe handler on a vertically scrolling page has to guess what the visitor meant, and gets it wrong often enough to feel like a trap — which the brief explicitly warned against. Assets are now simply stacked vertically on the work page: better for long documentation, better for screen readers, no gesture ambiguity, and no way to get stuck.

Arrow keys still step between works, as a bonus for anyone moving quickly. Nothing depends on it.

### 3. Device orientation was cut entirely

The plan allowed a small parallax behind an opt-in permission prompt. On iOS that means interrupting the first impression with a system dialog, for an effect nobody would notice. Touch already provides the tactile channel. It is about twenty lines to add later if it is ever wanted.

### 4. Corner marks were baked into the placeholder images, twice

The generated calibration plates originally carried their own corner registration marks, and the component draws registration marks on the rectangle too. Doubled, it read as noise rather than precision. The marks were removed from the image; the component owns them.

---

## Things worth knowing if you work on this

- **`src/styles/tokens.css` is the single source of truth.** Nothing else hardcodes a colour, size or duration.
- **Astro's dev server caches image transforms.** After regenerating placeholders, `rm -rf node_modules/.astro` or you will keep seeing the old ones. Production builds are unaffected — this bit us during development.
- **Anything revealed by JavaScript is gated behind `html.js`**, a class added by an inline script in `<head>`. If scripts are blocked, fail to load, or throw, the page falls back to showing all its content rather than a wall of empty rectangles. Keep that pattern if you add new reveal behaviour.
- **Grid columns use `minmax(0, …)`, deliberately.** A grid column's default minimum is `min-content`, so a wide work sized itself to its own declared width and pushed off the side of a narrow phone. This was a real bug, caught by measuring rather than by looking.
- **Nothing on this site claims an exhibition, award, commission or collaboration** that was not in the material Helen provided. Please keep it that way — see [CONTENT.md](CONTENT.md).
