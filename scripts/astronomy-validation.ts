import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import phases from '../data/astronomy/moon-phases-2027.json';
import apsides from '../data/astronomy/lunar-apsides-2027.json';
import generated from '../src/data/calendar-2027.json';
import jpl from '../tests/fixtures/jpl-2027-reference.json';
import refinement from '../tests/fixtures/jpl-apsis-refinement-2027.json';
import seasons from '../tests/fixtures/usno-seasons-2027.json';
import { ENGINE, calculatePhaseEvents, calculateApsisEvents, lunarCoordinates } from '../src/lib/astronomy';
import type { AstroEvent, CalendarData } from '../src/lib/types';

const data = generated as CalendarData;
const start = new Date('2027-01-01T00:00:00Z');
const end = new Date('2028-01-01T00:00:00Z');
// Engineering acceptance limits, declared before comparison; not uncertainties.
export const limitsSeconds: Record<string, number> = {
  phase: 90, ascending_node: 180, descending_node: 180,
  production_apsis: 60, declination_minimum: 180, declination_maximum: 180,
  season: 120, library_apsis_diagnostic: 900,
};
type Reference = { type: string; instant_utc: string };
function utcSeconds(instant: string): number {
  const match = /^(.*T\d\d:\d\d:\d\d)(?:\.(\d+))?Z$/.exec(instant);
  if (!match) throw new Error(`Expected a UTC timestamp: ${instant}`);
  return Date.parse(`${match[1]}Z`) / 1000 + Number(`0.${match[2] ?? '0'}`);
}
function compare(actualEvents: AstroEvent[], references: Reference[], family?: string) {
  if (actualEvents.length !== references.length) throw new Error(`Count mismatch: ${actualEvents.length} / ${references.length}.`);
  return references.map((reference, i) => {
    const actual = actualEvents[i];
    if (actual.type !== reference.type) throw new Error(`Event sequence mismatch at ${reference.instant_utc}.`);
    const differenceSeconds = Math.round(Math.abs(utcSeconds(actual.instantUtc) - utcSeconds(reference.instant_utc)) * 1e6) / 1e6;
    const limitSeconds = limitsSeconds[family ?? actual.type];
    if (!Number.isFinite(limitSeconds)) throw new Error(`Missing acceptance limit: ${actual.type}`);
    return { type: actual.type, referenceUtc: reference.instant_utc, calculatedUtc: actual.instantUtc,
      differenceSeconds, limitSeconds, passed: differenceSeconds <= limitSeconds };
  });
}
function metric(rows: { differenceSeconds: number; passed: boolean }[]) {
  return { count: rows.length, maxAbsoluteDifferenceSeconds: Math.max(0, ...rows.map(r => r.differenceSeconds)), passed: rows.length > 0 && rows.every(r => r.passed) };
}
const inYear = (event: AstroEvent) => event.instantUtc.startsWith('2027-');
const chronological = (a: AstroEvent, b: AstroEvent) => Date.parse(a.instantUtc) - Date.parse(b.instantUtc);
const angularDifference = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

