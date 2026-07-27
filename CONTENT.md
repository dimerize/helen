# Adding and editing works

This is the plain-English guide. You do not need to understand the rest of the code to use it.

Everything about a work lives in **one folder**. The folder holds a text file describing the work, and the photographs of the work, side by side.

```
src/content/works/
  placement-01/
    index.md        ← the description
    plate.png       ← the images
  placement-02/
    index.md
    plate.png
```

The **folder name becomes the web address**. `src/content/works/holding-pattern/` is published at `/works/holding-pattern`.

---

## How the site looks right now

There are six placements. **Four hold Helen's artwork** and are marked `uncatalogued` — the image is there, but the title, year and medium are not, so the site shows the work without claiming anything about it.

The remaining **two are reserved and empty**, showing a grey calibration plate — the kind of test card a photographer puts in frame. That is intentional, not a bug: an empty placement reads as a gallery before the show is hung, so the site looks finished today and still looks right as work is added one piece at a time.

To finish the four: give each a title, year, medium and description, then change `status` to `installed`. To add more, drop images into `incoming/` and run `npm run adopt`.

---

## The fastest way to add images

1. Put the photographs in the `incoming/` folder.
2. Run:

```bash
npm run adopt
```

That copies each image into the next free placement, reads its shape from the file so the rectangle matches, removes the calibration plate, and sets the status to `uncatalogued`.

To also make one of them the picture that shows up when the link is texted:

```bash
npm run adopt -- --og whichever-image.jpg
```

Then fill in the details by hand as below.

---

## Publishing a real work

**1. Put the photographs in the folder**, next to `index.md`. Any name is fine — `install-01.jpg`, `detail.jpg`.

**2. Open `index.md`** and fill it in. Here is a complete example:

```yaml
---
title: Holding Pattern
year: 2026
medium: Two-channel video, steel armature, mirror
dimensions: Dimensions variable
duration: "6:42, looped"
description: A pair of projections held slightly out of alignment, brought into register only when the room is empty.
status: installed
ratio: 1.5
assets:
  - image: ./install-01.jpg
    alt: Two projections meeting at a corner of a darkened room, a steel armature visible at the left edge.
  - image: ./detail.jpg
    alt: Close view of the steel armature holding a mirror at head height.
    caption: Detail, armature and mirror
order: 1
draft: false
---
```

**3. Change `status` to `installed`.**

**4. Delete `plate.png`** and remove its entry from `assets:`.

**5. Rename the folder** to something readable — lowercase, hyphens instead of spaces: `holding-pattern`.

**6. Check it, then publish:**

```bash
npm run verify
```

If that passes, commit and push. The site updates itself in about a minute.

---

## What each field means

| Field | Required? | Notes |
| --- | --- | --- |
| `title` | yes | Defaults to "Untitled" |
| `year` | for installed works | `2026`, or `"2024–25"` in quotes for a range |
| `medium` | for installed works | e.g. `Single-channel video, steel mount` |
| `dimensions` | no | e.g. `Dimensions variable` or `1220 × 915 mm` |
| `duration` | no | Time-based work only. Put it in quotes: `"6:42, looped"` |
| `description` | for installed works | One short paragraph, 260 characters maximum |
| `status` | yes | `placeholder`, `documentation pending`, or `installed` |
| `ratio` | yes | Width ÷ height. See below |
| `assets` | for installed works | The images and video. Every one needs `alt` |
| `credits` | no | A list of lines, e.g. `- Sound: Name` |
| `links` | no | A list of `label` / `href` pairs |
| `order` | yes | Lower numbers appear first |
| `draft` | yes | `true` hides it from the published site but keeps it visible locally |

### `status` — the four states

- **`placeholder`** — nothing here yet. Shows as a reserved placement with no title.
- **`documentation pending`** — the work exists but has not been photographed. Shows the title and details, marked as awaiting documentation.
- **`uncatalogued`** — the opposite: the photograph exists, but the title, year and medium do not. Shows the image with no title claimed. This is what `npm run adopt` sets.
- **`installed`** — finished and public. Requires a title, year, medium, description and at least one image, or the build fails.

### `ratio` — the shape of the work

Width divided by height. The site draws an empty rectangle at this exact proportion before the photograph loads, so the page never jumps.

| Shape | `ratio` |
| --- | --- |
| Square | `1.0` |
| Landscape photo (3:2) | `1.5` |
| Widescreen video (16:9) | `1.777` |
| Portrait photo (3:4) | `0.75` |
| Tall portrait (2:3) | `0.667` |

### `alt` — image descriptions

**Every image must have one, or the site will refuse to build.** This is on purpose.

Describe what is actually in the picture, for someone who cannot see it. Do not start with "image of" or "photo of".

- Good: `A darkened room with two projections meeting at the corner, a steel armature at the left edge.`
- Bad: `Image of artwork`

---

## Adding video

Video files do **not** go in the work folder. Put them in `public/media/<slug>/`, then reference them with a path starting from `/`:

```yaml
assets:
  - video: /media/holding-pattern/film.mp4
    poster: ./film-poster.jpg
    alt: Six minutes of two projections drifting in and out of alignment.
```

The `poster` is the still frame shown before anyone presses play — it *does* live in the work folder. Always include one.

Encode the video first so it is not enormous. The commands are in [README.md](README.md#video).

---

## Longer notes about a work

Anything you write **below** the closing `---` in `index.md` appears on the work's own page, underneath the images. Use it for installation notes or a longer text. Leave it empty if there is nothing to say — most works will not need it.

---

## Other things you can edit

| To change… | Edit this file |
| --- | --- |
| The About text | `src/content/site/about.md` |
| Email, Instagram, her name | `src/data/site.ts` |
| The CV | `src/data/cv.ts` |
| Colours, type sizes, timings | `src/styles/tokens.css` |

---

## Two things to confirm with Helen

**1. The About text.** It is adapted from her LinkedIn, which still described her as "a junior at Parsons". Since she graduated in May 2026, that was changed to graduate wording. Her own sentences are otherwise kept as written. She should read `src/content/site/about.md` and approve it.

**2. The CV.** Every entry in `src/data/cv.ts` is transcribed from the LinkedIn profile — nothing was added or invented. Two things were deliberately left out and can be added if she wants them: her GPA, and the Emergency Food Distribution volunteering is included but could be removed if it feels off-topic.

Nothing on this site claims an exhibition, award, commission or collaboration that was not in the material provided.

---

## If something goes wrong

Run `npm run verify`. It will tell you exactly which file and which field is the problem. Common ones:

- **"Every asset needs alt text"** — an image in `assets:` has no `alt:` line.
- **"A work with status 'installed' needs a medium"** — you set `status: installed` but left a required field blank. Either fill it in, or set the status back to `documentation pending`.
- **"Keep the description under 260 characters"** — shorten it.
- **A colon inside a value** — wrap the whole value in quotes: `duration: "6:42, looped"`.

Nothing you do here can break the live site: if the build fails, the deploy stops and the current site stays up untouched.
