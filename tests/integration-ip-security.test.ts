import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isPublicRoutableAddress } from '../server/src/cloud/security/publicAddress.ts';
import { assertTrustedIntegrationUrl } from '../server/src/integrations/security/trustedRemoteUrl.ts';

test('OJS and OMP integration URL verifier reuses the WebDAV public-address boundary', () => {
  const source = readFileSync(
    new URL('../server/src/integrations/security/trustedRemoteUrl.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /import \{ isPublicRoutableAddress \} from/);
  assert.match(source, /addresses\.some\(\(\{ address \}\) => !isPublicRoutableAddress\(address\)\)/);
  assert.doesNotMatch(source, /function isPrivateIpv6/);
});

test('OJS / OMP integrations reject carrier-grade NAT and reserved IPv4 literals', async () => {
  for (const ip of ['100.64.0.1', '192.0.2.12', '198.51.100.18', '203.0.113.8', '169.254.169.254']) {
    const endpoint = 'https://' + ip + '/ojs';
    await assert.rejects(
      assertTrustedIntegrationUrl(endpoint, endpoint),
      /private or reserved network address/i,
      endpoint,
    );
  }
});

test('shared integration IP rule rejects mapped internal IPv6 addresses', () => {
  for (const ip of ['::ffff:127.0.0.1', '::ffff:169.254.169.254', '2001::1', '2002:0a00:0001::1', '2001:db8::1']) {
    assert.equal(isPublicRoutableAddress(ip), false, ip);
  }
});
