import assert from 'node:assert/strict';
import test from 'node:test';
import { assessHostSecurity } from '../scripts/acceptance/host-security-preflight.mjs';

function fixture() {
  return {
    api: { ActiveState: 'active', MainPID: '1234', User: 'private-user',
      IPAddressAllow: 'localhost',
      IPAddressDeny: '10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 fc00::/7 fe80::/10' },
    worker: { ActiveState: 'active', MainPID: '4567', User: 'omi-pdf-worker',
      PrivateNetwork: 'yes', IPAddressDeny: '0.0.0.0/0 ::/0', IPAddressAllow: '127.0.0.0/8 ::1/128',
      NoNewPrivileges: 'yes', ProtectSystem: 'strict', ProtectHome: 'yes', KillMode: 'control-group',
      MemoryMax: '3221225472', TasksMax: '512', CPUQuotaPerSecUSec: '2s' },
    socket: { exists: true, isSocket: true, groupRestricted: true, expectedIdentity: true },
    runtime: { apiCgroupMatches: true, workerCgroupMatches: true, socketUnitActive: true },
  };
}
test('observed configuration is not falsely promoted to security acceptance', () => {
  const result = assessHostSecurity(fixture());
  assert.equal(result.issue765.cgroupPolicyConfigured, true);
  assert.equal(result.issue774.workerSandboxConfigured, true);
  assert.equal(result.issue765.actualIPv4IPv6DenialVerified, false);
  assert.equal(result.issue774.forcedTimeoutProcessTreeVerifiedOnHost, false);
  assert.equal(result.issue765.status, 'OPERATOR_ACCEPTANCE_REQUIRED');
  const json = JSON.stringify(result);
  for (const value of ['private-user', '1234', '4567', '10.0.0.0/8', 'omi-pdf-worker'])
    assert.equal(json.includes(value), false);
});
test('API without real service policy is not marked configured', () => {
  const input = fixture(); input.api.IPAddressDeny = '';
  assert.equal(assessHostSecurity(input).issue765.cgroupPolicyConfigured, false);
});
test('missing network isolation, limits, socket identity and cgroup are detected', () => {
  const a = fixture(); a.worker.PrivateNetwork = 'no';
  assert.equal(assessHostSecurity(a).issue774.workerSandboxConfigured, false);
  const b = fixture(); b.worker.TasksMax = 'infinity';
  assert.equal(assessHostSecurity(b).issue774.resourceLimitsConfigured, false);
  const c = fixture(); c.socket.expectedIdentity = false;
  assert.equal(assessHostSecurity(c).issue774.restrictedUnixSocket, false);
  const d = fixture(); d.runtime.workerCgroupMatches = false;
  assert.equal(assessHostSecurity(d).issue774.workerSandboxConfigured, false);
});
test('inactive units cannot pass the configured-state inventory', () => {
  const input = fixture(); input.api.ActiveState = 'failed'; input.worker.ActiveState = 'inactive';
  const report = assessHostSecurity(input);
  assert.equal(report.issue765.cgroupPolicyConfigured, false);
  assert.equal(report.issue774.workerSandboxConfigured, false);
});
