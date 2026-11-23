/*
  The homepage's own words and the five project prints under the scanner.

  The prints run in Helen's order, left to right, and each opens its existing
  project page. Their images are square crops of Helen's draft until her full
  files arrive: name them as below, drop them in incoming/, and run
  `npm run adopt`. That replaces these files at the same paths.
*/

/** The two lines under the scanner, in Helen's words. */
export const about = [
  'NYC artist with too many tabs open.',
  'Fine Arts & Creative Code – Parsons School of Design 2026',
] as const;

export const homePrints = [
  { title: 'Out of Context', href: '/project?work=thesis', image: '/artwork/home-out-of-context.webp' },
  { title: 'Standing Room Only', href: '/project?work=standing', image: '/artwork/home-standing-room-only.webp' },
  { title: 'Jack.exe & Rose-liet', href: '/project?work=jack', image: '/artwork/home-jack-rose.webp' },
  { title: '8PPI', href: '/project?work=8ppi', image: '/artwork/home-8ppi.webp' },
  { title: 'Side Effects May Include', href: '/project?work=side-effects', image: '/artwork/home-side-effects.webp' },
] as const;
