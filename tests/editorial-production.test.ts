import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProductionState,
  transitionProduction,
  type ProductionActor,
  type ProductionAction,
  type ProductionState,
} from '../server/src/domain/editorialProduction.ts';
const editor: ProductionActor = {
  userId: 'editor',
  author: false,
  editor: true,
};
const author: ProductionActor = {
  userId: 'author',
  author: true,
  editor: false,
};
const worker: ProductionActor = {
  userId: 'worker',
  author: false,
  editor: false,
};
const at = '2026-11-16T01:00:00.000Z';
const source = {
  fileId: 'source-1',
  revisionId: 'rev-1',
  stateDigest: 'a'.repeat(64),
  publicationContentDigest: 'b'.repeat(64),
};
const proof = {
  fileId: 'proof-1',
  revisionId: 'rev-1',
  stateDigest: source.stateDigest,
  sha256: 'c'.repeat(64),
  buildId: 'build-1',
  fileName: 'article.html',
  mediaType: 'text/html;charset=utf-8',
};
const apply = (s: ProductionState, a: ProductionAction, actor = editor) =>
  transitionProduction(s, a, actor, at);
function layout() {
  let s = createProductionState(source, editor, at);
  s = apply(
    s,
    { type: 'APPROVE_SOURCE', role: 'AUTHOR', fileId: source.fileId },
    author,
  );
  s = apply(s, {
    type: 'APPROVE_SOURCE',
    role: 'EDITOR',
    fileId: source.fileId,
  });
  return apply(s, { type: 'LAYOUT' });
}
function proofing() {
  return apply(layout(), { type: 'PROOF', proof });
}
function ready() {
  let s = proofing();
  s = apply(
    s,
    { type: 'APPROVE_PROOF', role: 'AUTHOR', fileId: proof.fileId },
    author,
  );
  s = apply(s, { type: 'APPROVE_PROOF', role: 'EDITOR', fileId: proof.fileId });
  return apply(s, { type: 'READY' });
}
test('copyediting requires separate author/editor approvals and exact source identity', () => {
  const s = createProductionState(source, editor, at);
  assert.throws(() => apply(s, { type: 'LAYOUT' }));
  assert.throws(() =>
    apply(s, { type: 'APPROVE_SOURCE', role: 'AUTHOR', fileId: source.fileId }),
  );
  assert.throws(() =>
    apply(
      s,
      { type: 'APPROVE_SOURCE', role: 'AUTHOR', fileId: 'stale' },
      author,
    ),
  );
  assert.equal(layout().stage, 'LAYOUT');
  assert.deepEqual(s.sourceApprovals, {}, 'input state remains immutable');
});
test('a proof cannot refer to another accepted source or bypass copyediting', () => {
  assert.throws(() =>
    apply(createProductionState(source, editor, at), { type: 'PROOF', proof }),
  );
  assert.throws(() =>
    apply(layout(), {
      type: 'PROOF',
      proof: { ...proof, revisionId: 'other' },
    }),
  );
  assert.throws(() =>
    apply(layout(), {
      type: 'PROOF',
      proof: { ...proof, stateDigest: '0'.repeat(64) },
    }),
  );
});
test('correction workflow prevents publication and requires a recorded resolution', () => {
  let s = apply(
    proofing(),
    {
      type: 'CORRECTION',
      id: 'correction',
      fileId: proof.fileId,
      locator: 'Page 3, paragraph 2',
      note: 'Correct the date.',
    },
    author,
  );
  assert.throws(() =>
    apply(
      s,
      { type: 'APPROVE_PROOF', role: 'AUTHOR', fileId: proof.fileId },
      author,
    ),
  );
  assert.throws(() => apply(s, { type: 'READY' }));
  assert.throws(() =>
    apply(s, {
      type: 'PROOF',
      proof: {
        ...proof,
        fileId: 'new',
        sha256: 'd'.repeat(64),
        buildId: 'new-build',
      },
    }),
  );
  assert.throws(() =>
    apply(s, { type: 'RESOLVE', id: 'correction', note: '' }),
  );
  s = apply(s, {
    type: 'RESOLVE',
    id: 'correction',
    note: 'Corrected the date in the replacement proof.',
  });
  s = apply(s, {
    type: 'PROOF',
    proof: {
      ...proof,
      fileId: 'new',
      sha256: 'd'.repeat(64),
      buildId: 'new-build',
    },
  });
  assert.equal(
    s.corrections[0].resolution?.note,
    'Corrected the date in the replacement proof.',
  );
  assert.throws(() =>
    apply(
      s,
      { type: 'APPROVE_PROOF', role: 'AUTHOR', fileId: proof.fileId },
      author,
    ),
  );
});
test('replacing an approved proof invalidates both approvals and keeps history', () => {
  const old = ready();
  const next = apply(old, {
    type: 'PROOF',
    proof: {
      ...proof,
      fileId: 'proof-2',
      sha256: 'd'.repeat(64),
      buildId: 'build-2',
    },
  });
  assert.equal(next.stage, 'PROOFREADING');
  assert.deepEqual(next.proofApprovals, {});
  assert.equal(old.stage, 'READY');
  assert.equal(old.proof!.fileId, 'proof-1');
  assert.equal(next.events.length, old.events.length + 1);
  assert.throws(() => apply(next, { type: 'READY' }));
});
test('identical proof retry preserves approvals; changed source invalidates all later stages', () => {
  const old = ready();
  assert.deepEqual(apply(old, { type: 'PROOF', proof }), old);
  const next = apply(old, {
    type: 'SOURCE',
    source: { ...source, fileId: 'source-2', revisionId: 'rev-2' },
  });
  assert.equal(next.stage, 'COPYEDITING');
  assert.equal(next.acceptedSource.fileId, source.fileId);
  assert.equal(next.proof, null);
  assert.deepEqual(next.sourceApprovals, {});
  assert.deepEqual(next.proofApprovals, {});
});
test('task assignment never grants editorial authority and revocation is immediate', () => {
  let s = apply(layout(), {
    type: 'ASSIGN',
    userId: worker.userId,
    role: 'LAYOUT_EDITOR',
    dueAt: at,
  });
  s = apply(s, { type: 'PROOF', proof }, worker);
  assert.throws(() =>
    apply(
      s,
      { type: 'APPROVE_PROOF', role: 'EDITOR', fileId: proof.fileId },
      worker,
    ),
  );
  assert.throws(() =>
    apply(
      s,
      { type: 'ASSIGN', userId: worker.userId, role: 'COPYEDITOR' },
      worker,
    ),
  );
  assert.throws(() =>
    apply(
      s,
      { type: 'SOURCE', source: { ...source, fileId: 'source-2' } },
      worker,
    ),
  );
  s = apply(s, {
    type: 'REVOKE',
    userId: worker.userId,
    role: 'LAYOUT_EDITOR',
  });
  assert.throws(() => apply(s, { type: 'PROOF', proof }, worker));
});
test('late corrections revoke both proof approvals and stale-proof feedback is rejected', () => {
  let s = proofing();
  s = apply(
    s,
    { type: 'APPROVE_PROOF', role: 'AUTHOR', fileId: proof.fileId },
    author,
  );
  s = apply(s, { type: 'APPROVE_PROOF', role: 'EDITOR', fileId: proof.fileId });
  s = apply(
    s,
    {
      type: 'CORRECTION',
      id: 'last-minute',
      fileId: proof.fileId,
      locator: 'Heading',
      note: 'Typo',
    },
    author,
  );
  assert.deepEqual(s.proofApprovals, {});
  assert.throws(() =>
    apply(
      s,
      {
        type: 'CORRECTION',
        id: 'wrong',
        fileId: 'old-proof',
        locator: 'Heading',
        note: 'Typo',
      },
      author,
    ),
  );
});
