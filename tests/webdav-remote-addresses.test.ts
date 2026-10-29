import assert from 'node:assert/strict';
import test from 'node:test';

import { isPublicRoutableAddress } from '../server/src/cloud/security/publicAddress.ts';

test('WebDAV permits publicly routed IPv4 and IPv6 endpoints', () => {
  assert.equal(isPublicRoutableAddress('8.8.8.8'), true);
  assert.equal(isPublicRoutableAddress('1.1.1.1'), true);
  assert.equal(isPublicRoutableAddress('2606:4700:4700::1111'), true);
  assert.equal(isPublicRoutableAddress('2001:4860:4860::8888'), true);
});

test('WebDAV rejects private and special-purpose IPv4 addresses', () => {
  for (const address of [
    '127.0.0.1', '10.1.2.3', '172.16.1.2', '192.168.1.1',
    '169.254.169.254', '100.64.1.1', '100.127.255.254',
    '192.0.0.5', '192.0.2.1', '198.18.0.1', '198.19.255.254',
    '198.51.100.1', '203.0.113.1', '224.0.0.1', '0.0.0.0',
  ]) {
    assert.equal(isPublicRoutableAddress(address), false, address);
  }
});

test('WebDAV rejects IPv4-mapped, local and reserved IPv6 addresses', () => {
  for (const address of [
    '::1', '::', '::ffff:127.0.0.1', '::ffff:192.168.1.2',
    '0:0:0:0:0:ffff:169.254.169.254',
    'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
    '64:ff9b::c0a8:101', '2001:db8::1', '2001:0db8::2',
    '2001::1', '2002:c0a8:0101::1', '3fff::1',
  ]) {
    assert.equal(isPublicRoutableAddress(address), false, address);
  }
});
