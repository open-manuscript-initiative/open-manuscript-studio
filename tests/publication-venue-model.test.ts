import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isVerifiedPublicationVenue,
  normalizePublicationVenue,
} from '../src/model/scholarlyMetadata.ts';

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

test('preserves verified integration metadata and rejects unverified selection', () => {
  const verified = normalizePublicationVenue({
    id: 'venue-2',
    type: 'BOOK_PUBLISHER',
    name: 'Open Manuscript Press',
    integrationProvider: 'OMP',
    integrationStatus: 'VERIFIED',
  });
  assert.deepEqual(verified, {
    id: 'venue-2',
    type: 'BOOK_PUBLISHER',
    name: 'Open Manuscript Press',
    integrationProvider: 'OMP',
    integrationStatus: 'VERIFIED',
  });
  assert.equal(isVerifiedPublicationVenue(verified), true);
  assert.equal(
    isVerifiedPublicationVenue({
      ...verified!,
      integrationStatus: 'DISABLED',
    }),
    false,
  );
  assert.equal(
    isVerifiedPublicationVenue({
      id: 'venue-3',
      type: 'JOURNAL',
      name: 'Unverified Journal',
    }),
    false,
  );
});


test('preserves DNS-verified publication venue authority independently of OJS/OMP', () => {
  const verified = normalizePublicationVenue({
    id: 'venue-dns-1',
    type: 'JOURNAL',
    name: 'Domain Verified Journal',
    website: 'https://journal.example.org',
    authority: {
      method: 'DNS_TXT',
      status: 'VERIFIED',
      domain: 'journal.example.org',
      verificationId: '40000000-0000-4000-8000-000000000004',
      verifiedAt: '2026-09-23T07:15:00.000Z',
    },
  });

  assert.deepEqual(verified, {
    id: 'venue-dns-1',
    type: 'JOURNAL',
    name: 'Domain Verified Journal',
    website: 'https://journal.example.org',
    authority: {
      method: 'DNS_TXT',
      status: 'VERIFIED',
      domain: 'journal.example.org',
      verificationId: '40000000-0000-4000-8000-000000000004',
      verifiedAt: '2026-09-23T07:15:00.000Z',
    },
  });
  assert.equal(isVerifiedPublicationVenue(verified), true);
});
