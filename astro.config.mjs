import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The live address. Drives canonical URLs, the sitemap, and the image used
// for link previews in iMessage and elsewhere. If this ever changes, change
// the Sitemap: line in public/robots.txt to match.
export const SITE = 'https://helenzhang.studio';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  image: {
    // Widths generated for responsive srcsets. Keep in sync with the `sizes`
    // attributes in src/components/Media.astro.
    responsiveStyles: false,
  },
  build: {
    // One stylesheet rather than many small ones: this site's CSS is tiny and
    // a single request beats waterfalling on cellular.
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // GLSL is imported as raw strings; keep it out of the asset pipeline.
      assetsInlineLimit: 4096,
    },
  },
});
