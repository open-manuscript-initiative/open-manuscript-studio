import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOrcidSearchUrl,
  normalizeOrcidId,
  parseOrcidCsv,
} from '../src/services/orcidLookup.ts';

test('builds a public browser-safe ORCID CSV search by contributor name', () => {
  const url = new URL(buildOrcidSearchUrl({
    givenName: 'Jane',
    familyName: 'Smith',
  }));

  assert.equal(url.origin, 'https://pub.orcid.org');
  assert.equal(url.pathname, '/v3.0/csv-search/');
  assert.match(url.searchParams.get('q') ?? '', /given-names:"Jane"/);
  assert.match(url.searchParams.get('q') ?? '', /family-name:"Smith"/);
  assert.equal(url.searchParams.get('rows'), '8');
  assert.match(url.searchParams.get('fl') ?? '', /orcid/);
});

test('uses a linked ROR identifier to disambiguate ORCID candidates', () => {
  const url = new URL(buildOrcidSearchUrl({
    givenName: 'Jane',
    familyName: 'Smith',
    affiliation: 'Example University',
    rorId: 'https://ror.org/03yrm5c26',
  }));

  const query = url.searchParams.get('q') ?? '';
  assert.match(query, /ror-org-id:"https:\/\/ror\.org\/03yrm5c26"/);
  assert.ok(!query.includes('affiliation-org-name'));
});

test('falls back to affiliation name when no ROR identifier is present', () => {
  const url = new URL(buildOrcidSearchUrl({
    givenName: 'Jane',
    familyName: 'Smith',
    affiliation: 'Example University',
  }));

  assert.match(
    url.searchParams.get('q') ?? '',
    /affiliation-org-name:"Example University"/,
  );
});

test('parses quoted ORCID CSV results into clickable person suggestions', () => {
  const csv = [
    'orcid,given-names,family-name,credit-name,current-institution-affiliation-name,past-institution-affiliation-name',
    '0000-0002-1825-0097,Jane,Smith,"J. Smith","Example University, Faculty of Arts",Old Institute',
  ].join('\n');

  const results = parseOrcidCsv(csv);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.orcid, '0000-0002-1825-0097');
  assert.equal(results[0]?.creditName, 'J. Smith');
  assert.equal(results[0]?.currentInstitution, 'Example University, Faculty of Arts');
  assert.equal(results[0]?.profileUrl, 'https://orcid.org/0000-0002-1825-0097');
});

test('normalizes ORCID URL forms without claiming authentication', () => {
  assert.equal(
    normalizeOrcidId('https://orcid.org/0000-0002-1825-0097'),
    '0000-0002-1825-0097',
  );
  assert.equal(
    normalizeOrcidId('orcid.org/0000-0002-1825-009x'),
    '0000-0002-1825-009X',
  );
});
