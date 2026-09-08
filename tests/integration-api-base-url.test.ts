import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeIntegrationApiBaseUrl } from '../src/services/integrationApiBaseUrl.ts';

test('production registration targets the authenticated Studio API', () => {
  const env = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
  const configured = env.match(/^VITE_API_BASE_URL=(.+)$/m)?.[1];
  assert.ok(configured);
  assert.equal(
    `${normalizeIntegrationApiBaseUrl(configured)}/integrations/ojs/publishing-connections`,
    'https://studio.openmanuscript.org/api/integrations/ojs/publishing-connections',
  );
});

test('explicit API paths, native defaults and relative deployments retain one API prefix', () => {
  for (const [input, expected] of [
    ['/api', '/api'],
    ['', '/api'],
    ['/', '/api'],
    [' https://studio.openmanuscript.org/api/// ', 'https://studio.openmanuscript.org/api'],
    ['https://example.org/studio/', 'https://example.org/studio/api'],
    ['/studio/api/', '/studio/api'],
  ]) {
    assert.equal(normalizeIntegrationApiBaseUrl(input), expected);
  }
});
