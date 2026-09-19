import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('OMP native client keeps API endpoints and shared-secret writes server-side', () => {
  const integrationRoutes = source('server/src/routes/integrationRoutes.ts');
  const nativeContext = source('server/src/integrations/omp/nativeContext.ts');
  const nativeWriteback = source('server/src/integrations/omp/nativeWriteback.ts');

  assert.match(integrationRoutes, /loadOmpPlatformCapabilities/);
  assert.match(integrationRoutes, /createPendingAuthorOmpNativeContext/);
  assert.match(integrationRoutes, /nativeAuthorWriteAvailable/);

  const launchDataStart = integrationRoutes.indexOf('const launchData = {');
  const launchDataEnd = integrationRoutes.indexOf('const handoffToken', launchDataStart);
  const launchData = integrationRoutes.slice(launchDataStart, launchDataEnd);
  assert.doesNotMatch(launchData, /apiBaseUrl:/);
  assert.doesNotMatch(launchData, /externalBaseUrl:/);

  assert.match(nativeContext, /api_base_url/);
  assert.match(nativeContext, /claimAuthorOmpNativeContext/);
  assert.match(nativeWriteback, /getActiveInstallationWithSecret/);
  assert.match(nativeWriteback, /X-OMI-Installation/);
  assert.match(nativeWriteback, /X-OMI-Timestamp/);
  assert.match(nativeWriteback, /X-OMI-Signature/);
  assert.match(nativeWriteback, /review-result-v2/);
  assert.match(nativeWriteback, /review-attachments/);
  assert.match(nativeWriteback, /author-revisions/);
});

test('reviewer bootstrap preserves native OMP assignment and recommendation authority', () => {
  const route = source('server/src/routes/ompReviewRoutes.ts');
  const peerReview = source('server/src/services/peerReviewService.ts');

  for (const required of [
    'loadOmpReviewContext',
    'loadOmpReviewAttachments',
    'persistReviewerOmpNativeContext',
    'reviewRoundExternalId',
    "recommendationStorage: recommendationSupported ? 'native' : 'unavailable'",
  ]) {
    assert.ok(route.includes(required), `Missing reviewer native OMP contract: ${required}`);
  }

  assert.match(peerReview, /externalStorage === 'unavailable'/);
  assert.match(peerReview, /does not support reviewer recommendation values/);
  assert.match(
    peerReview,
    /normalizeRecommendationStorage\(assignment\.externalRecommendationStorage\) === 'unavailable'/,
  );
});

test('author revision action remains bound to the imported OMP manuscript context', () => {
  const app = source('src/App.tsx');
  const menu = source('src/components/StudioMenuWithHelp.tsx');
  const api = source('src/services/ompNativeApi.ts');

  assert.match(app, /ompAuthorAssignment\?\.manuscriptId === activeManuscriptId/);
  assert.match(menu, /sendAuthorRevisionToOmp/);
  assert.match(menu, /ompAuthorContext\?\.writable/);
  assert.match(api, /buildDocxExport/);
  assert.match(api, /\/integrations\/omp\/native\/author\//);
});
