import assert from 'node:assert/strict';
import test from 'node:test';
import { apiBindHostSchema } from './apiBindHost.js';

test('keeps legacy container API binding unless explicitly configured', () => {
  assert.equal(apiBindHostSchema.parse(undefined), '0.0.0.0');
  assert.equal(apiBindHostSchema.parse('0.0.0.0'), '0.0.0.0');
});

test('accepts explicit host-local listener addresses for reverse proxy deployment', () => {
  assert.equal(apiBindHostSchema.parse('127.0.0.1'), '127.0.0.1');
  assert.equal(apiBindHostSchema.parse('::1'), '::1');
  assert.equal(apiBindHostSchema.parse('::'), '::');
});

test('rejects malformed and ambiguous listeners instead of silently opening a network port', () => {
  for (const value of ['', 'localhost', '127.0.0.2', '0.0.0.0:3001', '::ffff:127.0.0.1', '85.215.185.85', '127.0.0.1 ', '*']) {
    assert.equal(apiBindHostSchema.safeParse(value).success, false, value);
  }
});
