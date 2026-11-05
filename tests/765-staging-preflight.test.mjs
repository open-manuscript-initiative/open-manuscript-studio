import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../scripts/acceptance/765-staging-preflight.mjs';

const base = { tests: 'PASS', healthChecks: ['PASS','PASS'],
  sourceSha: 'a'.repeat(40), buildDigest: 'sha256:'+'b'.repeat(64),
  harnessSha: 'sha256:'+'c'.repeat(64) };
test('successful preflight cannot approve release or egress', () => {
  const result = summarize(base);
  assert.equal(result.status, 'PREFLIGHT_PASS');
  assert.equal(result.productionLiveApiNegative, 'NOT_VERIFIED');
  assert.equal(result.hostEgressReceipt, 'NOT_APPROVED');
  assert.equal(result.rcDecision, 'NO_GO');
});
test('health or unit test failure fails preflight', () => {
  assert.equal(summarize({...base, healthChecks:['PASS','FAIL']}).status,'PREFLIGHT_FAIL');
  assert.equal(summarize({...base, tests:'FAIL'}).status,'PREFLIGHT_FAIL');
});
