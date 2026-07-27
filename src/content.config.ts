import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
  Content schema.

  One collection: the short prose pages. Everything else on this site is
  either a texture or a fixed data file under src/data/.
*/

const site = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/site' }),
  schema: z.object({
    title: z.string(),
    /** Used for <title> and social previews on that page. */
    summary: z.string().max(200),
  }),
});

export const collections = { site };
