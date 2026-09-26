import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSystemTimeZone,
  getTimeZoneOptions,
} from '../src/account/timeZones.ts';

test('time zone options use valid IANA identifiers with UTC offsets', () => {
  const options = getTimeZoneOptions('Europe/Budapest');
  const budapest = options.find((option) => option.id === 'Europe/Budapest');

  assert.ok(budapest);
  assert.match(budapest.label, /^Europe\/Budapest \(UTC[+-]\d{2}:\d{2}\)$/);

  const invalid = getTimeZoneOptions('Not/A_Time_Zone');
  assert.equal(invalid.some((option) => option.id === 'Not/A_Time_Zone'), false);
});

test('system time zone resolves to an available option', () => {
  const systemTimeZone = getSystemTimeZone();
  assert.equal(
    getTimeZoneOptions(systemTimeZone).some((option) => option.id === systemTimeZone),
    true,
  );
});
