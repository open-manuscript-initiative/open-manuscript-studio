import test from 'node:test';
import assert from 'node:assert/strict';
import { assess } from '../scripts/acceptance/765-staging-receipt.mjs';
const cases = {
  ipv4PrivateLinkLocal:'PASS', ipv6UlaLinkLocalMapped:'PASS',
  metadataSynthetic:'PASS', dnsRebinding:'PASS', httpRedirect:'PASS',
  proxyAndAlternateFetch:'PASS', workerContainerDelegation:'PASS',
  authorizedOjsWebdav:'PASS', enabledCloudAndOidc:'PASS',
  loopbackDbProxy:'PASS', postTestHealth:'PASS'
};
const good = {
  schemaVersion:1, scope:'isolated-staging',
  sourceSha:'a'.repeat(40), buildDigest:'sha256:'+'b'.repeat(64),
  harnessSha:'c'.repeat(40), observedAt:'2026-11-05T08:00:00Z',
  approvedByOperator:true, noProductionMutation:true, cases
};
test('all-pass staging remains NO-GO for production', () => {
  const r=assess(good);
  assert.equal(r.status,'STAGING_REVIEW_REQUIRED');
  assert.equal(r.productionLiveApiNegative,'NOT_VERIFIED');
  assert.equal(r.hostEgressReceipt,'NOT_APPROVED');
  assert.equal(r.rcDecision,'NO_GO');
});
test('missing and failed observations cannot pass', () => {
  assert.equal(assess({...good,cases:{...cases,dnsRebinding:'NOT_VERIFIED'}}).status,'STAGING_INCOMPLETE');
  assert.equal(assess({...good,cases:{...cases,httpRedirect:'FAIL'}}).status,'STAGING_FAILED');
});
test('production scope and missing authorization rejected', () => {
  assert.equal(assess({...good,scope:'production'}).status,'INVALID');
  assert.equal(assess({...good,approvedByOperator:false}).status,'INVALID');
  assert.equal(assess({...good,sourceSha:'main'}).status,'INVALID');
});
