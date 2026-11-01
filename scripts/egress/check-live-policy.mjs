import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TABLE_NAME, validatePolicy, isStrictPublicCidr } from './generate-policy.mjs';

const SERVICE = 'omi-studio-api.service';
const NEGATIVE_TARGETS = Object.freeze([
  'http://127.0.0.2:443/',
  'http://169.254.169.254:80/',
  'http://10.255.255.1:443/',
  'http://[::1]:443/',
  'http://[fd00::1]:443/',
]);
function command(name, args) {
  return execFileSync(name, args, {
    encoding: 'utf8', timeout: 12000, maxBuffer: 1024 * 1024,
    env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C' },
  }).trim();
}
export function extractDenyCounters(ruleset) {
  const rules = Array.isArray(ruleset?.nftables)
    ? ruleset.nftables.filter(item =>
        item.rule?.family === 'inet' &&
        item.rule?.table === TABLE_NAME &&
        item.rule?.chain === 'output')
    : [];
  const required = ['omi-nonpublic-v4', 'omi-nonpublic-v6', 'omi-unapproved-egress'];
  const counters = {};
  for (const comment of required) {
    const matching = rules.filter(entry => entry.rule?.comment === comment);
    if (matching.length !== 1) throw new Error('Missing or duplicate nft rejection rule: ' + comment);
    const expr = matching[0].rule.expr;
    if (!Array.isArray(expr) || !expr.some(x => Object.hasOwn(x, 'reject'))) {
      throw new Error('Rule has no reject action: ' + comment);
    }
    const counter = expr.find(x => x.counter)?.counter;
    if (!counter || !Number.isFinite(counter.packets)) {
      throw new Error('Rule has no readable packet counter: ' + comment);
    }
    counters[comment] = counter.packets;
  }
  return counters;
}
export function verifyDeniedProbeCounts(before, after) {
  const errors = [];
  if ((after['omi-nonpublic-v4'] ?? 0) <= (before['omi-nonpublic-v4'] ?? 0)) {
    errors.push('No counted IPv4 private/metadata rejection under API UID');
  }
  if ((after['omi-nonpublic-v6'] ?? 0) <= (before['omi-nonpublic-v6'] ?? 0)) {
    errors.push('No counted IPv6 private/local rejection under API UID');
  }
  return errors;
}

function readCounters() {
  const json = JSON.parse(command('nft', ['-j', 'list', 'chain', 'inet', TABLE_NAME, 'output']));
  return extractDenyCounters(json);
}
function asApiUser(user, url) {
  // No bearer headers, cookies, local env, proxies, redirect following, DNS
  // override or user-supplied connection credentials. Body is discarded.
  return spawnSync('runuser', [
    '-u', user, '--',
    'env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C',
    'curl', '--silent', '--output', '/dev/null', '--head',
    '--max-time', '4', '--connect-timeout', '2',
    '--noproxy', '*', '--max-redirs', '0', '--write-out', '%{http_code}',
    url,
  ], { encoding: 'utf8', timeout: 8000, maxBuffer: 1024 });
}

function main(args) {
  if (args.length < 2 || args[0] !== '--profile') {
    throw new Error('Usage (root): node scripts/egress/check-live-policy.mjs --profile /root/private-api-profile.json [--approved-url https://approved.example]');
  }
  const profile = validatePolicy(JSON.parse(readFileSync(resolve(args[1]), 'utf8')));
  const urlIndex = args.indexOf('--approved-url');
  const approvedUrl = urlIndex === -1 ? null : args[urlIndex + 1];
  if (approvedUrl) {
    const target = new URL(approvedUrl);
    const version = isIP(target.hostname.replace(/^\[|\]$/g, ''));
    if (target.protocol !== 'https:' || target.username || target.password ||
        target.hash || (target.port && target.port !== '443') ||
        target.hostname === 'localhost' || target.hostname.endsWith('.localhost') ||
        target.hostname.endsWith('.local') ||
        (version > 0 && !isStrictPublicCidr(
          target.hostname.replace(/^\[|\]$/g, ''), version,
        ))) {
      throw new Error('Positive probe must be an approved public HTTPS origin on port 443 without credentials');
    }
  }
  if (process.getuid?.() !== 0) throw new Error('Requires root for read-only nft counters and isolated runuser probes');
  const effectiveUser = command('systemctl', ['show', SERVICE, '-p', 'User', '--value']);
  if (!effectiveUser || effectiveUser === 'root' || effectiveUser === '0') {
    throw new Error('API service user is empty or privileged; stop and review service identity');
  }
  const uid = Number(command('id', ['-u', effectiveUser]));
  if (uid !== profile.uid) throw new Error('Live API service UID does not match reviewed profile');
  const active = command('systemctl', ['is-active', SERVICE]);
  if (active !== 'active') throw new Error('Studio API service is not active');
  const before = readCounters();
  console.log('Dedicated API UID and nft rule counters exist; testing blocked network destinations (no response bodies).');
  for (const url of NEGATIVE_TARGETS) {
    const result = asApiUser(effectiveUser, url);
    if (result.error) throw result.error;
    if (result.status === 0 || (result.stdout || '') !== '000') {
      throw new Error('A forbidden address unexpectedly returned an HTTP response: deny acceptance FAILED');
    }
  }
  const after = readCounters();
  const errors = verifyDeniedProbeCounts(before, after);
  if (errors.length) throw new Error(errors.join('; '));
  console.log('PASS: IPv4 and IPv6 forbidden-destination requests incremented kernel egress reject counters.');
  if (approvedUrl) {
    const result = asApiUser(effectiveUser, approvedUrl);
    if (result.error) throw result.error;
    const code = (result.stdout || '').trim();
    if (!/^[1-5]\d\d$/.test(code)) {
      throw new Error('Positive approved HTTPS endpoint could not be reached; check endpoint IP allowlist and DNS');
    }
    console.log('PASS: approved HTTPS destination reachable (HTTP response observed; credentials not tested).');
  } else {
    console.log('INCOMPLETE: no approved HTTPS endpoint tested; provide --approved-url for production acceptance.');
    process.exitCode = 3;
  }
  console.log('NOT PROVEN: shared UID exclusivity, allowed-port SSRF, DNS rebinding of all API connectors, container FORWARD paths, or production publisher WebDAV with credentials.');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error('EGRESS NOT ACCEPTED: ' + (error instanceof Error ? error.message : 'unknown failure'));
    process.exitCode = 1;
  }
}
