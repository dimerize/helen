/*
  Selected experience.

  Every entry here is transcribed from the LinkedIn profile Helen supplied.
  Descriptions are condensed from her own wording. Nothing is invented — no
  exhibitions, commissions, awards or titles that were not in the source.

  To add an entry: copy an existing one and fill it in. Order within a
  section is the order it appears on the page (most recent first).
*/

export interface CVEntry {
  /** The role, qualification or certificate. */
  role: string;
  /** Organisation, school or issuing body. */
  org: string;
  /** City / state. Optional. */
  place?: string;
  /** Free text — displayed right-aligned. e.g. "2024 — 25" */
  dates: string;
  /** One or two sentences. Optional; several entries need none. */
  note?: string;
}

export interface CVSection {
  heading: string;
  entries: CVEntry[];
}

export const cv: CVSection[] = [
  {
    heading: 'Education',
    entries: [
      {
        role: 'BFA Fine Arts, minor in Creative Coding',
        org: 'Parsons School of Design, The New School',
        place: 'New York',
        dates: '2022 — 26',
      },
      {
        role: 'High School Diploma, Engineering (Honors)',
        org: 'Union County Magnet High School',
        place: 'New Jersey',
        dates: '2018 — 22',
      },
    ],
  },
  {
    heading: 'Experience',
    entries: [
      {
        role: 'Robotic-Kinetic Installation Assistant',
        org: 'Volvox Labs',
        place: 'Brooklyn, NY',
        dates: '2025',
        note: 'Ran G-code from a tablet interface driving a robot arm in coordination with a kinetic mirror wall, during a private event showing an R&D installation. Monitored the visitor safety zone, operated emergency stop, and restarted the robot through its command sequence after interruptions.',
      },
      {
        role: 'Event Assistant, DATFEST',
        org: 'DATLAB NYC — Digital Arts & Technology Lab',
        place: 'Brooklyn, NY',
        dates: '2025',
        note: 'Front-of-house at a day-long festival of media art and creative technology. Attendee check-in and entry data.',
      },
      {
        role: 'Exhibition Art Handling',
        org: 'YveYANG Gallery',
        place: 'New York',
        dates: '2024 — ',
        note: 'Installing and deinstalling exhibitions across painting, textile, sculpture and mixed media. Packing and organising artwork, preparing gallery spaces, lighting setups, logistics, and liaising with artists during installs. Ongoing, as needed.',
      },
      {
        role: 'Gallery and Exhibition Intern',
        org: 'YveYANG Gallery',
        place: 'New York',
        dates: '2024',
        note: 'Front of gallery. Photo editing, 3D modelling and research supporting exhibition planning and daily operations. Scheduling and research for artists and curators. Informal interviews and exhibition reviews.',
      },
      {
        role: 'Hostess',
        org: 'Addams Tavern',
        place: 'Westfield, NJ',
        dates: '2023',
      },
    ],
  },
  {
    heading: 'Volunteering',
    entries: [
      {
        role: 'Stand In',
        org: 'Bureau Betak',
        place: 'New York',
        dates: '2024',
        note: 'Stand-in during show rehearsals for Tory Burch and Brandon Maxwell, Spring 2025 New York Fashion Week, so that technical, production and creative teams could set timing, lighting and music against a walk.',
      },
      {
        role: 'Emergency Food Distribution',
        org: 'Union County',
        place: 'New Jersey',
        dates: '2020 — 21',
        note: 'Drive-through distribution of produce and shelf-stable food during the pandemic, reaching over 2,000 vehicles per event at peak.',
      },
    ],
  },
  {
    heading: 'Certification',
    entries: [
      {
        role: 'Fusion 360 Certified User',
        org: 'Autodesk',
        dates: '2020',
      },
      {
        role: 'AutoCAD Certified User',
        org: 'Autodesk',
        dates: '2019',
      },
    ],
  },
];

/** Rendered as a single line at the foot of the CV. */
export const tools = ['Blender', 'Fusion 360', 'AutoCAD', 'Photoshop', 'Acrobat'];
