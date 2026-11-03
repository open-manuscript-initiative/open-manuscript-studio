#!/usr/bin/env node
/**
 * Read-only #765/#774 host inventory for Ubuntu/Plesk.
 * No firewall changes, service restarts, network probes, .env reads or secrets.
 * A configured service is NEVER accepted as proof of effective kernel enforcement.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const keys = ['ActiveState', 'User', 'MainPID', 'ControlGroup', 'IPAddressAllow',
  'IPAddressDeny', 'PrivateNetwork', 'NoNewPrivileges', 'ProtectSystem',
  'ProtectHome', 'MemoryMax', 'TasksMax', 'CPUQuotaPerSecUSec', 'KillMode'];
const exact = (value, token) => (value ?? '').toLowerCase().split(/[\s,;]+/).includes(token.toLowerCase());
const localhost = (value) => /\blocalhost\b/i.test(value ?? '')
  || (exact(value, '127.0.0.0/8') && exact(value, '::1/128'));
const positiveInt = (value) => /^\d+$/.test(value ?? '') && Number.isSafeInteger(Number(value)) && Number(value) > 0;

function cpuMicroseconds(value) {
  if (positiveInt(value)) return Number(value);
  const match = /^(\d+(?:\.\d+)?)(us|ms|s|min)$/.exec(value ?? '');
  if (!match) return NaN;
  return Number(match[1]) * ({ us: 1, ms: 1000, s: 1000000, min: 60000000 })[match[2]];
}

export function assessHostSecurity({ api = {}, worker = {}, socket = {}, runtime = {} }) {
  const apiRunning = api.ActiveState === 'active' && Number(api.MainPID) > 1;
  const workerRunning = worker.ActiveState === 'active' && Number(worker.MainPID) > 1;
  const nonRoot = (value) => !!value && value !== 'root' && value !== '0';
  const restricted = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
    '169.254.0.0/16', 'fc00::/7', 'fe80::/10']
    .every((range) => exact(api.IPAddressDeny, range));
  const denyAll = /\bany\b/i.test(worker.IPAddressDeny ?? '') ||
    (exact(worker.IPAddressDeny, '0.0.0.0/0') && exact(worker.IPAddressDeny, '::/0'));
  const cpu = cpuMicroseconds(worker.CPUQuotaPerSecUSec);
  const bounded = positiveInt(worker.MemoryMax) && Number(worker.MemoryMax) <= 4 * 1024 ** 3
    && positiveInt(worker.TasksMax) && Number(worker.TasksMax) <= 512
    && Number.isFinite(cpu) && cpu > 0 && cpu <= 2_000_000;
  const restrictedSocket = socket.exists === true && socket.isSocket === true &&
    socket.groupRestricted === true && socket.expectedIdentity === true;
  const workerSandbox = workerRunning && nonRoot(worker.User) &&
    worker.PrivateNetwork === 'yes' && denyAll && localhost(worker.IPAddressAllow) &&
    worker.NoNewPrivileges === 'yes' && worker.ProtectSystem === 'strict' &&
    worker.ProtectHome === 'yes' && worker.KillMode === 'control-group' &&
    bounded && restrictedSocket && runtime.workerCgroupMatches === true;
  return {
    schemaVersion: 1, readOnly: true,
    issue765: {
      apiRunning, apiNonRoot: nonRoot(api.User),
      mainProcessInServiceCgroup: runtime.apiCgroupMatches === true,
      cgroupPolicyConfigured: apiRunning && restricted && localhost(api.IPAddressAllow),
      cgroupAttachmentVerified: false,
      actualIPv4IPv6DenialVerified: false,
      userUrlDnsRebindingVerifiedOnHost: false,
      positiveProviderFlowsVerified: false,
      status: 'OPERATOR_ACCEPTANCE_REQUIRED',
    },
    issue774: {
      workerRunning, workerSandboxConfigured: workerSandbox,
      resourceLimitsConfigured: bounded,
      restrictedUnixSocket: restrictedSocket,
      mainProcessInServiceCgroup: runtime.workerCgroupMatches === true,
      socketActivationUnitRunning: runtime.socketUnitActive === true,
      forcedTimeoutProcessTreeVerifiedOnHost: false,
      failClosedApiIntegrationVerifiedOnHost: false,
      status: 'OPERATOR_ACCEPTANCE_REQUIRED',
    },
  };
}

function show(unit) {
  try {
    const result = execFileSync('systemctl',
      ['show', unit, '--no-pager', ...keys.flatMap((key) => ['-p', key])],
      { encoding: 'utf8', timeout: 8000, maxBuffer: 128 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return Object.fromEntries(result.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }));
  } catch { return {}; }
}
function socketState() {
  try {
    const file = statSync('/run/omi-pdf-worker.sock');
    // Resolve expected IDs without ever printing identities.
    const group = execFileSync('getent', ['group', 'omi-pdf-clients'],
      { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
    const owner = execFileSync('getent', ['passwd', 'omi-pdf-worker'],
      { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
    return {
      exists: true, isSocket: file.isSocket(),
      groupRestricted: (file.mode & 0o007) === 0 && (file.mode & 0o660) === 0o660,
      expectedIdentity: Number(group.trim().split(':')[2]) === file.gid &&
        Number(owner.trim().split(':')[2]) === file.uid,
    };
  } catch { return { exists: false, isSocket: false, groupRestricted: false, expectedIdentity: false }; }
}
function inCgroup(unit) {
  const pid = Number(unit.MainPID), group = unit.ControlGroup;
  if (!Number.isSafeInteger(pid) || pid < 2 || !group?.startsWith('/system.slice/')) return false;
  try {
    return readFileSync('/proc/' + pid + '/cgroup', 'utf8').split(/\r?\n/).includes('0::' + group);
  } catch { return false; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const api = show('omi-studio-api.service');
  const worker = show('omi-pdf-worker.service');
  const report = assessHostSecurity({
    api, worker, socket: socketState(),
    runtime: { apiCgroupMatches: inCgroup(api), workerCgroupMatches: inCgroup(worker),
      socketUnitActive: show('omi-pdf-worker.socket').ActiveState === 'active' },
  });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.issue765.apiRunning || !report.issue774.workerRunning) process.exitCode = 2;
}
