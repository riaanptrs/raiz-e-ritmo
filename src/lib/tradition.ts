import type { AstroEvent, CalendarInterval, Hemisphere } from './types';

/** A deliberately partial, separately versioned transcription of two public rules. */
export const TRADITION_PROFILE = {
  id: 'stella-natura-lunar-cautions-partial-v1',
  label: 'Stella Natura — duas regras lunares (parcial)',
  source: 'https://stellanatura.com/use.html',
  sourceEdition: 'Using the Stella Natura 2024 — Sherry Wildfeuer',
  lunarNodeHoursBefore: 2, lunarNodeHoursAfter: 2,
  perigeeHoursBefore: 12, perigeeHoursAfter: 12,
  intervalSemantics: '[start, end)',
  sourceRounding: 'Windows centered on our computed event rounded to the nearest second; publisher hour rounding is not replicated.',
  omitted: ['constellation-change buffers', 'Mercury/Venus nodes', 'eclipse windows', 'planetary aspects', 'apogee overrides', 'publisher-specific transplanting windows'],
  efficacy: 'traditional recommendation; numerical reproducibility is not proof of agricultural efficacy',
} as const;

export function buildCautionIntervals(events: AstroEvent[]): CalendarInterval[] {
  const result: CalendarInterval[] = [];
  for (const event of events) {
    const node = event.type === 'ascending_node' || event.type === 'descending_node';
    const perigee = event.type === 'perigee';
    if (!node && !perigee) continue;
    const hours = node ? TRADITION_PROFILE.lunarNodeHoursBefore : TRADITION_PROFILE.perigeeHoursBefore;
    const hoursAfter = node ? TRADITION_PROFILE.lunarNodeHoursAfter : TRADITION_PROFILE.perigeeHoursAfter;
    const at = Date.parse(event.instantUtc);
    result.push({
      id: `${TRADITION_PROFILE.id}-${event.id}`, kind: 'caution',
      startUtc: new Date(at - hours * 3_600_000).toISOString(),
      endUtc: new Date(at + hoursAfter * 3_600_000).toISOString(),
      label: node ? 'Nodo lunar · intervalo tradicional' : 'Perigeu · intervalo tradicional',
      detail: `Stella Natura sugere evitar a semeadura nas ${hours} horas antes e depois deste evento. Regra tradicional, não dano comprovado. Este perfil cobre apenas nodos lunares e perigeus.`,
    });
  }
  return result.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

/** Labels only: never changes the event's instant, declination, node name or phase. */
export function hemisphereMotion(direction: 'northward' | 'southward', hemisphere: Hemisphere): { label: string; detail: string } {
  const raw = direction === 'northward' ? 'ao norte' : 'ao sul';
  if (hemisphere === 'equatorial') return { label: `Lua em direção ${raw}`, detail: 'Faixa equatorial: mostramos a direção da declinação, sem atribuir um sentido local universal de subida ou descida.' };
  const ascending = hemisphere === 'north' ? direction === 'northward' : direction === 'southward';
  const name = hemisphere === 'north' ? 'Norte' : 'Sul';
  return {
    label: `${ascending ? 'Ascendente' : 'Descendente'} na convenção do hemisfério ${name}`,
    detail: `Declinação em direção ${raw}. A interpretação biodinâmica é invertida entre Norte e Sul. Este intervalo astronômico não reproduz as margens de transplante de uma editora, nem prevê a altura local da Lua.`,
  };
}
