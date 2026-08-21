import assert from 'node:assert/strict';
import test from 'node:test';

import { omiJsonFileName } from '../src/services/exportOmi.ts';

test('OMI JSON export creates a stable portable filename', () => {
  assert.equal(
    omiJsonFileName({ title: 'Árvíztűrő tükörfúrógép' }),
    'arvizturo-tukorfurogep.omi.json',
  );
  assert.equal(omiJsonFileName({ title: '' }), 'manuscript.omi.json');
});
