import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNoInvalidRevisionStateDigests,
  ensureManuscriptRevisionStateDigests,
  getRevisionStateDigest,
  inspectRevisionHistoryIntegrity,
} from '../src/model/revisionIntegrity.ts';
import {
  calculateManuscriptStateDigestValue,
  canonicalizeManuscriptState,
  sha256HexSync,
} from '../src/model/stateDigest.ts';
import {
  commitManuscriptRevision,
  extractManuscriptState,
} from '../src/model/versioning.ts';
import type { OmiManuscript, OmiManuscriptState } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('synchronous SHA-256 matches the standard abc test vector', () => {
  assert.equal(
    sha256HexSync(new TextEncoder().encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('canonical manuscript JSON is independent from object insertion order', () => {
  const state = extractManuscriptState(createVersionedTestManuscript());
  const reversed = Object.fromEntries(
    Object.entries(state).reverse(),
  ) as unknown as OmiManuscriptState;

  assert.equal(
    canonicalizeManuscriptState(state),
    canonicalizeManuscriptState(reversed),
  );
  assert.equal(
    calculateManuscriptStateDigestValue(state),
    calculateManuscriptStateDigestValue(reversed),
  );
});

test('semantic collection order and content changes alter the state digest', () => {
  const state = extractManuscriptState(createVersionedTestManuscript());
  const reordered: OmiManuscriptState = {
    ...state,
    keywords: [...state.keywords].reverse(),
  };
  const retitled: OmiManuscriptState = {
    ...state,
    title: `${state.title} revised`,
  };

  const original = calculateManuscriptStateDigestValue(state);
  assert.notEqual(calculateManuscriptStateDigestValue(reordered), original);
  assert.notEqual(calculateManuscriptStateDigestValue(retitled), original);
});

test('asset-backed authoring preview data is excluded from canonical state', () => {
  const state = extractManuscriptState(createVersionedTestManuscript());
  const baseImage = {
    id: 'figure-block',
    type: 'image',
    content: '',
    visual: {
      kind: 'image' as const,
      assetId: 'asset-1',
      src: '',
      mediaType: 'image/png',
      fileName: 'figure.png',
      alt: 'A figure',
    },
  };
  const withoutPreview: OmiManuscriptState = {
    ...state,
    sections: state.sections.map((section, index) =>
      index === 0
        ? { ...section, blocks: [...section.blocks, baseImage] }
        : section,
    ),
  };
  const withLegacyPreview: OmiManuscriptState = {
    ...withoutPreview,
    sections: withoutPreview.sections.map((section, index) =>
      index === 0
        ? {
            ...section,
            blocks: section.blocks.map((block) =>
              block.id === 'figure-block' && block.visual?.kind === 'image'
                ? {
                    ...block,
                    visual: {
                      ...block.visual,
                      src: 'data:image/png;base64,ZmFrZS1wcmV2aWV3',
                    },
                  }
                : block,
            ),
          }
        : section,
    ),
  };

  assert.equal(
    calculateManuscriptStateDigestValue(withoutPreview),
    calculateManuscriptStateDigestValue(withLegacyPreview),
  );
});

test('missing digest evidence is backfilled for every committed revision', () => {
  const initial = createVersionedTestManuscript();
  const enrichedInitial = ensureManuscriptRevisionStateDigests(initial);
  const firstDigest = getRevisionStateDigest(
    enrichedInitial.revisionHistory.revisions[0]!,
  );
  assert.ok(firstDigest);

  const nextState: OmiManuscriptState = {
    ...extractManuscriptState(enrichedInitial),
    title: 'Digest-aware manuscript',
  };
  const committed = commitManuscriptRevision(enrichedInitial, nextState, {
    summary: 'Changed title',
    timestamp: '2026-08-07T12:10:00.000Z',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: initial.id,
        path: '/title',
        previousValue: initial.title,
        nextValue: nextState.title,
      },
    ],
  });

  assert.equal(
    getRevisionStateDigest(committed.revisionHistory.revisions.at(-1)!),
    undefined,
  );

  const enriched = ensureManuscriptRevisionStateDigests(committed);
  const integrity = inspectRevisionHistoryIntegrity(enriched.revisionHistory);
  assert.equal(integrity.summary.total, 2);
  assert.equal(integrity.summary.verified, 2);
  assert.equal(integrity.summary.missing, 0);
  assert.equal(
    getRevisionStateDigest(enriched.revisionHistory.revisions[0]!)?.value,
    firstDigest.value,
  );
});

test('declared digest mismatches are reported and never overwritten', () => {
  const enriched = ensureManuscriptRevisionStateDigests(
    createVersionedTestManuscript(),
  );
  const revision = enriched.revisionHistory.revisions[0]!;
  const digest = getRevisionStateDigest(revision)!;
  const tampered: OmiManuscript = {
    ...enriched,
    revisionHistory: {
      ...enriched.revisionHistory,
      revisions: [
        {
          ...revision,
          stateDigest: {
            ...digest,
            value: '0'.repeat(64),
          },
        } as typeof revision,
      ],
    },
  };

  const unchanged = ensureManuscriptRevisionStateDigests(tampered);
  assert.equal(unchanged, tampered);
  const integrity = inspectRevisionHistoryIntegrity(tampered.revisionHistory);
  assert.equal(integrity.summary.mismatch, 1);
  assert.throws(
    () => assertNoInvalidRevisionStateDigests(tampered),
    /integrity verification failed/i,
  );
});
