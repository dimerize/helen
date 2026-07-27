import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;

/**
 * Every work, in wall order. Drafts are visible while developing and
 * dropped from production builds, so an unfinished entry can be previewed
 * locally without any risk of it going live.
 */
export async function getWorks(): Promise<Work[]> {
  const works = await getCollection('works', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return works.sort((a, b) => a.data.order - b.data.order);
}

/** The work before and after this one, for prev/next. Does not wrap. */
export function neighbours(works: Work[], id: string) {
  const i = works.findIndex((w) => w.id === id);
  return {
    index: i,
    prev: i > 0 ? works[i - 1] : undefined,
    next: i > -1 && i < works.length - 1 ? works[i + 1] : undefined,
  };
}

/** The number shown on a wall label. Position on the wall, not the order field. */
export function labelNumber(works: Work[], id: string): number {
  return works.findIndex((w) => w.id === id) + 1;
}

/**
 * Inventory number, in the form an art handler would write on a crate and a
 * condition report. Position on the wall, so it stays consistent with the
 * label beside the work.
 */
export function inventory(number: number): string {
  return `HZ-${String(number).padStart(3, '0')}`;
}
