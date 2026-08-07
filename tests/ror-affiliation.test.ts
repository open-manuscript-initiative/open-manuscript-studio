import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPersonAgent,
  getPrimaryAffiliationRorId,
  normalizeRorId,
  ROR_API_SOURCE,
  updatePersonAgent,
} from '../src/model/identity.ts';
import {
  buildRorSearchUrl,
  mapRorOrganization,
} from '../src/services/rorLookup.ts';

test('builds ROR typeahead queries with the v2 query parameter', () => {
  const url = new URL(buildRorSearchUrl('Eötvös Loránd University'));

  assert.equal(url.origin, 'https://api.ror.org');
  assert.equal(url.pathname, '/v2/organizations');
  assert.equal(url.searchParams.get('query'), 'Eötvös Loránd University');
  assert.equal(url.searchParams.has('affiliation'), false);
});

test('maps the ROR v2 display name and location for clickable suggestions', () => {
  const suggestion = mapRorOrganization({
    id: 'https://ror.org/01jsq2704',
    status: 'active',
    names: [
      {
        value: 'ELTE',
        types: ['acronym'],
        lang: 'hu',
      },
      {
        value: 'Eötvös Loránd University',
        types: ['ror_display', 'label'],
        lang: 'en',
      },
    ],
    locations: [
      {
        geonames_details: {
          name: 'Budapest',
          country_name: 'Hungary',
          country_code: 'HU',
        },
      },
    ],
    types: ['education'],
  });

  assert.deepEqual(suggestion, {
    id: 'https://ror.org/01jsq2704',
    displayName: 'Eötvös Loránd University',
    city: 'Budapest',
    country: 'Hungary',
    countryCode: 'HU',
    types: ['education'],
  });
});

test('normalizes supported ROR identifier forms to the preferred full URL', () => {
  assert.equal(
    normalizeRorId('https://ror.org/01jsq2704'),
    'https://ror.org/01jsq2704',
  );
  assert.equal(
    normalizeRorId('ror.org/01jsq2704'),
    'https://ror.org/01jsq2704',
  );
  assert.equal(
    normalizeRorId('01jsq2704'),
    'https://ror.org/01jsq2704',
  );
  assert.equal(normalizeRorId('not-a-ror-id'), '');
});

test('stores a selected ROR record on the affiliation assertion, not on the person', () => {
  const agent = createPersonAgent(
    {
      givenName: 'Judit',
      familyName: 'Balogh',
      affiliation: 'ELTE',
    },
    'agent-1',
    '2026-08-07T08:00:00.000Z',
  );
  const updated = updatePersonAgent(
    agent,
    {
      affiliation: 'Eötvös Loránd University',
      affiliationRorId: 'https://ror.org/01jsq2704',
    },
    '2026-08-07T08:01:00.000Z',
  );
  const affiliation = updated.affiliations[0];

  assert.equal(affiliation?.organizationName, 'Eötvös Loránd University');
  assert.equal(
    affiliation?.organizationIdentifier?.scheme,
    'ror',
  );
  assert.equal(
    affiliation?.organizationIdentifier?.normalizedValue,
    'https://ror.org/01jsq2704',
  );
  assert.equal(
    affiliation?.organizationIdentifier?.verificationStatus,
    'verified',
  );
  assert.equal(affiliation?.organizationIdentifier?.source, ROR_API_SOURCE);
  assert.equal(affiliation?.source, ROR_API_SOURCE);
  assert.equal(getPrimaryAffiliationRorId(updated), 'https://ror.org/01jsq2704');
  assert.equal(updated.identifiers.some((identifier) => identifier.scheme === 'ror'), false);
});

test('manual affiliation edits clear a previously selected ROR link', () => {
  const agent = createPersonAgent(
    {
      givenName: 'Ada',
      familyName: 'Author',
      affiliation: 'Example University',
    },
    'agent-2',
    '2026-08-07T08:00:00.000Z',
  );
  const linked = updatePersonAgent(
    agent,
    {
      affiliation: 'Eötvös Loránd University',
      affiliationRorId: '01jsq2704',
    },
    '2026-08-07T08:01:00.000Z',
  );
  const manuallyEdited = updatePersonAgent(
    linked,
    {
      affiliation: 'Eötvös Loránd University, Faculty of Humanities',
      affiliationRorId: null,
    },
    '2026-08-07T08:02:00.000Z',
  );

  assert.equal(getPrimaryAffiliationRorId(manuallyEdited), '');
  assert.equal(manuallyEdited.affiliations[0]?.organizationIdentifier, undefined);
  assert.equal(manuallyEdited.affiliations[0]?.source, undefined);
});
