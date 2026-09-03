import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  commitManuscriptRevision,
  createInitialVersioningEnvelope,
  extractManuscriptState,
  isValidLinearRevisionHistory,
  revertManuscriptToRevision,
} from '../src/model/versioning.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';

const releasePackage = JSON.parse(readFileSync(
  new URL('../package.json', import.meta.url),
  'utf8',
)) as { version: string };
const releasePackageLock = JSON.parse(readFileSync(
  new URL('../package-lock.json', import.meta.url),
  'utf8',
)) as { version: string; packages?: Record<string, { version?: string }> };
const tauriConfig = JSON.parse(readFileSync(
  new URL('../src-tauri/tauri.conf.json', import.meta.url),
  'utf8',
)) as { version: string };
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('release-facing application versions stay aligned', () => {
  assert.match(releasePackage.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
  assert.equal(releasePackageLock.version, releasePackage.version);
  assert.equal(releasePackageLock.packages?.['']?.version, releasePackage.version);
  assert.equal(tauriConfig.version, releasePackage.version);
  assert.ok(readme.includes(`**Current status:** \`${releasePackage.version}\``));
});

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
    tombstones: [],
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

function createContributorManuscript() {
  const state = {
    ...createState(),
    agents: [
      {
        id: 'agent-1',
        type: 'person',
      },
    ],
    contributions: [
      {
        id: 'contribution-1',
        agentId: 'agent-1',
        targetId: 'manuscript-1',
        roles: ['author'],
        order: 1,
      },
    ],
  };

  return {
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Created contributor manuscript',
      timestamp: state.createdAt,
      completeness: 'complete',
    }),
  };
}

function deleteContributor(manuscript) {
  const agent = manuscript.agents[0];
  const contribution = manuscript.contributions[0];

  return commitManuscriptRevision(
    manuscript,
    {
      ...extractManuscriptState(manuscript),
      agents: [],
      contributions: [],
    },
    {
      summary: 'Removed manuscript contributor',
      actorAgentId: 'agent-1',
      timestamp: '2026-08-06T21:40:00.000Z',
      events: [
        {
          operation: 'contribution.remove',
          targetId: 'contribution-1',
          path: '/contributions/contribution-1',
          previousValue: contribution,
        },
        {
          operation: 'agent.remove',
          targetId: 'agent-1',
          path: '/agents/agent-1',
          previousValue: agent,
        },
      ],
    },
  );
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
  assert.equal(root?.snapshot.state.tombstones.length, 0);
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

test('creates persistent tombstones with committed revision and event identity', () => {
  const manuscript = createContributorManuscript();
  const deleted = deleteContributor(manuscript);
  const deletionRevision = deleted.revisionHistory.revisions.at(-1);

  assert.equal(deleted.agents.length, 0);
  assert.equal(deleted.contributions.length, 0);
  assert.equal(deleted.tombstones.length, 2);

  const contributionTombstone = deleted.tombstones.find(
    (tombstone) => tombstone.objectId === 'contribution-1',
  );
  const agentTombstone = deleted.tombstones.find(
    (tombstone) => tombstone.objectId === 'agent-1',
  );
  const contributionEvent = deletionRevision?.changeSet.events.find(
    (event) => event.targetId === 'contribution-1',
  );

  assert.equal(
    contributionTombstone?.deletionRevisionId,
    deleted.headRevisionId,
  );
  assert.equal(
    contributionTombstone?.deletingChangeEventId,
    contributionEvent?.id,
  );
  assert.equal(contributionTombstone?.objectType, 'contribution');
  assert.equal(contributionTombstone?.formerContainerId, 'manuscript-1');
  assert.equal(agentTombstone?.objectType, 'agent');
  assert.equal(agentTombstone?.deletedByAgentId, 'agent-1');
  assert.equal(agentTombstone?.restoredByRevisionId, undefined);
});

test('restores the same conceptual objects and retains tombstone evidence', () => {
  const manuscript = createContributorManuscript();
  const rootRevisionId = manuscript.headRevisionId;
  const deleted = deleteContributor(manuscript);
  const restored = revertManuscriptToRevision(
    deleted,
    rootRevisionId,
    {
      summary: 'Restore contributor through revert',
      timestamp: '2026-08-06T21:41:00.000Z',
    },
  );
  const restorationRevision = restored.revisionHistory.revisions.at(-1);

  assert.equal(restored.agents[0]?.id, 'agent-1');
  assert.equal(restored.contributions[0]?.id, 'contribution-1');
  assert.equal(restored.tombstones.length, 2);
  assert.equal(
    restored.tombstones.every(
      (tombstone) =>
        tombstone.restoredByRevisionId === restored.headRevisionId,
    ),
    true,
  );
  assert.equal(
    restorationRevision?.changeSet.events.some(
      (event) => event.operation === 'agent.restore',
    ),
    true,
  );
  assert.equal(
    restorationRevision?.changeSet.events.some(
      (event) => event.operation === 'contribution.restore',
    ),
    true,
  );
});

test('rejects reuse of an actively tombstoned identifier without restoration', () => {
  const manuscript = createContributorManuscript();
  const deleted = deleteContributor(manuscript);
  const reusedAgent = {
    id: 'agent-1',
    type: 'person',
  };

  assert.throws(
    () =>
      commitManuscriptRevision(
        deleted,
        {
          ...extractManuscriptState(deleted),
          agents: [reusedAgent],
        },
        {
          summary: 'Illegally reused deleted identifier',
          timestamp: '2026-08-06T21:42:00.000Z',
          events: [
            {
              operation: 'agent.create',
              targetId: 'agent-1',
              path: '/agents/-',
              nextValue: reusedAgent,
            },
          ],
        },
      ),
    /reserved by an active tombstone/,
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

test('exports revision history and tombstones while omitting legacy authors', () => {
  const manuscript = createContributorManuscript();
  const deleted = {
    ...deleteContributor(manuscript),
    authors: [
      {
        id: 'legacy-author',
        givenName: 'Legacy',
        familyName: 'Author',
      },
    ],
  };
  const exported = JSON.parse(serializeOmiJson(deleted));

  assert.equal(
    exported.versioningModelVersion,
    'OMI-SPEC-160@0.1.0',
  );
  assert.equal(exported.revisionHistory.revisions.length, 2);
  assert.equal(exported.tombstones.length, 2);
  assert.equal('authors' in exported, false);
});
