import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPdfImportHeaders } from '../src/services/pdfImport.ts';

test('native PDF imports send the Studio session bearer token', () => {
  const headers = buildPdfImportHeaders(
    {
      Accept: 'application/json',
      'Content-Type': 'application/pdf',
    },
    true,
    'native-session-token',
  );

  assert.equal(headers.get('Authorization'), 'Bearer native-session-token');
  assert.equal(headers.get('X-OMI-Native-Client'), '1');
  assert.equal(headers.get('Content-Type'), 'application/pdf');
});

test('hosted PDF imports retain cookie authentication without native headers', () => {
  const headers = buildPdfImportHeaders(
    { Accept: 'application/json' },
    false,
    'must-not-be-exposed',
  );

  assert.equal(headers.get('Authorization'), null);
  assert.equal(headers.get('X-OMI-Native-Client'), null);
  assert.equal(headers.get('Accept'), 'application/json');
});
