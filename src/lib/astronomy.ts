import * as Astronomy from 'astronomy-engine';
import type { AstroEvent, CalendarInterval } from './types';

export const ENGINE = 'Astronomy Engine 2.1.19';
export const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const source = 'https://github.com/cosinekitty/astronomy';

function validRange(start: Date, end: Date) {
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || +end <= +start || +end - +start > 400 * DAY) {
    throw new RangeError('Expected an increasing interval of at most 400 days.');
  }
}

export function isoSecond(ms: number): string {
  return new Date(Math.round(ms / 1000) * 1000).toISOString();
}

function event(type: string, kind: AstroEvent['kind'], label: string, time: Date, detail?: string): AstroEvent {
  const instantUtc = isoSecond(+time);
  return { id: `${type}-${instantUtc}`, type, kind, label, instantUtc, source, ...(detail ? { detail } : {}) };
}

/** Geocentric true equator/equinox of date. No observer latitude or horizon. */
export function lunarCoordinates(date: Date) {
  const moon = Astronomy.GeoMoon(date);
  const equatorial = Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), moon));
  const ecliptic = Astronomy.EclipticGeoMoon(date);
  const eqj = Astronomy.EquatorFromVector(moon);
  const constellation = Astronomy.Constellation(eqj.ra, eqj.dec);
  return {
    declinationDeg: equatorial.dec,
    distanceAu: moon.Length(),
    eclipticLongitudeDeg: ecliptic.lon,
    eclipticLatitudeDeg: ecliptic.lat,
    iauConstellation: constellation.symbol,
  };
}

export function declination(date: Date): number {
  const moon = Astronomy.GeoMoon(date);
  return Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), moon)).dec;
}

/** Symmetric five-minute difference; sign of geocentric north/south motion. */
export function declinationSlope(ms: number): number {
  return (declination(new Date(ms + 300_000)) - declination(new Date(ms - 300_000))) / 600;
}

function bracketRoot(fn: (ms: number) => number, low: number, high: number): number {
  let left = fn(low);
  const right = fn(high);
  if (left === 0) return low;
  if (right === 0) return high;
  if (left * right > 0) throw new Error('Root is not bracketed.');
  while (high - low > 500) {
    const middle = (low + high) / 2;
    const value = fn(middle);
    if (value === 0) return middle;
    if (left * value <= 0) high = middle;
    else { low = middle; left = value; }
  }
  return (low + high) / 2;
}

export function calculateDeclinationEvents(start: Date, end: Date): AstroEvent[] {
  validRange(start, end);
  const result: AstroEvent[] = [];
  let previous = +start;
  let slope = declinationSlope(previous);
  for (let next = Math.min(+start + 6 * HOUR, +end); previous < +end; next = Math.min(next + 6 * HOUR, +end)) {
    const nextSlope = declinationSlope(next);
    if (slope * nextSlope < 0) {
      const at = bracketRoot(declinationSlope, previous, next);
      const maximum = slope > 0;
      result.push(event(maximum ? 'declination_maximum' : 'declination_minimum', 'declination',
        maximum ? 'Declinação lunar máxima ao norte' : 'Declinação lunar máxima ao sul', new Date(at),
        'Mudança de direção norte–sul, calculada a partir do centro da Terra. Não é a altura da Lua no horizonte local.'));
    }
    previous = next; slope = nextSlope;
  }
  return result;
}

export function calculatePhaseEvents(start: Date, end: Date): AstroEvent[] {
  validRange(start, end);
  const types = ['new_moon', 'first_quarter', 'full_moon', 'last_quarter'];
  const labels = ['Lua nova', 'Quarto crescente', 'Lua cheia', 'Quarto minguante'];
  const result: AstroEvent[] = [];
  let quarter = Astronomy.SearchMoonQuarter(start);
  for (let count = 0; +quarter.time.date < +end && count < 65; count++) {
    result.push(event(types[quarter.quarter], 'phase', labels[quarter.quarter], quarter.time.date));
    quarter = Astronomy.NextMoonQuarter(quarter);
  }
  return result;
}

export function calculateNodeEvents(start: Date, end: Date): AstroEvent[] {
  validRange(start, end);
  const result: AstroEvent[] = [];
  let node = Astronomy.SearchMoonNode(start);
  for (let count = 0; +node.time.date < +end && count < 65; count++) {
    const ascending = node.kind === Astronomy.NodeEventKind.Ascending;
    result.push(event(ascending ? 'ascending_node' : 'descending_node', 'node',
      ascending ? 'Nodo lunar ascendente' : 'Nodo lunar descendente', node.time.date,
      ascending ? 'Travessia da eclíptica do sul para o norte; o nome é o mesmo nos dois hemisférios.' : 'Travessia da eclíptica do norte para o sul; o nome é o mesmo nos dois hemisférios.'));
    node = Astronomy.NextMoonNode(node);
  }
  return result;
}

