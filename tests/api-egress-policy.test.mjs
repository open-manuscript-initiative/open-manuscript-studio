import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TABLE_NAME, RESERVED_V4, RESERVED_V6, validatePolicy, isStrictPublicCidr, renderPolicy,
} from '../scripts/egress/generate-policy.mjs';
import {
  extractDenyCounters, verifyDeniedProbeCounts,
} from '../scripts/egress/check-live-policy.mjs';

function profile() {
  return {
    schemaVersion: 1,
    service: 'omi-studio-api.service',
    uid: 1500,
    localExceptions: [
      { address: '127.0.0.1', protocol: 'tcp', port: 5432 },
      { address: '127.0.0.53', protocol: 'udp', port: 53 },
      { address: '::1', protocol: 'tcp', port: 5432 },
    ],
    outbound: [
      { cidr: '1.1.1.1/32', protocol: 'tcp', port: 443 },
      { cidr: '2606:4700:4700::1111/128', protocol: 'tcp', port: 443 },
    ],
  };
}

test('nft generator is private-UID scoped, default-deny, counters enabled and never affects global host INPUT', () => {
  const rendered = renderPolicy(profile());
  assert.match(rendered, /^table inet omi_studio_api_egress \{/m);
  assert.match(rendered, /hook output priority -50; policy accept/);
  assert.doesNotMatch(rendered, /hook input|hook forward|flush ruleset|systemctl/);
  assert.match(rendered, /meta skuid 1500 ct state \{ established, related \} accept/);
  assert.match(rendered, /meta skuid 1500 ip daddr 127\.0\.0\.1 tcp dport 5432 counter accept/);
  assert.match(rendered, /meta skuid 1500 ip daddr 127\.0\.0\.53 udp dport 53 counter accept/);
  assert.match(rendered, /meta skuid 1500 ip6 daddr ::1 tcp dport 5432 counter accept/);
  assert.match(rendered, /meta skuid 1500 ip daddr 1\.1\.1\.1\/32 tcp dport 443 counter accept/);
  assert.match(rendered, /meta skuid 1500 ip6 daddr 2606:4700:4700::1111\/128 tcp dport 443 counter accept/);
  assert.match(rendered, /meta skuid 1500 counter reject comment "omi-unapproved-egress"/);
  for (const cidr of RESERVED_V4) assert.ok(rendered.includes(cidr), 'missing private IPv4 drop: ' + cidr);
  for (const cidr of RESERVED_V6) assert.ok(rendered.includes(cidr), 'missing private IPv6 drop: ' + cidr);
  assert.ok(rendered.indexOf('omi-nonpublic-v4') < rendered.indexOf('omi-approved-public-egress'));
  assert.ok(rendered.indexOf('omi-nonpublic-v6') < rendered.indexOf('omi-approved-public-egress'));
});

test('root and placeholder UIDs, nonexistent service or empty allowlist fail closed', () => {
  for (const uid of [0, 99, -1, 1.2, '1500', 2147483648]) {
    assert.throws(() => validatePolicy({ ...profile(), uid }), /numeric UID|privileged/i);
  }
  assert.throws(() => renderPolicy({ ...profile(), service: 'plesk.service' }), /only to omi-studio-api/);
  assert.throws(() => renderPolicy({ ...profile(), outbound: [] }), /approved public destination/);
});

test('local exceptions accept only exact reviewed private service IP and refuse local http(s)', () => {
  for (const address of ['8.8.8.8','172.0.0.1','172.40.1.1','2001:4860::1']) {
    const input = { ...profile(), localExceptions: [{ address, protocol: 'tcp', port: 5432 }] };
    assert.throws(() => validatePolicy(input), /loopback or explicitly private/);
  }
  for (const port of [80, 443]) {
    const input = { ...profile(), localExceptions: [{ address: '127.0.0.1', protocol: 'tcp', port }] };
    assert.throws(() => validatePolicy(input), /local HTTP/);
  }
  for (const address of ['127.0.0.1/8','127.0.0.1; drop','localhost']) {
    const input = { ...profile(), localExceptions: [{ address, protocol: 'tcp', port: 5432 }] };
    assert.throws(() => validatePolicy(input), /endpoint requires one IP/);
  }
});

test('strict public CIDR validates both families and excludes mapped, private, documentation and translation networks', () => {
  for (const cidr of ['8.8.8.8/32','1.1.1.0/24','2606:4700:4700::/48','2001:4860:4860::8888/128']) {
    const family = cidr.includes(':') ? 6 : 4;
    assert.equal(isStrictPublicCidr(cidr, family), true, cidr);
  }
  for (const cidr of ['0.0.0.0/0','10.0.0.0/8','100.64.0.0/10','127.0.0.1/32',
    '169.254.169.254/32','192.168.1.1/32','192.0.2.0/24','198.51.100.1/32',
    '203.0.113.0/24','224.0.0.0/4','1.0.0.0/4']) {
    assert.equal(isStrictPublicCidr(cidr, 4), false, cidr);
  }
  for (const cidr of ['::/0','::1/128','::ffff:127.0.0.1/128','64:ff9b::/96',
    '2001::/32','2001:db8::/32','2002::/16','3fff::/20','fd00::/8','fe80::/10']) {
    assert.equal(isStrictPublicCidr(cidr, 6), false, cidr);
  }
});

test('broad public prefixes, special/private overlap, duplicate entries and payloads are rejected', () => {
  for (const cidr of ['1.0.0.0/8','0.0.0.0/0','8.8.8.8/999','8.8.8.8; drop',
    '172.16.0.0/12','192.0.0.0/16','198.18.0.0/15','203.0.113.12/32',
    '2001:db8::/32', '2a00::/7']) {
    const input = { ...profile(), outbound: [{ cidr, protocol: 'tcp', port: 443 }] };
    assert.throws(() => validatePolicy(input), /range too broad|nonpublic|Malformed/i, cidr);
  }
  const input = profile();
  input.outbound.push({ ...input.outbound[0] });
  assert.throws(() => validatePolicy(input), /Duplicate/);
});

function nftCounters(v4, v6, other) {
  return { nftables: [
    { rule: { family: 'inet', table: TABLE_NAME, chain: 'output',
      comment: 'omi-nonpublic-v4', expr: [{ counter: { packets: v4, bytes: v4 * 40 } }, { reject: { type: 'icmpx', expr: 'admin-prohibited' } }] } },
    { rule: { family: 'inet', table: TABLE_NAME, chain: 'output',
      comment: 'omi-nonpublic-v6', expr: [{ counter: { packets: v6, bytes: v6 * 40 } }, { reject: { type: 'icmpx', expr: 'admin-prohibited' } }] } },
    { rule: { family: 'inet', table: TABLE_NAME, chain: 'output',
      comment: 'omi-unapproved-egress', expr: [{ counter: { packets: other, bytes: other * 40 } }, { reject: { type: 'icmpx', expr: 'admin-prohibited' } }] } },
  ] };
}

test('live acceptance requires real kernel reject counters from both IP families', () => {
  const before = extractDenyCounters(nftCounters(4, 8, 12));
  const after = extractDenyCounters(nftCounters(6, 9, 16));
  assert.deepEqual(verifyDeniedProbeCounts(before, after), []);
  assert.equal(verifyDeniedProbeCounts(before, before).length, 2);
  assert.match(verifyDeniedProbeCounts(before, { ...after, 'omi-nonpublic-v6': 8 }).join(';'), /IPv6/);
});

test('no missing nft chain, accept-only rule or absence of counters can masquerade as acceptance', () => {
  assert.throws(() => extractDenyCounters({ nftables: [] }), /Missing or duplicate/);
  const example = nftCounters(1, 1, 1);
  delete example.nftables[0].rule.expr[1].reject;
  assert.throws(() => extractDenyCounters(example), /no reject/);
  const missing = nftCounters(1, 1, 1);
  delete missing.nftables[1].rule.expr[0].counter;
  assert.throws(() => extractDenyCounters(missing), /no readable packet counter/);
});
