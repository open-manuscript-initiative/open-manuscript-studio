import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSystemTimeZone,
  getTimeZoneOptions,
  isValidTimeZone,
} from '../src/account/timeZones.ts';

test('time zone options use valid IANA identifiers with UTC offsets', () => {
  const options = getTimeZoneOptions('Europe/Budapest');
  const budapest = options.find((option) => option.id === 'Europe/Budapest');

  assert.ok(budapest);
  assert.match(budapest.label, /^Europe\/Budapest \(UTC[+-]\d{2}:\d{2}\)$/);
  assert.equal(isValidTimeZone(budapest.id), true);
  assert.equal(isValidTimeZone('Not/A_Time_Zone'), false);
});

test('system time zone resolves to a valid identifier', () => {
  assert.equal(isValidTimeZone(getSystemTimeZone()), true);
});
