import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePublicationVenue } from '../src/model/scholarlyMetadata.ts';

test('normalizes a portable publication venue reference', () => {
  assert.deepEqual(
    normalizePublicationVenue({
      id: ' venue-1 ',
      type: 'JOURNAL',
      name: '  Open   Manuscript Review  ',
      website: ' https://example.org ',
      issn: ' 1234-5678 ',
    }),
    {
      id: 'venue-1',
      type: 'JOURNAL',
      name: 'Open Manuscript Review',
      website: 'https://example.org',
      issn: '1234-5678',
    },
  );
});

test('rejects incomplete or unknown publication venue references', () => {
  assert.equal(normalizePublicationVenue({ id: 'venue-1', name: 'Missing type' }), undefined);
  assert.equal(normalizePublicationVenue({ id: 'venue-1', type: 'MAGAZINE', name: 'Unknown type' }), undefined);
  assert.equal(normalizePublicationVenue({ id: '', type: 'JOURNAL', name: 'Missing id' }), undefined);
});
