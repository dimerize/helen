import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
  Content schema.

  One folder per work: src/content/works/<slug>/index.md, with that work's
  images sitting beside the text file. The folder name becomes the URL.

  The schema is deliberately strict in two places, because both mistakes are
  invisible until someone is harmed by them:

    1. Every asset must have alt text. The build fails without it.
    2. A work marked `status: installed` must actually have a medium, a
       description and at least one asset — so nothing half-finished can be
       published by accident.

  Placeholder works are exempt: they are supposed to be incomplete, and the
  site is designed to display them as reserved placements rather than as
  broken entries.
*/

const link = z.object({
  label: z.string().min(1),
  href: z.url(),
});

const works = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/content/works' }),
  schema: ({ image }) =>
    z
      .object({
        /** Shown on the wall label and the work page. */
        title: z.string().min(1).default('Untitled'),
        /** A number (2025) or a string for ranges ("2024–25"). */
        year: z.union([z.number().int(), z.string()]).optional(),
        /** e.g. "Single-channel video, steel mount". */
        medium: z.string().default(''),
        /** e.g. "Dimensions variable" or "1220 × 915 mm". */
        dimensions: z.string().default(''),
        /** e.g. "6:42, looped". Time-based work only. */
        duration: z.string().default(''),
        /**
         * One short paragraph. The cap is a design constraint, not a
         * technical one — long statements do not suit this site.
         */
        description: z
          .string()
          .max(260, 'Keep the description under 260 characters.')
          .default(''),
        /**
         * `placeholder`            — a reserved placement, no work yet
         * `documentation pending`  — the work exists, photographs do not
         * `uncatalogued`           — photographs exist, catalogue details do not
         * `installed`              — complete and public
         *
         * `uncatalogued` is the honest state for a work that has been
         * photographed but not yet titled, dated or described. It shows the
         * image without asserting anything about it.
         */
        status: z
          .enum(['placeholder', 'documentation pending', 'uncatalogued', 'installed'])
          .default('placeholder'),
        /**
         * Width ÷ height. Gives the empty placement rectangle its true
         * proportion before any image exists, so the wall has real rhythm.
         */
        ratio: z.number().positive().min(0.3).max(4).default(1.5),
        assets: z
          .array(
            z
              .object({
                /** Path relative to this work's folder, e.g. ./plate-01.png */
                image: image().optional(),
                /** Absolute path under /public, e.g. /media/slug/film.mp4 */
                video: z.string().optional(),
                /** Poster frame for a video. Strongly recommended. */
                poster: image().optional(),
                /** Required. Describe what is shown, not "image of...". */
                alt: z.string().min(1, 'Every asset needs alt text.'),
                caption: z.string().optional(),
              })
              .refine((a) => Boolean(a.image ?? a.video), {
                message: 'An asset needs either an `image:` or a `video:`.',
              }),
          )
          .default([]),
        credits: z.array(z.string()).default([]),
        links: z.array(link).default([]),
        /** Ascending. Controls position on the wall. */
        order: z.number().int(),
        /** Excluded from production builds. */
        draft: z.boolean().default(false),
      })
      .superRefine((work, ctx) => {
        if (work.status !== 'installed') return;

        const required = [
          ['medium', work.medium],
          ['description', work.description],
        ] as const;

        for (const [field, value] of required) {
          if (!value.trim()) {
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message: `A work with status "installed" needs a ${field}.`,
            });
          }
        }

        if (work.assets.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['assets'],
            message:
              'A work with status "installed" needs at least one asset. Use "documentation pending" until photographs exist.',
          });
        }

        if (work.year === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['year'],
            message: 'A work with status "installed" needs a year.',
          });
        }
      }),
});

const site = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/site' }),
  schema: z.object({
    title: z.string(),
    /** Used for <title> and social previews on that page. */
    summary: z.string().max(200),
  }),
});

export const collections = { works, site };
