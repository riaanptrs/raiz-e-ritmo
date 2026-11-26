import { describe, expect, it } from 'vitest';
import { buildValidationReport } from '../scripts/astronomy-validation';
import { getDayPlan } from '../src/lib/calendar';

describe('astronomy release checks against external reference fixtures', () => {
  const report = buildValidationReport();
  it('meets the declared numerical limits for the actual shipped data', () => {
    expect(report.passed).toBe(true);
    expect(Object.values(report.summary).filter(result => !result.passed)).toEqual([]);
  });
  it('preserves the failed library diagnostic without using it in production', () => {
    const diagnostic = report.excludedLibraryDiagnostics.lunarApsides;
    expect(diagnostic.selectedForProduction).toBe(false);
    expect(diagnostic.passed).toBe(false);
    expect(diagnostic.results.filter(r => !r.passed)).toHaveLength(3);
    expect(report.summary.apsisSourceIntegrity.passed).toBe(true);
    expect(report.productionApsisResults.every(r => r.differenceSeconds < 1)).toBe(true);
  });
  it('includes the independently sampled boundary apogee on the final local day', () => {
    const west = getDayPlan('2027-12-31', 'Pacific/Pago_Pago', 'south');
    const boundary = west.events.find(e => e.type === 'apogee');
    expect(boundary?.instantUtc).toBe('2028-01-01T03:59:18Z');
    expect(boundary?.source).toContain('ssd.jpl.nasa.gov');
    expect(report.summary.boundaryApsides.passed).toBe(true);
  });
});
