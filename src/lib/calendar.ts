import { Temporal } from '@js-temporal/polyfill';
import rawData from '../data/calendar-2027.json';
import { hemisphereMotion } from './tradition';
import type { CalendarData, CalendarInterval, DayPlan, Hemisphere } from './types';

export const COVERAGE_YEAR = 2027;
export const calendarData = rawData as CalendarData;

export function localDateKey(instant: string | Date, timeZone: string): string {
  return Temporal.Instant.from(instant instanceof Date ? instant.toISOString() : instant).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function localDayBounds(dateKey: string, timeZone: string): [number, number] {
  const date = Temporal.PlainDate.from(dateKey);
  return [date.toZonedDateTime(timeZone).epochMilliseconds, date.add({ days: 1 }).toZonedDateTime(timeZone).epochMilliseconds];
}

export function formatInstant(instantUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instantUtc));
}

export function formatTime(instantUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instantUtc));
}

export function formatDate(dateKey: string): string {
  return Temporal.PlainDate.from(dateKey).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatMonth(dateKey: string): string {
  return Temporal.PlainDate.from(dateKey).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

export function getInitialDate(timeZone: string, now = new Date()): string {
  const today = localDateKey(now, timeZone);
  return today.startsWith(`${COVERAGE_YEAR}-`) ? today : `${COVERAGE_YEAR}-01-01`;
}

export function shiftDateMonth(dateKey: string, delta: number): string {
  if (!Number.isInteger(delta)) throw new RangeError('Expected an integer month delta.');
  return Temporal.PlainDate.from(dateKey).add({ months: delta }).toString();
}

export function monthCells(dateKey: string): (string | null)[] {
  const first = Temporal.PlainDate.from(dateKey).with({ day: 1 });
  const cells: (string | null)[] = Array(first.dayOfWeek - 1).fill(null);
  for (let i = 0; i < first.daysInMonth; i++) cells.push(first.add({ days: i }).toString());
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function intersectIntervals(intervals: CalendarInterval[], start: number, end: number): CalendarInterval[] {
  if (end <= start) return [];
  return intervals.filter(i => Date.parse(i.startUtc) < end && Date.parse(i.endUtc) > start).map(i => ({
    ...i, startUtc: new Date(Math.max(start, Date.parse(i.startUtc))).toISOString(),
    endUtc: new Date(Math.min(end, Date.parse(i.endUtc))).toISOString(),
  }));
}

export function seasonAt(instantUtc: string, hemisphere: Hemisphere): string {
  if (hemisphere === 'equatorial') return 'Faixa equatorial: considere o regime local de chuva e seca.';
  const last = calendarData.events.filter(e => e.kind === 'season' && e.instantUtc <= instantUtc).at(-1);
  if (!last) return 'Estação astronômica indisponível.';
  const north: Record<string, string> = { march_equinox: 'Primavera', june_solstice: 'Verão', september_equinox: 'Outono', december_solstice: 'Inverno' };
  const south: Record<string, string> = { march_equinox: 'Outono', june_solstice: 'Inverno', september_equinox: 'Primavera', december_solstice: 'Verão' };
  const season = (hemisphere === 'north' ? north : south)[last.type];
  return `${season} ${season === 'Primavera' ? 'astronômica' : 'astronômico'} — hemisfério ${hemisphere === 'north' ? 'Norte' : 'Sul'}.`;
}

export function getDayPlan(dateKey: string, timeZone: string, hemisphere: Hemisphere): DayPlan {
  if (!['north', 'south', 'equatorial'].includes(hemisphere)) throw new RangeError('Unknown hemisphere.');
  const [start, end] = localDayBounds(dateKey, timeZone);
  const supported = Temporal.PlainDate.from(dateKey).year === COVERAGE_YEAR && start >= Date.parse(calendarData.startUtc) && end <= Date.parse(calendarData.endUtc) && end > start;
  const base: DayPlan = { dateKey, supported, timeZone, hemisphere, events: [], motion: [], constellations: [], cautions: [], nextPhase: null, seasonLabel: '', agriculturalStatus: 'unavailable' };
  if (!supported) return base;
  return {
    ...base,
    events: calendarData.events.filter(e => Date.parse(e.instantUtc) >= start && Date.parse(e.instantUtc) < end),
    motion: intersectIntervals(calendarData.motion, start, end).map(i => ({ ...i, ...hemisphereMotion(i.direction!, hemisphere) })),
    constellations: intersectIntervals(calendarData.constellations, start, end),
    cautions: intersectIntervals(calendarData.cautions, start, end),
    nextPhase: calendarData.events.find(e => e.kind === 'phase' && Date.parse(e.instantUtc) >= end) ?? null,
    seasonLabel: seasonAt(new Date((start + end) / 2).toISOString(), hemisphere),
  };
}
