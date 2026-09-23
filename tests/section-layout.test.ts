import assert from 'node:assert/strict';
import test from 'node:test';

import {
  nextTabStopMm,
  normalizeSectionLayout,
  normalizeTabStops,
  toggleTabStop,
} from '../src/model/sectionLayout.ts';

test('normalizes portable section layout and keeps ordered tab stops', () => {
  assert.deepEqual(
    normalizeSectionLayout({
      columns: 3,
      columnGapMm: 9.5,
      tabStopsMm: [40, 20, 20, -1, 300],
    }),
    {
      columns: 3,
      columnGapMm: 9.5,
      tabStopsMm: [20, 40],
    },
  );

  assert.equal(normalizeSectionLayout({ columns: 1 }), undefined);
  assert.deepEqual(normalizeTabStops([12.54, 12.55, 25]), [12.5, 12.6, 25]);
});

test('ruler tab stop toggling snaps by proximity without duplicating positions', () => {
  assert.deepEqual(toggleTabStop([20, 40], 60), [20, 40, 60]);
  assert.deepEqual(toggleTabStop([20, 40], 40.8), [20]);
});

test('resolves the next explicit tab stop and falls back to the default interval', () => {
  assert.equal(nextTabStopMm([20, 45, 80], 12), 20);
  assert.equal(nextTabStopMm([20, 45, 80], 20), 45);
  assert.equal(nextTabStopMm([20, 45, 80], 82), 87.5);
  assert.equal(nextTabStopMm(undefined, 0), 12.5);
});
