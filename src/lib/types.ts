export type Hemisphere = 'south' | 'north' | 'equatorial';
export type EventKind = 'phase' | 'node' | 'apsis' | 'declination' | 'season' | 'eclipse';
export interface AstroEvent {
  id: string; kind: EventKind; type: string; label: string; instantUtc: string;
  source: string; detail?: string;
}
export interface CalendarInterval {
  id: string; startUtc: string; endUtc: string; label: string; detail: string;
  kind: 'motion' | 'constellation' | 'caution';
  direction?: 'northward' | 'southward';
  constellation?: string;
}
export interface DayPlan {
  dateKey: string; supported: boolean; timeZone: string; hemisphere: Hemisphere;
  events: AstroEvent[]; motion: CalendarInterval[]; constellations: CalendarInterval[];
  cautions: CalendarInterval[];
  nextPhase: AstroEvent | null;
  seasonLabel: string;
  agriculturalStatus: 'unavailable';
}
export interface CalendarData {
  schemaVersion: 1; year: number; startUtc: string; endUtc: string;
  engine: string; methodVersion: string;
  events: AstroEvent[]; motion: CalendarInterval[];
  constellations: CalendarInterval[]; cautions: CalendarInterval[];
}
