import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { runModelAssessment } from '../src/model/conformance.ts';

const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const report = runModelAssessment({ name: 'Open Manuscript Studio', version: metadata.version,
  build: process.env.GITHUB_RUN_NUMBER ?? 'local', revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dependencies: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
}, `node:${process.version};platform:${process.platform};arch:${process.arch}`);
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/draft-model-assessment.json', JSON.stringify(report, null, 2));
console.log(`Draft model self-assessment: ${report.evidence.outcome}; ${report.evidence.results.length} cases; ${report.evidence.coverage.length} requirements accounted for.`);
if (report.evidence.results.some((item) => item.status !== 'pass')) process.exitCode = 1;
