import { mkdirSync, writeFileSync } from 'node:fs';
import { buildValidationReport } from './astronomy-validation';

const report = buildValidationReport();
mkdirSync('data/validation', { recursive: true });
writeFileSync('data/validation/astronomy-2027.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, ...report.summary,
  excludedLibraryApsides: { ...report.excludedLibraryDiagnostics.lunarApsides, results: undefined } }, null, 2));
if (!report.passed) process.exitCode = 1;
