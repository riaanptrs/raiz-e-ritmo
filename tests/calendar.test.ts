import { describe, expect, it } from 'vitest';
import { calendarData, getDayPlan, getInitialDate, intersectIntervals, localDateKey, localDayBounds, monthCells, seasonAt, shiftDateMonth } from '../src/lib/calendar';
import { buildCautionIntervals, hemisphereMotion } from '../src/lib/tradition';
import type { AstroEvent, CalendarInterval } from '../src/lib/types';

describe('local calendar dates and daylight saving', () => {
  it('places a midnight-UTC full Moon on the previous Brazilian date', () => {
    expect(localDateKey('2027-06-19T00:44:00Z', 'America/Sao_Paulo')).toBe('2027-06-18');
    expect(getDayPlan('2027-06-18', 'America/Sao_Paulo', 'south').events.some(e => e.type === 'full_moon')).toBe(true);
    expect(getDayPlan('2027-06-19', 'America/Sao_Paulo', 'south').events.some(e => e.type === 'full_moon')).toBe(false);
    expect(getDayPlan('2027-06-19', 'UTC', 'south').events.some(e => e.type === 'full_moon')).toBe(true);
  });
  it('uses actual 23-hour and 25-hour days, including half-hour DST changes', () => {
    const hours = (date: string, zone: string) => { const [a, b] = localDayBounds(date, zone); return (b - a) / 3_600_000; };
    expect(hours('2027-03-14', 'America/New_York')).toBe(23);
    expect(hours('2027-11-07', 'America/New_York')).toBe(25);
    expect(hours('2027-04-04', 'Australia/Lord_Howe')).toBe(24.5);
    expect(hours('2027-10-03', 'Australia/Lord_Howe')).toBe(23.5);
  });
  it('covers local year edges in opposite extreme time zones without inventing 2028 coverage', () => {
    for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      for (const day of ['2027-01-01', '2027-12-31']) {
        const plan = getDayPlan(day, zone, 'equatorial');
        expect(plan.supported).toBe(true);
        const [start, end] = localDayBounds(day, zone);
        for (const family of [plan.motion, plan.constellations]) {
          expect(Date.parse(family[0].startUtc)).toBe(start);
          expect(Date.parse(family.at(-1)!.endUtc)).toBe(end);
        }
      }
    }
    expect(getDayPlan('2028-01-01', 'UTC', 'north').supported).toBe(false);
    expect(getDayPlan('2028-01-01', 'UTC', 'north').events).toEqual([]);
  });
  it('shows December phases on the correct local date and continues into January', () => {
    const christmasEve = getDayPlan('2026-12-24', 'UTC', 'south');
    expect(christmasEve.events).toEqual([expect.objectContaining({
      type: 'full_moon', instantUtc: '2026-12-24T01:28:00Z',
    })]);
    const brazil = getDayPlan('2026-12-23', 'America/Sao_Paulo', 'south');
    expect(brazil.events).toEqual(christmasEve.events);
    expect(brazil.cautions).toEqual([]);
    expect(getDayPlan('2026-12-31', 'Pacific/Kiritimati', 'south').events)
      .toContainEqual(expect.objectContaining({ type: 'last_quarter' }));
    expect(getDayPlan('2026-12-31', 'UTC', 'south').nextPhase)
      .toMatchObject({ type: 'new_moon', instantUtc: '2027-01-07T20:24:00Z' });
    expect(getDayPlan('2026-11-30', 'UTC', 'south').supported).toBe(false);
  });
  it('uses the published December solstice minute for both hemisphere season labels', () => {
    expect(seasonAt('2026-12-21T20:49:59Z', 'south')).toContain('Primavera');
    expect(seasonAt('2026-12-21T20:50:00Z', 'south')).toContain('Verão');
    expect(seasonAt('2026-12-21T20:50:00Z', 'north')).toContain('Inverno');
  });
  it('rejects invalid dates and IANA zones', () => {
    expect(() => getDayPlan('2027-02-30', 'UTC', 'south')).toThrow();
    expect(() => getDayPlan('2027-01-01', 'Not/A_Zone', 'south')).toThrow();
  });
  it('starts outside coverage at December 2026 and navigates months correctly', () => {
    expect(getInitialDate('America/Sao_Paulo', new Date('2026-11-26T12:00:00Z'))).toBe('2026-12-01');
    expect(getInitialDate('America/Sao_Paulo', new Date('2027-06-19T00:44:00Z'))).toBe('2027-06-18');
    expect(shiftDateMonth('2027-01-31', 1)).toBe('2027-02-28');
    expect(shiftDateMonth('2027-12-15', 1)).toBe('2028-01-15');
    const cells = monthCells('2027-02-01');
    expect(cells).toHaveLength(28);
    expect(cells[0]).toBe('2027-02-01');
    expect(monthCells('2027-01-01')[4]).toBe('2027-01-01');
  });
});

