import assert from 'node:assert/strict';
import test from 'node:test';
import { findPublicationNoteLine, type PublicationFlowLine } from '../src/components/publicationPageLayout.ts';

// Recorded at the note-5 boundary in the browser's 18-note stress fixture.
const measured: PublicationFlowLine[] = [
  { textOffset: 425, top: 114.703125, height: 19 },
  { textOffset: 487, top: 131.375, height: 19 },
  { textOffset: 549, top: 150.703125, height: 19 },
];
const marker = { top: 150.046875, bottom: 162.140625 };

test('a raised note marker belongs to the current line when its top overlaps the preceding line', () => {
  assert.ok(marker.top < measured[1]!.top + measured[1]!.height);
  assert.ok(marker.top < measured[2]!.top);
  assert.equal(findPublicationNoteLine(measured, marker.bottom)?.textOffset, 549);
});

test('note line ownership is stable under fractional zoom and sheet translation', () => {
  for (const scale of [0.5, 0.75, 1, 2]) {
    for (const shift of [0, 500.25]) {
      const lines = measured.map(line => ({ ...line, top: line.top * scale + shift, height: line.height * scale }));
      assert.equal(findPublicationNoteLine(lines, marker.bottom * scale + shift)?.textOffset, 549);
    }
  }
});

test('note markers in table row units retain the row containing their lower edge', () => {
  const rows = [{ textOffset: 0, top: 0, height: 30 }, { textOffset: 1, top: 30, height: 30 }];
  assert.strictEqual(findPublicationNoteLine(rows, 36), rows[1]);
  assert.strictEqual(findPublicationNoteLine(rows, 20), rows[0]);
});

test('empty lines and markers outside or between measured ranges have bounded fallback behavior', () => {
  assert.equal(findPublicationNoteLine([], 10), undefined);
  const lines = [{ textOffset: 0, top: 10, height: 10 }, { textOffset: 20, top: 40, height: 10 }];
  assert.strictEqual(findPublicationNoteLine(lines, 0), lines[0]);
  assert.strictEqual(findPublicationNoteLine(lines, 70), lines[1]);
  assert.strictEqual(findPublicationNoteLine(lines, 35), lines[1]);
});
