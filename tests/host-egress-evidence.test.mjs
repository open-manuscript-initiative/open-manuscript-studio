import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { assessHostEgressEvidence } from '../scripts/acceptance/host-egress-evidence.mjs';

const GROUP = '/system.slice/omi-studio-api.service';
function fixture() {
  return {
    api: {
      ActiveState: 'active',
      MainPID: '2508815',
      ControlGroup: GROUP,
      IPAddressAllow: '::1/128 127.0.0.0/8',
      IPAddressDeny: '10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 fc00::/7 fe80::/10',
    },
    procCgroup: '0::' + GROUP + '\n',
    bpfOutput: [
      '908573 cgroup_inet_ingress multi sd_fw_ingress',
      '908572 cgroup_inet_egress multi sd_fw_egress',
    ].join('\n'),
    loopbackHealthy: true,
    observedAt: '2026-11-03T20:14:00.000Z',
  };
}
test('successful live service configuration stays separate from manual #765 approval', () => {
  const report = assessHostEgressEvidence(fixture());
  assert.deepEqual(Object.values(report.checks), Array(7).fill(true));
  assert.equal(report.status, 'OPERATOR_ACCEPTANCE_REQUIRED');
  assert.equal(report.requiresOwnerEvidence.liveApiCgroupNegativeConnection, 'NOT_VERIFIED');
  assert.equal(report.requiresOwnerEvidence.enabledProviderWorkflows, 'NOT_VERIFIED');
  assert.equal(report.requiresOwnerEvidence.authorizedHostEgressReceipt, 'NOT_APPROVED');
  assert.equal(report.readOnly, true);
  assert.equal(report.observedAt, '2026-11-03T20:14:00.000Z');
});

test('missing or mismatched process, unconfigured policy and missing BPF are not a PASS', () => {
  const p = fixture();
  p.procCgroup = '0::/system.slice/different.service\n';
  assert.equal(assessHostEgressEvidence(p).checks.mainProcessInServiceCgroup, false);
  p.procCgroup = fixture().procCgroup;
  p.api.IPAddressDeny = '169.254.0.0/16';
  assert.equal(assessHostEgressEvidence(p).checks.addressRangesConfigured, false);
  p.api.IPAddressDeny = fixture().api.IPAddressDeny;
  p.bpfOutput = null;
  const unavailable = assessHostEgressEvidence(p);
  assert.equal(unavailable.checks.bpfInspectionAvailable, false);
  assert.equal(unavailable.checks.ingressBpfAttached, false);
  assert.equal(unavailable.checks.egressBpfAttached, false);
  p.bpfOutput = '908572 cgroup_inet_egress multi unrelated_program\n';
  assert.equal(assessHostEgressEvidence(p).checks.egressBpfAttached, false);
});

test('health check by itself is not evidence of a protected active API', () => {
  const p = fixture();
  p.api.ActiveState = 'inactive';
  const r = assessHostEgressEvidence(p);
  assert.equal(r.checks.apiActive, false);
  assert.equal(r.checks.addressRangesConfigured, false);
  assert.equal(r.checks.loopbackApiHealthHttp200, true);
  assert.equal(r.status, 'OPERATOR_ACCEPTANCE_REQUIRED');
});

test('public JSON contains no raw PID, user, cgroup path, host IPs or BPF IDs', () => {
  const p = fixture();
  p.api.User = 'private-plesk-account';
  p.api.secret = 'never-print-me';
  const text = JSON.stringify(assessHostEgressEvidence(p));
  for (const secret of ['2508815', 'private-plesk-account', 'never-print-me',
    '908573', '127.0.0.0/8', '10.0.0.0/8', GROUP]) {
    assert.equal(text.includes(secret), false, 'Unexpected private value: ' + secret);
  }
});

test('source is syntax-valid and cannot modify service/firewall/credentials', () => {
  const script = new URL('../scripts/acceptance/host-egress-evidence.mjs', import.meta.url).pathname;
  const syntax = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const source = readFileSync(script, 'utf8');
  assert.match(source, /bpftool.*cgroup|cgroup.*show/);
  assert.match(source, /port: 3001, path: '\/api\/health'/);
  assert.doesNotMatch(source, /systemctl',\s*\['(?:stop|restart|start|daemon-reload)/);
  assert.doesNotMatch(source, /execFileSync\('(?:nft|iptables|ip6tables|ufw|firewall-cmd)'/);
  assert.doesNotMatch(source, /\/proc\/.*\/environ/);
});
