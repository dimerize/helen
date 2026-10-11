/*
  Site-wide constants. Contact details, navigation and metadata all live
  here — change them once, they change everywhere.
*/

export const site = {
  name: 'Helen Zhang',

  /** Canonical location and time zone for studio information. */
  location: 'New York',
  timeZone: 'America/New_York',

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
  { label: 'Home', href: '/', match: /^\/$/ },
  { label: 'Archive', href: '/archive', match: /^\/archive/ },
  { label: 'Gallery', href: '/gallery', match: /^\/gallery/ },
] as const;
