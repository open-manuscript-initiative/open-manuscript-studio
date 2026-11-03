#!/usr/bin/env node
/**
 * #765 production API egress evidence — strictly read-only.
 *
 * Inspects one fixed systemd unit and its effective cgroup BPF attachments,
 * plus the existing loopback-only /api/health endpoint. It cannot exercise
 * arbitrary destinations or infer live URL/DNS-rebinding enforcement.
 * Never reads .env, process environment, credentials or manuscript content.
 * Output contains only fixed field names, UTC time and booleans/status labels.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const UNIT = 'omi-studio-api.service';
const GROUP = '/system.slice/omi-studio-api.service';
const DENIED = Object.freeze([
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
  '169.254.0.0/16', 'fc00::/7', 'fe80::/10',
]);

function tokens(value) {
  return new Set(String(value ?? '').toLowerCase().split(/[\s,;]+/).filter(Boolean));
}
function hasLocalhost(value) {
  const items = tokens(value);
  return items.has('localhost') ||
    (items.has('127.0.0.0/8') && items.has('::1/128'));
}
function safeExec(file, args, maxBuffer = 128 * 1024) {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8', timeout: 5000, maxBuffer,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}
function showUnit() {
  const fields = ['ActiveState', 'MainPID', 'ControlGroup', 'IPAddressAllow', 'IPAddressDeny'];
  const output = safeExec('systemctl', ['show', UNIT, '--no-pager',
    ...fields.flatMap((field) => ['-p', field])]);
  if (output === null) return {};
  return Object.fromEntries(output.split(/\r?\n/).filter(line => line.includes('='))
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}
function actualCgroup(api) {
  const pid = Number(api.MainPID);
  if (!Number.isSafeInteger(pid) || pid <= 1 || api.ControlGroup !== GROUP) return null;
  try {
    return readFileSync('/proc/' + pid + '/cgroup', 'utf8');
  } catch {
    return null;
  }
}
function attachedBpf(api) {
  // Path is a fixed constant, not built from caller-controlled data.
  if (api.ControlGroup !== GROUP) return null;
  return safeExec('bpftool', ['cgroup', 'show', '/sys/fs/cgroup' + GROUP]);
}
async function loopbackHealth() {
  // Fixed loopback-only URL, no redirects or caller-provided destinations.
  return new Promise((done) => {
    const req = request({
      host: '127.0.0.1', port: 3001, path: '/api/health',
      method: 'GET', agent: false, timeout: 3000,
      headers: { connection: 'close' },
    }, (res) => {
      // Do not read or log the response body (may contain metadata).
      const ok = res.statusCode === 200;
      res.resume();
      res.once('end', () => done(ok));
      res.once('error', () => done(false));
    });
    req.once('timeout', () => req.destroy());
    req.once('error', () => done(false));
    req.end();
  });
}

export function assessHostEgressEvidence({ api = {}, procCgroup = null,
  bpfOutput = null, loopbackHealthy = false, observedAt = null } = {}) {
  const pid = Number(api.MainPID);
  const running = api.ActiveState === 'active' &&
    Number.isSafeInteger(pid) && pid > 1;
  const unitCgroup = api.ControlGroup === GROUP;
  const mainProcessInUnit = running && unitCgroup &&
    typeof procCgroup === 'string' &&
    procCgroup.split(/\r?\n/).includes('0::' + GROUP);
  const denies = tokens(api.IPAddressDeny);
  const policyConfigured = running && unitCgroup &&
    DENIED.every(range => denies.has(range)) && hasLocalhost(api.IPAddressAllow);
  const bpfAvailable = typeof bpfOutput === 'string';
  const bpfLines = bpfAvailable ? bpfOutput.split(/\r?\n/) : [];
  const ingress = bpfLines.some(line =>
    /\bcgroup_inet_ingress\b/.test(line) && /\bsd_fw_ingress\b/.test(line));
  const egress = bpfLines.some(line =>
    /\bcgroup_inet_egress\b/.test(line) && /\bsd_fw_egress\b/.test(line));

  return {
    schemaVersion: 1,
    readOnly: true,
    observedAt,
    checks: {
      apiActive: running,
      mainProcessInServiceCgroup: mainProcessInUnit,
      addressRangesConfigured: policyConfigured,
      bpfInspectionAvailable: bpfAvailable,
      ingressBpfAttached: ingress,
      egressBpfAttached: egress,
      loopbackApiHealthHttp200: loopbackHealthy === true,
    },
    // Deliberately NEVER auto-promote these to PASS from configuration,
    // BPF attachment, source regression or copied-policy canary results.
    requiresOwnerEvidence: {
      liveApiCgroupNegativeConnection: 'NOT_VERIFIED',
      enabledProviderWorkflows: 'NOT_VERIFIED',
      dnsRebindingAndProxyPaths: 'NOT_VERIFIED',
      candidateRuntimeDigest: 'NOT_VERIFIED',
      bootPersistenceAndRollback: 'NOT_VERIFIED',
      authorizedHostEgressReceipt: 'NOT_APPROVED',
    },
    status: 'OPERATOR_ACCEPTANCE_REQUIRED',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const api = showUnit();
  const result = assessHostEgressEvidence({
    api,
    procCgroup: actualCgroup(api),
    bpfOutput: attachedBpf(api),
    loopbackHealthy: await loopbackHealth(),
    observedAt: new Date().toISOString(),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.checks.apiActive ||
    !result.checks.mainProcessInServiceCgroup ||
    !result.checks.addressRangesConfigured ||
    !result.checks.ingressBpfAttached ||
    !result.checks.egressBpfAttached ||
    !result.checks.loopbackApiHealthHttp200) {
    process.exitCode = 2;
  }
}