export function calculateApsisEvents(start: Date, end: Date): AstroEvent[] {
  validRange(start, end);
  const result: AstroEvent[] = [];
  let apsis = Astronomy.SearchLunarApsis(start);
  for (let count = 0; +apsis.time.date < +end && count < 65; count++) {
    const perigee = apsis.kind === Astronomy.ApsisKind.Pericenter;
    result.push(event(perigee ? 'perigee' : 'apogee', 'apsis', perigee ? 'Perigeu lunar' : 'Apogeu lunar', apsis.time.date,
      `${perigee ? 'Menor' : 'Maior'} distância neste ciclo: aproximadamente ${Math.round(apsis.dist_km).toLocaleString('pt-BR')} km entre os centros da Terra e da Lua.`));
    apsis = Astronomy.NextLunarApsis(apsis);
  }
  return result;
}

export function calculateSeasonEvents(year: number): AstroEvent[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new RangeError('Unsupported season year.');
  const seasons = Astronomy.Seasons(year);
  return [
    event('march_equinox', 'season', 'Equinócio de março', seasons.mar_equinox.date),
    event('june_solstice', 'season', 'Solstício de junho', seasons.jun_solstice.date),
    event('september_equinox', 'season', 'Equinócio de setembro', seasons.sep_equinox.date),
    event('december_solstice', 'season', 'Solstício de dezembro', seasons.dec_solstice.date),
  ];
}

export function calculateMotionIntervals(start: Date, end: Date, turns: AstroEvent[]): CalendarInterval[] {
  validRange(start, end);
  const bounds = [+start, ...turns.map(e => +new Date(e.instantUtc)).filter(t => t > +start && t < +end), +end].sort((a, b) => a - b);
  return bounds.slice(0, -1).map((from, i) => {
    const to = bounds[i + 1];
    const northward = declinationSlope((from + to) / 2) > 0;
    return {
      id: `motion-${isoSecond(from)}`, startUtc: isoSecond(from), endUtc: isoSecond(to),
      kind: 'motion', direction: northward ? 'northward' : 'southward',
      label: northward ? 'Lua em direção ao norte' : 'Lua em direção ao sul',
      detail: 'Movimento da declinação geocêntrica, separado da fase e dos nodos lunares.',
    };
  });
}

export const CONSTELLATION_NAMES: Record<string, string> = {
  Ari: 'Áries', Tau: 'Touro', Gem: 'Gêmeos', Cnc: 'Câncer', Leo: 'Leão', Vir: 'Virgem',
  Lib: 'Libra', Sco: 'Escorpião', Oph: 'Ofiúco', Sgr: 'Sagitário', Cap: 'Capricórnio',
  Aqr: 'Aquário', Psc: 'Peixes', Cet: 'Baleia', Sex: 'Sextante', Ori: 'Órion', Aur: 'Cocheiro',
};

export function constellationAt(ms: number): string {
  const eqj = Astronomy.EquatorFromVector(Astronomy.GeoMoon(new Date(ms)));
  return Astronomy.Constellation(eqj.ra, eqj.dec).symbol;
}

/** Actual two-dimensional IAU sky regions, never substituted for Thun sectors. */
export function calculateConstellationIntervals(start: Date, end: Date): CalendarInterval[] {
  validRange(start, end);
  const result: CalendarInterval[] = [];
  let current = constellationAt(+start);
  let intervalStart = +start;
  let previous = +start;
  const push = (to: number) => result.push({
    id: `iau-${isoSecond(intervalStart)}`, kind: 'constellation',
    startUtc: isoSecond(intervalStart), endUtc: isoSecond(to), constellation: current,
    label: CONSTELLATION_NAMES[current] ?? current,
    detail: 'Região astronômica da IAU. Não determina um dia de raiz, folha, flor ou fruto neste aplicativo.',
  });
  // Ten-minute sampling brackets boundaries; refine a detected crossing to one second.
  for (let next = Math.min(+start + HOUR / 6, +end); previous < +end; next = Math.min(next + HOUR / 6, +end)) {
    const label = constellationAt(next);
    if (label !== current) {
      let lo = previous; let hi = next;
      while (hi - lo > 500) {
        const mid = (lo + hi) / 2;
        if (constellationAt(mid) === current) lo = mid; else hi = mid;
      }
      const crossing = (lo + hi) / 2;
      push(crossing); intervalStart = crossing; current = label;
    }
    previous = next;
  }
  push(+end);
  return result;
}
