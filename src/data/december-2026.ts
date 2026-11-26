import type { AstroEvent } from '../lib/types';

const phaseSource = 'https://www.astropixels.com/ephemeris/phasescat/phases2001.html';
const seasonSource = 'https://www.astropixels.com/ephemeris/soleq2001.html';

const phases = [
  ['last_quarter', 'Quarto minguante', '2026-12-01T06:09:00Z'],
  ['new_moon', 'Lua nova', '2026-12-09T00:52:00Z'],
  ['first_quarter', 'Quarto crescente', '2026-12-17T05:43:00Z'],
  ['full_moon', 'Lua cheia', '2026-12-24T01:28:00Z'],
  ['last_quarter', 'Quarto minguante', '2026-12-30T19:00:00Z'],
] as const;

const events: AstroEvent[] = [
  ...phases.map(([type, label, instantUtc]): AstroEvent => ({
    id: `december-${type}-${instantUtc}`, type, label, instantUtc, kind: 'phase', source: phaseSource,
  })),
  {
    id: 'december-solstice-2026', type: 'december_solstice', kind: 'season',
    label: 'Solstício de dezembro', instantUtc: '2026-12-21T20:50:00Z', source: seasonSource,
  },
];

export const decemberEvents = events.sort((a, b) => a.instantUtc.localeCompare(b.instantUtc));

export const precedingEquinox: AstroEvent = {
  id: 'september-equinox-2026', type: 'september_equinox', kind: 'season',
  label: 'Equinócio de setembro', instantUtc: '2026-09-23T00:06:00Z', source: seasonSource,
};
