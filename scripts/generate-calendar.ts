import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import phases from '../data/astronomy/moon-phases-2027.json';
import apsides from '../data/astronomy/lunar-apsides-2027.json';
import { ENGINE, calculatePhaseEvents, calculateNodeEvents, calculateDeclinationEvents, calculateMotionIntervals, calculateConstellationIntervals, calculateSeasonEvents } from '../src/lib/astronomy';
import { buildCautionIntervals } from '../src/lib/tradition';
import type { CalendarData, AstroEvent } from '../src/lib/types';

const year = 2027;
// Adjacent-year padding covers all local 2027 days, overlapping caution windows,
// and the next phase at year end. UI coverage remains exactly local year 2027.
const start = new Date('2026-12-20T00:00:00Z');
const end = new Date('2028-01-12T00:00:00Z');
const calculatedPhases = calculatePhaseEvents(start, end);
const preservedPhases: AstroEvent[] = phases.events.map(e => ({
  id: e.id, kind: 'phase', type: e.type, label: e.label_pt_BR, instantUtc: e.instant_utc,
  source: phases.source.url, detail: 'Horário publicado pelo USNO, com precisão de minuto; cálculo independente conferido separadamente.',
}));
// The library's approximate apsis search failed our 2027 acceptance limit.
// Use JPL-derived timings, including the adjacent-year apogee visible on local
// 31 December in western time zones. Do not silently fall back to the library.
const boundaryApsides = (apsides as { boundary_events?: typeof apsides.events }).boundary_events ?? [];
const preservedApsides: AstroEvent[] = [...apsides.events, ...boundaryApsides].map(e => ({
  id: e.id, kind: 'apsis', type: e.type, label: e.label_pt_BR, instantUtc: e.instant_utc,
  source: apsides.source.url,
  detail: `${e.type === 'perigee' ? 'Menor' : 'Maior'} distância neste ciclo: aproximadamente ${Math.round(e.distance_km).toLocaleString('pt-BR')} km. Horário derivado de dados JPL, exibido com precisão de minuto.`,
}));
const turns = calculateDeclinationEvents(start, end);
const events = [
  ...calculatedPhases.filter(e => !e.instantUtc.startsWith('2027-')),
  ...preservedPhases, ...calculateNodeEvents(start, end), ...preservedApsides,
  ...turns, ...calculateSeasonEvents(2026).filter(e => e.instantUtc >= start.toISOString()),
  ...calculateSeasonEvents(year),
].sort((a, b) => a.instantUtc.localeCompare(b.instantUtc));
const data: CalendarData = {
  schemaVersion: 1, year, startUtc: start.toISOString(), endUtc: end.toISOString(),
  engine: `${ENGINE}; USNO phases; JPL DE441 apsides`, methodVersion: 'raiz-e-ritmo-astronomy-and-partial-tradition-v1',
  events, motion: calculateMotionIntervals(start, end, turns),
  constellations: calculateConstellationIntervals(start, end),
  cautions: buildCautionIntervals(events),
};
mkdirSync('src/data', { recursive: true });
const output = JSON.stringify(data, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync('src/data/calendar-2027.json', 'utf8') !== output) {
    throw new Error('Generated calendar is stale. Run npm run generate and review the data change.');
  }
} else writeFileSync('src/data/calendar-2027.json', output);
console.log(JSON.stringify({ year, events: events.length, constellationIntervals: data.constellations.length, motionIntervals: data.motion.length, partialCautionIntervals: data.cautions.length, note: 'counts include adjacent-year padding' }, null, 2));