export function buildValidationReport() {
  // Validate the events shipped to the browser, not only the generating library.
  const yearEvents = data.events.filter(inYear).sort(chronological);
  const phaseResults = compare(calculatePhaseEvents(start, end), phases.events, 'phase');
  const geometryResults = compare(yearEvents.filter(e => e.kind === 'node' || e.kind === 'declination'),
    jpl.events.filter(e => e.type.endsWith('_node') || e.type.startsWith('declination_')));
  const seasonResults = compare(yearEvents.filter(e => e.kind === 'season'), seasons.events, 'season');
  const productionApsisResults = compare(yearEvents.filter(e => e.kind === 'apsis'),
    refinement.events.map(e => ({ type: e.type, instant_utc: e.fresh_cubic_root_utc })), 'production_apsis');
  const boundaryApsisResults = compare(data.events.filter(e => e.kind === 'apsis' && !inYear(e)).sort(chronological),
    refinement.boundary_events.map(e => ({ type: e.type, instant_utc: e.fresh_cubic_root_utc })), 'production_apsis');
  const libraryApsisResults = compare(calculateApsisEvents(start, end),
    jpl.events.filter(e => e.type === 'perigee' || e.type === 'apogee'), 'library_apsis_diagnostic');

  function sourceIntegrity(kind: 'phase' | 'apsis', expected: { id: string; type: string; instant_utc: string }[], source: string) {
    const actual = data.events.filter(e => e.kind === kind && (kind === 'apsis' || inYear(e)));
    return { count: actual.length, passed: actual.length === expected.length && expected.every(e => actual.some(a =>
      a.id === e.id && a.type === e.type && Date.parse(a.instantUtc) === Date.parse(e.instant_utc) && a.source === source)) };
  }
  const phaseSourceIntegrity = sourceIntegrity('phase', phases.events, phases.source.url);
  const apsisSourceIntegrity = sourceIntegrity('apsis', [...apsides.events, ...apsides.boundary_events], apsides.source.url);
  const sha = (path: string) => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');
  const fixtureIntegrity = {
    count: 2 + refinement.sources.length,
    passed: sha('../tests/fixtures/jpl-2027-reference.json') === refinement.reference_fixture_sha256 &&
      sha('../tests/fixtures/jpl-apsis-boundary-reference.json') === refinement.boundary_reference.sha256 &&
      refinement.sources.every(s => sha(`../tests/fixtures/${s.raw_file}`) === s.sha256),
  };
  const coordinateResults = jpl.coordinate_samples.map(s => {
    const c = lunarCoordinates(new Date(s.instant_utc));
    const differences = {
      declinationArcseconds: Math.abs(c.declinationDeg - s.declination_deg) * 3600,
      longitudeArcseconds: angularDifference(c.eclipticLongitudeDeg, s.ecliptic_longitude_deg) * 3600,
      latitudeArcseconds: Math.abs(c.eclipticLatitudeDeg - s.ecliptic_latitude_deg) * 3600,
      distanceKm: Math.abs(c.distanceAu - s.distance_au) * 149_597_870.7,
    };
    const interval = data.constellations.find(c => Date.parse(c.startUtc) <= Date.parse(s.instant_utc) && Date.parse(s.instant_utc) < Date.parse(c.endUtc));
    const sameConstellation = c.iauConstellation === s.iau_constellation && interval?.constellation === s.iau_constellation;
    return { instantUtc: s.instant_utc, ...differences, sameConstellation,
      passed: Object.entries(differences).every(([key, value]) => value <= (key === 'distanceKm' ? 100 : 60)) && sameConstellation };
  });
  const transitions = data.constellations.slice(1).map((interval, i) => ({ from: data.constellations[i].constellation,
    to: interval.constellation, instantUtc: interval.startUtc })).filter(t => t.instantUtc.startsWith('2027-'));
  const transitionResults = jpl.constellation_transition_brackets.map(bracket => {
    // Horizons uses astrometric labels. Allow 60 seconds around its hourly
    // brackets for frame differences; this is not minute-level ingress accuracy.
    const match = transitions.find(t => t.from === bracket.from && t.to === bracket.to &&
      Date.parse(t.instantUtc) >= Date.parse(bracket.start_utc) - 60_000 && Date.parse(t.instantUtc) <= Date.parse(bracket.end_utc) + 60_000);
    return { ...bracket, calculatedUtc: match?.instantUtc ?? null, passed: !!match };
  });
  const summary = {
    phaseEvents: metric(phaseResults), phaseSourceIntegrity,
    lunarNodes: metric(geometryResults.filter(r => r.type.endsWith('_node'))),
    lunarApsides: metric(productionApsisResults), boundaryApsides: metric(boundaryApsisResults), apsisSourceIntegrity,
    declinationTurns: metric(geometryResults.filter(r => r.type.startsWith('declination_'))),
    seasons: metric(seasonResults), fixtureIntegrity,
    monthlyCoordinates: { count: coordinateResults.length, passed: coordinateResults.every(r => r.passed),
      maxDeclinationArcseconds: Math.max(...coordinateResults.map(r => r.declinationArcseconds)),
      maxLongitudeArcseconds: Math.max(...coordinateResults.map(r => r.longitudeArcseconds)),
      maxLatitudeArcseconds: Math.max(...coordinateResults.map(r => r.latitudeArcseconds)),
      maxDistanceKm: Math.max(...coordinateResults.map(r => r.distanceKm)) },
    iauIngressBrackets: { count: transitionResults.length, calculatedCount: transitions.length,
      passed: transitionResults.every(r => r.passed) && transitions.length === transitionResults.length },
  };
  return {
    schemaVersion: 2, year: 2027, engine: ENGINE, verifiedOn: '2026-11-26',
    passed: Object.values(summary).every(m => m.passed),
    sourceUrls: [phases.source.url, jpl.source.url, seasons.url],
    jplInputSha256: jpl.source.input_sha256, engineeringAcceptanceLimitsSeconds: limitsSeconds,
    scope: 'Numerical checks of the shipped 2027 astronomy and its necessary boundary event. Not agricultural efficacy or exact reproduction of a publisher calendar.',
    limitations: [
      'USNO phases are preserved; the phase metric describes the independent library calculation.',
      'JPL node/declination reference roots are interpolated from hourly apparent-coordinate samples.',
      'Production apsides are JPL-derived. Their fresh-sample comparison tests interpolation of the same DE441 ephemeris, not independent physical observations or subsecond physical accuracy.',
      'IAU ingress is checked against hourly brackets with a 60-second frame allowance, not external minute-resolution transitions.',
      'Adjacent-year data support local-day boundaries and the next phase only; they are not a full independently audited additional year.',
      'No planetary aspects, publisher sectors, eclipses or complete sowing classification are validated.',
    ],
    summary, phaseResults, geometryResults, productionApsisResults, boundaryApsisResults,
    seasonResults, coordinateResults, transitionResults,
    excludedLibraryDiagnostics: {
      lunarApsides: { ...metric(libraryApsisResults), selectedForProduction: false,
        reason: 'Three approximate library apogees exceeded the unchanged 900-second acceptance limit. Production uses JPL-derived apsides instead.', results: libraryApsisResults },
    },
  };
}
