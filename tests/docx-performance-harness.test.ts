import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  benchmarkDocxImport,
} from '../scripts/benchmark-docx-import.ts';
import {
  createSyntheticDocxBytes,
} from '../scripts/generate-docx-stress-fixture.ts';

test('synthetic DOCX benchmark reports only metrics and preserves editor semantics', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omi-docx-benchmark-'));
  const input = join(directory, 'private-title-and-author.docx');
  try {
    await writeFile(input, createSyntheticDocxBytes({
      targetWords: 1_600,
      wordsPerParagraph: 40,
      headingEvery: 10,
      noteEvery: 5,
    }));

    const result = await benchmarkDocxImport({
      input,
      assertRoundTrip: true,
    });
    const serialized = JSON.stringify(result);

    assert.match(result.label, /^sha256-[0-9a-f]{12}$/);
    assert.equal(result.privacy.inputNameRedacted, true);
    assert.equal(result.privacy.contentEmitted, false);
    assert.equal(result.roundTrip.ok, true);
    assert.equal(result.import.annotations, 7);
    assert.equal(result.editorMounting.progressiveRecommended, false);
    assert.ok(result.editorMounting.editingUnits > 0);
    assert.ok(
      result.editorMounting.initiallySelectedUnitJsonBytes
        <= result.editorMounting.allUnitsJsonBytes,
    );
    assert.ok(result.sourceMetrics.words >= 1_600);
    assert.doesNotMatch(serialized, /private-title-and-author/);
    assert.doesNotMatch(serialized, /Synthetic chapter/);
    assert.doesNotMatch(serialized, /manuscript archive metadata/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
