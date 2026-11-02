import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRuntimeAssessmentCurrent, runRuntimeCapabilityAssessment, validRuntimeProbePayload,
} from '../src/services/runtimeCapabilityAssessment.ts';

const implementation = { name: 'Studio runtime test', version: '0.3', build: 'test', revision: 'abc', dependencies: 'lock' };
const origin = 'https://studio.example';
const health = { status: 'ok', service: 'open-manuscript-studio-server', database: 'connected', timestamp: 'now' };
const capabilities = {
  model: 'omi-studio-integration-extension-api', apiVersion: '1',
  specification: 'OMI-SPEC-310@0.1.0', pluginSpecification: 'OMI-SPEC-300@0.1.0',
  status: 'partial-draft-implementation', registryScope: 'authenticated-user',
  manifestOnly: true, executesPluginCode: false, grantsManuscriptAccess: false,
  publishingAuthority: false, permissions: ['storage.read'],
};
function mockApi(map: Record<string, { status: number; body: unknown }>) {
  const requests: string[] = [];
  return {
    requests,
    fetch: async (path: string): Promise<Response> => {
      requests.push(path);
      const entry = map[path];
      if (!entry) throw new Error('offline');
      return Response.json(entry.body, { status: entry.status });
    },
  };
}
const responses = {
  '/api/health': { status: 200, body: health },
  '/api/collaboration/status': { status: 200, body: { enabled: true } },
  '/api/v1/integrations/extensions/capabilities': { status: 200, body: capabilities },
  '/api/v1/integrations/extensions': { status: 200, body: { extensions: [{ manifest: { id: 'secret-extension' } }] } },
};

test('live probes use only fixed paths and discard personal registry response contents', async () => {
  const api = mockApi(responses);
  const report = await runRuntimeCapabilityAssessment(implementation, 'web', origin, api.fetch);
  assert.deepEqual(api.requests.sort(), Object.keys(responses).sort());
  assert.equal(report.probes.length, 4);
  assert.ok(report.probes.every((item) => item.status === 'pass'));
  assert.equal(report.normativeOutcome, 'indeterminate');
  assert.equal(report.verification, 'not-independent');
  assert.equal(JSON.stringify(report).includes('secret-extension'), false);
  assert.equal(isRuntimeAssessmentCurrent(report, implementation, 'web', origin), true);
  assert.equal(isRuntimeAssessmentCurrent(report, implementation, 'web', 'https://other.example'), false);
  assert.equal(isRuntimeAssessmentCurrent(report, { ...implementation, revision: 'new' }, 'web', origin), false);
  const changed = structuredClone(report);
  changed.probes[0]!.status = 'fail';
  assert.equal(isRuntimeAssessmentCurrent(changed, implementation, 'web', origin), false);
});

test('no connectivity or authentication is never presented as verified support', async () => {
  const api = mockApi({
    ...responses,
    '/api/collaboration/status': { status: 200, body: { enabled: false } },
    '/api/v1/integrations/extensions/capabilities': { status: 401, body: { error: 'Not authenticated' } },
  });
  const report = await runRuntimeCapabilityAssessment(implementation, 'android', origin, api.fetch);
  assert.deepEqual(report.probes.map((item) => item.status), ['pass', 'fail', 'unavailable', 'pass']);
  assert.equal(report.probes[1]!.code, 'DISABLED');
  assert.equal(report.probes[2]!.code, 'AUTH_REQUIRED');
  const offline = await runRuntimeCapabilityAssessment(implementation, 'web', origin, async () => { throw Error('offline'); });
  assert.ok(offline.probes.every((item) => item.status === 'unavailable'));
});

test('mismatched server capabilities are rejected instead of trusted as conformance', async () => {
  assert.equal(validRuntimeProbePayload('extension-api', { ...capabilities, executesPluginCode: true }), false);
  assert.equal(validRuntimeProbePayload('extension-api', { ...capabilities, registryScope: 'global' }), false);
  assert.equal(validRuntimeProbePayload('server-health', { ...health, database: 'down' }), false);
  assert.equal(validRuntimeProbePayload('collaboration-enabled', { enabled: 'true' }), false);
  assert.equal(validRuntimeProbePayload('extension-registry', { extensions: {} }), false);
  const api = mockApi({ ...responses,
    '/api/v1/integrations/extensions/capabilities': { status: 200, body: { ...capabilities, apiVersion: '999' } },
  });
  const report = await runRuntimeCapabilityAssessment(implementation, 'web', origin, api.fetch);
  assert.equal(report.probes[2]?.status, 'fail');
  assert.equal(report.probes[2]?.code, 'INVALID_RESPONSE');
});

test('localized capability limits cover each declared requirement without altering export', async () => {
  const { translatedCapabilityDetails } = await import('../src/i18n/capabilityDetails.ts');
  const { capabilityStatement } = await import('../src/model/conformance.ts');
  const capabilities = capabilityStatement(implementation, 'web').capabilities;
  for (const capability of capabilities) for (const locale of ['hu', 'de']) {
    const translated = translatedCapabilityDetails(locale, capability);
    assert.equal(translated.prerequisites.length, capability.prerequisites.length);
    assert.equal(translated.limitations.length, capability.limitations.length);
    assert.notDeepEqual(translated.limitations, capability.limitations);
  }
  assert.equal(translatedCapabilityDetails('en', capabilities[0]!).limitations[0], capabilities[0]!.limitations[0]);
});
