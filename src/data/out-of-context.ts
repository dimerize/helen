/*
  Everything the Out of Context page (/project?work=thesis) shows, in page
  order. Files live in public/artwork, and their pixel sizes are read at build
  time, so a sharper file under the same name drops in with no other change.
  Captions carry only facts Helen has supplied; her new text replaces them.
*/

/** An image on the page. `file` opens in the zoom viewer; `thumb`, when given, is what the page shows. */
export interface Artwork {
  file: string;
  thumb?: string;
  alt: string;
  /** Shown under the image and in the zoom viewer. */
  caption: string;
  /** Another image the zoom viewer can show beside this one. */
  compare?: { file: string; label: string };
}

/** A labeled frame for documentation still to come. `aspect` is a CSS aspect-ratio. */
export interface Gap {
  gap: string;
  aspect: string;
}

export type Slot = Artwork | Gap;

export const isGap = (slot: Slot): slot is Gap => 'gap' in slot;

/** Jump links, in page order. Each id is a section on the page. */
export const sections = [
  { id: 'source', label: 'Source' },
  { id: 'paintings', label: 'Paintings' },
  { id: 'transfers', label: 'Image transfers' },
  { id: 'projection', label: 'Projection' },
  { id: 'installation', label: 'Installation' },
];

// Helen's new full shot (her image 1) replaces this file on this page only.
// The 3D room, the Selected Works card, the archive and the drawing
// comparison keep thesis-painting.webp: the viewer drawings were made over it.
export const gapingNet: Artwork = {
  file: 'thesis-painting.webp',
  alt: 'Gaping Net, full view',
  caption: 'Gaping Net, full view. Acrylic on homasote.',
};

/** The first screen. Becomes an installation photograph when those arrive. */
export const opening: Artwork = gapingNet;

export const source: Artwork = {
  file: 'thesis-source.webp',
  alt: 'Three fragments of an advertisement, assembled from partial handheld scans',
  caption: 'Three fragments of an advertisement. Partial handheld scans assembled together. The partial capture is the starting point for the work.',
};

const fullViewToCome: Gap = { gap: 'Full view: photograph to come', aspect: '4 / 5' };

export const paintings: { name: string; full: Slot; closeUps: Slot[] }[] = [
  { name: 'Gaping Net', full: gapingNet, closeUps: [{ gap: 'Close-ups: photographs to come', aspect: '2 / 3' }] },
  {
    name: 'Bent Mesh',
    full: fullViewToCome,
    closeUps: [{ file: 'bent-mesh-detail-1.webp', alt: 'Bent Mesh, close-up', caption: 'Bent Mesh, close-up.' }],
  },
  {
    name: 'Stretched Out',
    full: fullViewToCome,
    closeUps: [
      { file: 'stretched-out-detail-1.webp', alt: 'Stretched Out, close-up', caption: 'Stretched Out, close-up.' },
      { file: 'stretched-out-detail-2.webp', alt: 'Stretched Out, second close-up', caption: 'Stretched Out, close-up.' },
    ],
  },
];

export const transfers: Artwork[] = [
  { file: 'transfers-three.webp', alt: 'Image transfers, three of the six', caption: 'Image transfers, three of the six.' },
  { file: 'transfers-two.webp', alt: 'Image transfers, two of the six', caption: 'Image transfers, two of the six.' },
  { file: 'transfers-one.webp', alt: 'Image transfer, one of the six', caption: 'Image transfers, one of the six.' },
];

export const projectionVideo: Gap = { gap: 'Projection video to come', aspect: '16 / 9' };

export const interpretations: Artwork[] = Array.from({ length: 8 }, (_, i) => ({
  file: `interpretation-${i + 1}.webp`,
  thumb: `interpretation-${i + 1}-thumb.webp`,
  alt: `Viewer drawing ${i + 1} over Gaping Net`,
  caption: `Viewer drawing ${i + 1} of 8, over Gaping Net.`,
  compare: { file: 'thesis-painting.webp', label: 'Gaping Net' },
}));

export const installationPhotos: Gap = { gap: 'Installation photographs to come', aspect: '3 / 2' };

export const proposal: Artwork = {
  file: 'thesis-installation.webp',
  alt: 'The original proposal: paintings and projected interpretations arranged in a room',
  caption: 'The original proposal. Proposed arrangement of paintings and projected interpretations, from the thesis materials.',
};
