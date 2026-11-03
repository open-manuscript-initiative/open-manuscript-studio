#!/usr/bin/env node
/**
 * #765: app-path canary using the STAGED compiled Studio transport, not a
 * production API request. Executes only inside the Python verified isolated
 * namespace + separate systemd cgroup. No credentials or manuscript content.
 *
 * All destinations are fixed synthetic IPs bound only on that namespace's
 * loopback interface by the accompanying launcher. Never use cloud metadata.
 */
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const allowedRoot = '/srv/omi-rc-staging/';
const stage = resolve(process.argv[2] ?? '/nonexistent');
const ports = (process.argv.slice(3, 7)).map(Number);
if (process.platform !== 'linux' || process.getuid?.() === 0 ||
    !stage.startsWith(allowedRoot) ||
    ports.length !== 4 ||
    ports.some(port => !Number.isSafeInteger(port) || port < 1024 || port > 65535) ||
    process.env.NODE_ENV !== 'production' ||
    process.env.OMI_ISOLATED_NETNS_VERIFIED !== 'true') {
  throw new Error('Isolated non-root production-mode staging preconditions failed');
}

const report = {
  schemaVersion: 1,
  scope: 'separate-transient-service-cgroup',
  applicationTransport: 'NOT_VERIFIED',
  webdavApplicationPath: 'NOT_VERIFIED',
  privateIpv4Kernel: 'NOT_VERIFIED',
  linkLocalIpv4Kernel: 'NOT_VERIFIED',
  uniqueLocalIpv6Kernel: 'NOT_VERIFIED',
  loopbackKernelPositive: 'NOT_VERIFIED',
  actualProductionApiCgroup: 'NOT_TESTED',
  actualProductionUserUrl: 'NOT_TESTED',
  ownerReleaseGate: 'NOT_APPROVED',
};

function tcp(host, port, expectAllowed) {
  return new Promise((done) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      done(status);
    };
    socket.setTimeout(1500, () => finish('INCONCLUSIVE'));
    socket.once('connect', () => finish(expectAllowed ? 'PASS' : 'FAIL'));
    socket.once('error', (error) => {
      // Only an explicit kernel permission denial counts as blocked. A
      // refused/absent service, route failure or timeout is NOT a PASS.
      const blocked = error?.code === 'EACCES' || error?.code === 'EPERM';
      finish(expectAllowed ? 'FAIL' : blocked ? 'PASS' : 'INCONCLUSIVE');
    });
  });
}
const compiledBase = join(stage, 'server', 'dist', 'cloud');
const { fetchPinnedPublicUrl, connectionTimePublicLookup } =
  await import(pathToFileURL(join(compiledBase, 'security', 'connectionPinnedHttp.js')).href);
const { WebDavProvider } =
  await import(pathToFileURL(join(compiledBase, 'providers', 'webdav', 'WebDavProvider.js')).href);

async function rejectsPrivate(target) {
  try {
    await fetchPinnedPublicUrl(target);
    return false;
  } catch (error) {
    return /private or reserved/i.test(String(error?.message));
  }
}

const targets = [
  'https://10.243.241.1:' + ports[1] + '/',
  'https://169.254.241.1:' + ports[2] + '/',
  'https://[fd74::241]:' + ports[3] + '/',
  'https://127.0.0.1:' + ports[0] + '/',
];
const literalsRejected = (await Promise.all(targets.map(rejectsPrivate))).every(Boolean);
let rebindingRejected = false;
const lookup = connectionTimePublicLookup(new URL('https://operator-test.invalid/'),
  async () => [{ address: '10.243.241.1', family: 4 }]);
await new Promise((done) => {
  lookup('operator-test.invalid', { all: true }, (error) => {
    rebindingRejected = !!error && /private or reserved/.test(error.message);
    done();
  });
});
let redirectRejected = false;
try {
  await fetchPinnedPublicUrl('https://operator-test.invalid/', { redirect: 'follow' });
} catch (error) {
  redirectRejected = /redirects are prohibited/.test(String(error?.message));
}
report.applicationTransport = literalsRejected && rebindingRejected && redirectRejected
  ? 'PASS' : 'FAIL';

// Real compiled WebDAV application code, using a synthetic, isolated URL and
// dummy credentials. Expected fail-closed. No actual WebDAV provider touched.
const provider = new WebDavProvider({
  baseUrl: 'https://10.243.241.1:' + ports[1] + '/',
  rootPath: '',
  username: 'test-only',
  password: 'test-only',
});
const status = await provider.getStatus();
report.webdavApplicationPath = status.state === 'error' ? 'PASS' : 'FAIL';

const [v4, link, v6, loopback] = await Promise.all([
  tcp('10.243.241.1', ports[1], false),
  tcp('169.254.241.1', ports[2], false),
  tcp('fd74::241', ports[3], false),
  tcp('127.0.0.1', ports[0], true),
]);
report.privateIpv4Kernel = v4;
report.linkLocalIpv4Kernel = link;
report.uniqueLocalIpv6Kernel = v6;
report.loopbackKernelPositive = loopback;

const required = [
  report.applicationTransport, report.webdavApplicationPath,
  report.privateIpv4Kernel, report.linkLocalIpv4Kernel,
  report.uniqueLocalIpv6Kernel, report.loopbackKernelPositive,
];
report.result = required.every(value => value === 'PASS') ? 'PASS' :
  required.some(value => value === 'FAIL') ? 'FAIL' : 'INCONCLUSIVE';

// Printed output contains only fixed labels/status strings; never print
// DNS answers, terminal paths, IP/port, service accounts or raw errors.
process.stdout.write(JSON.stringify(report) + '\n');
if (report.result !== 'PASS') process.exitCode = 2;
