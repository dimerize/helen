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
 * Every navigation item, in order. Studio pages render these through
 * StudioNav; the 404 page's bottom edge renders them through EdgeNav, where
 * `match` decides which item is marked as current.
 */
export const nav = [
  { label: 'Home', href: '/', match: /^\/$/ },
  { label: 'Selected Works', href: '/work', match: /^\/(work|project)/ },
  { label: 'Archive', href: '/archive', match: /^\/archive/ },
  { label: 'Gallery', href: '/gallery', match: /^\/gallery/ },
] as const;
