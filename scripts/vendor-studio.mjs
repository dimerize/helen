import { build } from 'esbuild';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const output = new URL('../public/studio/vendor/', import.meta.url);
await mkdir(output, {recursive: true});
// Three r180 is checked in alongside its matching official rounded-box addon.
// Keep the addon on this same module instance; camera-controls' npm peer can differ.
const { REVISION } = await import(new URL('three.module.min.js', output));
const roundedBox = await readFile(new URL('rounded-box.js', output), 'utf8');
if (REVISION !== '180' || !roundedBox.includes("from './three.module.min.js'")) {
  throw new Error('The self-hosted Three runtime and RoundedBoxGeometry must both use r180.');
}
await build({
  stdin: {contents: 'export { animate, spring } from "motion";', resolveDir: process.cwd()},
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['safari16.4', 'chrome111'],
  outfile: new URL('motion.js', output).pathname,
  banner: {js: '/*! Motion 14.1.0 — MIT. See motion-LICENSE.txt. */'},
});
for (const [name, contents] of [
  ['gsap', 'export { gsap } from "gsap";'],
  ['html2canvas', 'export { default } from "html2canvas";'],
]) await build({
  stdin: {contents, resolveDir: process.cwd()},
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['safari16.4', 'chrome111'],
  outfile: new URL(`${name}.js`, output).pathname,
});
for (const [source, destination] of [
  ['camera-controls/dist/camera-controls.module.min.js', 'camera-controls.js'],
  ['camera-controls/LICENSE', 'camera-controls-LICENSE.txt'],
  ['motion/LICENSE.md', 'motion-LICENSE.txt'],
  ['motion-dom/LICENSE.md', 'motion-dom-LICENSE.txt'],
  ['motion-utils/LICENSE.md', 'motion-utils-LICENSE.txt'],
  ['framer-motion/LICENSE.md', 'framer-motion-LICENSE.txt'],
  ['gsap/README.md', 'gsap-README.md'],
  ['html2canvas/LICENSE', 'html2canvas-LICENSE.txt'],
]) await copyFile(new URL(`../node_modules/${source}`, import.meta.url), new URL(destination, output));
console.log('Vendored Camera Controls, Motion, GSAP and html2canvas; verified self-hosted Three r180 and RoundedBoxGeometry.');
