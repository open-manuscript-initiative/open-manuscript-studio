import assert from 'node:assert/strict';
import test from 'node:test';
import { submitAssignedReview, retryAssignedReviewWriteback } from '../src/services/peerReviewApi.ts';

test('client exposes a failed OJS transfer separately from the locally submitted task', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ review: { id: 'task', status: 'submitted' }, externalWriteback: { status: 'failed', message: 'OJS unavailable' } }));
  try {
    const result = await submitAssignedReview('task', 'MINOR_REVISION');
    assert.equal(result.status, 'submitted');
    assert.equal(result.externalWriteback?.status, 'failed');
    assert.equal(result.externalWriteback?.message, 'OJS unavailable');
  } finally { globalThis.fetch = original; }
});
test('retry uses the writeback endpoint and keeps the returned success status', async () => {
  const original = globalThis.fetch;
  let target = '';
  globalThis.fetch = async url => { target = String(url); return new Response(JSON.stringify({ review: { id: 'task', status: 'submitted' }, externalWriteback: { status: 'synced' } })); };
  try {
    const result = await retryAssignedReviewWriteback('task');
    assert.ok(target.endsWith('/api/reviews/assigned/task/writeback'));
    assert.equal(result.externalWriteback?.status, 'synced');
  } finally { globalThis.fetch = original; }
});
