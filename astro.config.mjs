import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Update this once the custom domain is connected (see README → Deployment).
// Until then it is only used for sitemap/canonical URLs and is harmless if wrong.
export const SITE = 'https://helenzhang.pages.dev';

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
