import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  registerDeferredBlockEditorActivator,
  requestBlockEditorFocus,
} from '../src/editor/blockFocusRegistry.ts';
import {
  estimateDeferredStudyHeight,
  measureStudyMountWork,
  shouldProgressivelyMountStudyEditors,
} from '../src/editor/progressiveStudyMounting.ts';
import type { ManuscriptStudy } from '../src/model/sectionStructure.ts';

const continuousEditorSource = readFileSync(
  new URL('../src/components/ContinuousManuscriptEditor.tsx', import.meta.url),
  'utf8',
);
const searchOverlaySource = readFileSync(
  new URL('../src/components/SearchReplaceOverlayBase.tsx', import.meta.url),
  'utf8',
);

test('small volumes retain eager study editors', () => {
  const studies = Array.from({ length: 3 }, (_, index) =>
    createStudy(`study-${index}`, 4, 120),
  );

  assert.equal(shouldProgressivelyMountStudyEditors(studies), false);
  assert.deepEqual(measureStudyMountWork(studies), {
    editingUnits: 3,
    sections: 3,
    blocks: 12,
    estimatedModelBytes: 1_440,
  });
});

test('many, block-heavy, or model-heavy volumes use progressive mounting', () => {
  const manyStudies = Array.from({ length: 8 }, (_, index) =>
    createStudy(`study-${index}`, 1, 20),
  );
  const manyBlocks = [createStudy('block-heavy', 600, 1)];
  const modelHeavy = [createStudy('model-heavy', 1, 1_000_001)];

  assert.equal(shouldProgressivelyMountStudyEditors(manyStudies), true);
  assert.equal(shouldProgressivelyMountStudyEditors(manyBlocks), true);
  assert.equal(shouldProgressivelyMountStudyEditors(modelHeavy), true);
});

test('deferred study height is bounded for stable navigation', () => {
  assert.equal(estimateDeferredStudyHeight(createStudy('tiny', 1, 1)), 240);
  assert.equal(
    estimateDeferredStudyHeight(createStudy('huge', 2_000, 2_000)),
    120_000,
  );
});

test('a pending focus request activates the deferred editor that owns the block', () => {
  let requestedBlockId = '';
  const unregister = registerDeferredBlockEditorActivator((blockId) => {
    if (blockId !== 'deferred-block') return false;
    requestedBlockId = blockId;
    return true;
  });

  try {
    requestBlockEditorFocus('deferred-block', 'start');
    assert.equal(requestedBlockId, 'deferred-block');
  } finally {
    unregister();
  }
});

test('the volume UI mounts studies on selection, viewport entry, and navigation', () => {
  assert.match(
    continuousEditorSource,
    /shouldProgressivelyMountStudyEditors\(studies\)/,
  );
  assert.match(
    continuousEditorSource,
    /registerDeferredBlockEditorActivator/,
  );
  assert.match(continuousEditorSource, /new IntersectionObserver/);
  assert.match(continuousEditorSource, /rootMargin: '1800px 0px'/);
  assert.match(continuousEditorSource, /if \(active\).*<StudyEditor/s);
  assert.match(searchOverlaySource, /if \(sectionId\) state\.selectSection\(sectionId\)/);
  assert.match(
    searchOverlaySource,
    /attempt < 24[\s\S]*revealRenderedResult\(result, attempt \+ 1\)/,
  );
});

function createStudy(
  id: string,
  blockCount: number,
  contentLength: number,
): ManuscriptStudy {
  return {
    rootSectionId: id,
    sections: [{
      id,
      title: '',
      blocks: Array.from({ length: blockCount }, (_, index) => ({
        id: `${id}-block-${index}`,
        type: 'paragraph',
        content: 'x'.repeat(contentLength),
      })),
    }],
  };
}
