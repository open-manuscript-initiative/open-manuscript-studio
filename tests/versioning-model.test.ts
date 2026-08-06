import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commitManuscriptRevision,
  createInitialVersioningEnvelope,
  extractManuscriptState,
  isValidLinearRevisionHistory,
  revertManuscriptToRevision,
} from '../src/model/versioning.ts';

function createState() {
  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'manuscript-1',
    version: '0.1.0-alpha.1',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    locale: 'en',
    title: 'Initial title',
    abstract: 'Initial abstract',
    keywords: [],
    agents: [],
    contributions: [],
    sections: [],
    annotations: [],
    citations: [],
    createdAt: '2026-08-06T21:00:00.000Z',
    updatedAt: '2026-08-06T21:00:00.000Z',
  } as const;
}

function createManuscript() {
  const state = createState();

  return {
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Created manuscript',
      timestamp: state.createdAt,
      completeness: 'complete',
    }),
  };
}

test('creates a valid immutable root revision for a new manuscript', () => {
  const manuscript = createManuscript();
  const root = manuscript.revisionHistory.revisions[0];

  assert.equal(
    manuscript.versioningModelVersion,
    'OMI-SPEC-160@0.1.0',
  );
  assert.equal(manuscript.revisionHistory.completeness, 'complete');
  assert.equal(manuscript.revisionHistory.revisions.length, 1);
  assert.equal(root?.parentRevisionIds.length, 0);
  assert.equal(root?.id, manuscript.headRevisionId);
  assert.equal(root?.snapshot.state.title, manuscript.title);
  assert.equal(
    isValidLinearRevisionHistory(manuscript.revisionHistory),
    true,
  );
});

test('commits a new revision without mutating the parent revision', () => {
  const manuscript = createManuscript();
  const originalJson = JSON.stringify(manuscript);
  const originalHead = manuscript.headRevisionId;
  const nextState = {
    ...extractManuscriptState(manuscript),
    title: 'Revised manuscript title',
  };
  const revised = commitManuscriptRevision(
    manuscript,
    nextState,
    {
      summary: 'Changed manuscript title',
      timestamp: '2026-08-06T21:30:00.000Z',
      events: [
        {
          operation: 'manuscript.title.set',
          targetId: manuscript.id,
          path: '/title',
          previousValue: manuscript.title,
          nextValue: nextState.title,
        },
      ],
    },
  );
  const committed = revised.revisionHistory.revisions.at(-1);

  assert.equal(JSON.stringify(manuscript), originalJson);
  assert.equal(revised.title, 'Revised manuscript title');
  assert.notEqual(revised.headRevisionId, originalHead);
  assert.deepEqual(committed?.parentRevisionIds, [originalHead]);
  assert.equal(committed?.snapshot.state.title, revised.title);
  assert.equal(
    isValidLinearRevisionHistory(revised.revisionHistory),
    true,
  );
});

test('records multiple semantic events in one atomic change set', () => {
  const manuscript = createManuscript();
  const nextState = {
    ...extractManuscriptState(manuscript),
    title: 'Atomic title',
    abstract: 'Atomic abstract',
  };
  const revised = commitManuscriptRevision(
    manuscript,
    nextState,
    {
      summary: 'Changed title and abstract',
      timestamp: '2026-08-06T21:31:00.000Z',
      events: [
        {
          operation: 'manuscript.title.set',
          targetId: manuscript.id,
          path: '/title',
          previousValue: manuscript.title,
          nextValue: nextState.title,
        },
        {
          operation: 'manuscript.abstract.set',
          targetId: manuscript.id,
          path: '/abstract',
          previousValue: manuscript.abstract,
          nextValue: nextState.abstract,
        },
      ],
    },
  );
  const committed = revised.revisionHistory.revisions.at(-1);

  assert.equal(committed?.changeSet.events.length, 2);
  assert.equal(committed?.snapshot.state.title, 'Atomic title');
  assert.equal(committed?.snapshot.state.abstract, 'Atomic abstract');
});

test('revert creates a new revision and preserves the reverted history', () => {
  const manuscript = createManuscript();
  const rootRevisionId = manuscript.headRevisionId;
  const revised = commitManuscriptRevision(
    manuscript,
    {
      ...extractManuscriptState(manuscript),
      title: 'Temporary title',
    },
    {
      summary: 'Changed manuscript title',
      timestamp: '2026-08-06T21:32:00.000Z',
      events: [
        {
          operation: 'manuscript.title.set',
          targetId: manuscript.id,
          path: '/title',
          previousValue: manuscript.title,
          nextValue: 'Temporary title',
        },
      ],
    },
  );
  const reverted = revertManuscriptToRevision(
    revised,
    rootRevisionId,
    {
      summary: 'Reverted manuscript to an earlier revision',
      timestamp: '2026-08-06T21:33:00.000Z',
    },
  );
  const revertRevision = reverted.revisionHistory.revisions.at(-1);

  assert.equal(reverted.title, manuscript.title);
  assert.equal(reverted.revisionHistory.revisions.length, 3);
  assert.equal(revertRevision?.revertsRevisionId, rootRevisionId);
  assert.equal(
    revertRevision?.changeSet.events[0]?.operation,
    'revision.revert',
  );
  assert.equal(
    isValidLinearRevisionHistory(reverted.revisionHistory),
    true,
  );
});

test('represents timestamp-only migration as a disclosed shallow root', () => {
  const state = createState();
  const migrated = {
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Imported legacy manuscript snapshot',
      timestamp: state.updatedAt,
      completeness: 'shallow',
    }),
  };

  assert.equal(migrated.revisionHistory.completeness, 'shallow');
  assert.equal(migrated.revisionHistory.revisions.length, 1);
  assert.equal(
    migrated.revisionHistory.revisions[0]?.summary,
    'Imported legacy manuscript snapshot',
  );
  assert.equal(
    isValidLinearRevisionHistory(migrated.revisionHistory),
    true,
  );
});
