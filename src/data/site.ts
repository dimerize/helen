/*
  Site-wide constants. Contact details, navigation and metadata all live
  here — change them once, they change everywhere.
*/

export const site = {
  name: 'Helen Zhang',
  /** Shown under her name on the entry screen. Keep it to a few words. */
  discipline: 'Installation, moving image, creative technology',
  location: 'New York',

  email: 'helen20040707@gmail.com',
  instagram: 'helen100087',
  get instagramUrl() {
    return `https://instagram.com/${this.instagram}`;
  },

  /** Used for <title>, meta description and social previews. */
  meta: {
    title: 'Helen Zhang',
    description:
      'Helen Zhang is an artist in New York working across installation, moving image and creative technology.',
  },
} as const;

/**
 * Bottom-edge navigation. There is no top bar; this is the whole thing.
 * `match` decides which item is marked as current.
 */
export const nav = [
  { label: 'Works', href: '/works', match: /^\/works/ },
  { label: 'About', href: '/about', match: /^\/about/ },
  { label: 'CV', href: '/cv', match: /^\/cv/ },
  { label: 'Contact', href: '/contact', match: /^\/contact/ },
] as const;

/**
 * The standard centre height for hanging artwork in a gallery, in inches.
 * Drawn as a hairline across the entry screen.
 */
export const HANGING_LINE_INCHES = 57;