describe('hemisphere interpretation remains separate from astronomy', () => {
  it('flips ascent/descent labels, never events or times', () => {
    const south = getDayPlan('2027-01-10', 'UTC', 'south');
    const north = getDayPlan('2027-01-10', 'UTC', 'north');
    expect(south.events).toEqual(north.events);
    expect(south.constellations).toEqual(north.constellations);
    expect(south.cautions).toEqual(north.cautions);
    expect(south.motion[0].direction).toBe(north.motion[0].direction);
    expect(south.motion[0].startUtc).toBe(north.motion[0].startUtc);
    expect(south.motion[0].label).toContain('Descendente');
    expect(north.motion[0].label).toContain('Ascendente');
    expect(south.events.find(e => e.type === 'ascending_node')?.label).toBe('Nodo lunar ascendente');
  });
  it('uses neutral north/south wording at the equator and supports both directions', () => {
    expect(hemisphereMotion('northward', 'equatorial').label).toBe('Lua em direção ao norte');
    expect(hemisphereMotion('southward', 'south').label).toContain('Ascendente');
    expect(hemisphereMotion('southward', 'north').label).toContain('Descendente');
    expect(hemisphereMotion('northward', 'south').detail).toContain('não reproduz');
  });
  it('flips astronomical seasons without inventing a crop season', () => {
    expect(seasonAt('2027-07-01T12:00:00Z', 'south')).toContain('Inverno');
    expect(seasonAt('2027-07-01T12:00:00Z', 'north')).toContain('Verão');
    expect(seasonAt('2027-07-01T12:00:00Z', 'equatorial')).toContain('chuva e seca');
  });
  it('splits the local day at a declination turn instead of assigning one whole-day label', () => {
    const plan = getDayPlan('2027-01-05', 'UTC', 'south');
    expect(plan.motion).toHaveLength(2);
    expect(plan.motion[0].endUtc).toBe(plan.motion[1].startUtc);
    expect(plan.motion[0].direction).not.toBe(plan.motion[1].direction);
  });
});

describe('partial traditional windows and unsupported categories', () => {
  const event = (type: string): AstroEvent => ({ id: type, type, kind: 'node', label: type, source: 'test fixture', instantUtc: '2027-01-10T01:00:00Z' });
  it('implements exact elapsed-time node/perigee buffers with no extra inferred factors', () => {
    const intervals = buildCautionIntervals([event('ascending_node'), event('perigee'), event('full_moon'), event('apogee')]);
    expect(intervals).toHaveLength(2);
    const node = intervals.find(i => i.label.startsWith('Nodo'))!;
    expect(node.startUtc).toBe('2027-01-09T23:00:00.000Z');
    expect(node.endUtc).toBe('2027-01-10T03:00:00.000Z');
    const perigee = intervals.find(i => i.label.startsWith('Perigeu'))!;
    expect(Date.parse(perigee.endUtc) - Date.parse(perigee.startUtc)).toBe(24 * 3_600_000);
  });
  it('clips overlapping windows across midnight and uses half-open endpoints', () => {
    const interval: CalendarInterval = { id: 'one', kind: 'caution', label: 'test', detail: 'test', startUtc: '2027-01-01T23:00:00Z', endUtc: '2027-01-02T01:00:00Z' };
    const [start, end] = localDayBounds('2027-01-02', 'UTC');
    expect(intersectIntervals([interval], start, end)[0].startUtc).toBe('2027-01-02T00:00:00.000Z');
    expect(intersectIntervals([interval], Date.parse(interval.endUtc), end)).toEqual([]);
  });
  it('never turns an IAU region or an empty caution list into an agricultural recommendation', () => {
    const regions = new Set(calendarData.constellations.map(i => i.constellation));
    expect(regions.has('Oph')).toBe(true);
    expect(regions.has('Sex')).toBe(true);
    for (let month = 1; month <= 12; month++) {
      const day = getDayPlan(`2027-${String(month).padStart(2, '0')}-15`, 'UTC', 'south');
      expect(day.agriculturalStatus).toBe('unavailable');
      expect(day.constellations.every(i => !('agriculturalCategory' in i))).toBe(true);
    }
  });
  it('has continuous intervals, no duplicate event IDs and all 49 preserved phase events', () => {
    for (const intervals of [calendarData.motion, calendarData.constellations]) {
      for (let i = 1; i < intervals.length; i++) expect(intervals[i - 1].endUtc).toBe(intervals[i].startUtc);
      expect(intervals.every(i => Date.parse(i.endUtc) > Date.parse(i.startUtc))).toBe(true);
    }
    expect(new Set(calendarData.events.map(e => e.id)).size).toBe(calendarData.events.length);
    expect(calendarData.events.filter(e => e.kind === 'phase' && e.instantUtc.startsWith('2027-'))).toHaveLength(49);
  });
});
