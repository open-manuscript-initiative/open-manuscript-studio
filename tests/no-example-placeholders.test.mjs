import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOTS = ['src/auth', 'src/components'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function collectFiles(path) {
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return collectFiles(child);
    const dot = entry.name.lastIndexOf('.');
    return SOURCE_EXTENSIONS.has(dot >= 0 ? entry.name.slice(dot) : '') ? [child] : [];
  });
}

test('user-facing form fields do not contain concrete example data placeholders', () => {
  const violations = [];
  const literalExample = /placeholder\s*=\s*["'][^"']*(?:example\.(?:org|com|edu)|e\.g\.|z\.\s*B\.|például\s*:|pl\.\s|10\.1234\/example|archival-source,\s*book,\s*standard|model-name)["']/i;
  const translatedExample = /placeholder=\{(?:t\('(?:auth\.fields\.email\.placeholder|citations\.(?:locator|prefix|suffix)Placeholder)'\)|copy\.(?:namePlaceholder|termPlaceholder|listTitlePlaceholder|ojsNamePlaceholder|ompNamePlaceholder))\}/;

  for (const path of ROOTS.flatMap(collectFiles)) {
    const source = readFileSync(path, 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (literalExample.test(line) || translatedExample.test(line)) {
        violations.push(`${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  const extensionWorkspace = readFileSync('src/components/IntegrationExecutionWorkspace.tsx', 'utf8');
  for (const sample of [
    'org.example.scholar-service',
    'Example scholarly service',
    'https://example.org/api/lookup',
  ]) {
    if (extensionWorkspace.includes(sample)) {
      violations.push(`src/components/IntegrationExecutionWorkspace.tsx: prefilled example value "${sample}"`);
    }
  }

  assert.deepEqual(violations, []);
});
