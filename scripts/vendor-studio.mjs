import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

const output = new URL('../public/studio/vendor/', import.meta.url);
await mkdir(output, {recursive: true});
await build({
  stdin: {contents: 'export { animate, spring } from "motion";', resolveDir: process.cwd()},
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['safari16.4', 'chrome111'],
  outfile: new URL('motion.js', output).pathname,
  banner: {js: '/*! Motion 14.1.0 — MIT. See motion-LICENSE.txt. */'},
});
for (const [source, destination] of [
  ['camera-controls/dist/camera-controls.module.min.js', 'camera-controls.js'],
  ['camera-controls/LICENSE', 'camera-controls-LICENSE.txt'],
  ['motion/LICENSE.md', 'motion-LICENSE.txt'],
  ['motion-dom/LICENSE.md', 'motion-dom-LICENSE.txt'],
  ['motion-utils/LICENSE.md', 'motion-utils-LICENSE.txt'],
  ['framer-motion/LICENSE.md', 'framer-motion-LICENSE.txt'],
]) await copyFile(new URL(`../node_modules/${source}`, import.meta.url), new URL(destination, output));
console.log('Vendored Camera Controls and Motion from pinned npm packages.');
