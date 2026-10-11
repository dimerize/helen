const ids = Object.freeze(['train-scan', 'train-scan-wide', 'train-scan-notice']);
export function scanArchiveURL(index) {
  if (!Number.isInteger(index) || !ids[index]) throw new RangeError('Unknown scan.');
  return `/archive?scan=${ids[index]}`;
}
export function scanIndexFromURL(href) {
  try {
    const id = new URL(href).searchParams.get('scan');
    const index = ids.indexOf(id);
    return index < 0 ? null : index;
  } catch { return null; }
}
