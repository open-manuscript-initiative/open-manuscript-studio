import test from 'node:test';
import assert from 'node:assert/strict';

import { studioFeedbackSchema } from '../server/src/model/studioFeedbackSchema.ts';

const valid = {
  category: 'bug',
  area: 'import',
  title: 'DOCX caption disappears',
  description: 'After importing a DOCX file the caption is not displayed.',
};

test('accepts minimal useful issue report without personal or technical metadata', () => {
  const result = studioFeedbackSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal('technical' in result.data, false);
    assert.equal('contactEmail' in result.data, false);
  }
});

test('accepts explicitly supplied technical context for Android tests', () => {
  const result = studioFeedbackSchema.safeParse({
    ...valid,
    category: 'test',
    area: 'notes',
    testOutcome: 'success',
    technical: { platform: 'android', appVersion: '1.0.0-rc.2', locale: 'hu' },
  });
  assert.equal(result.success, true);
});

test('never allows manuscript content, secret fields or raw diagnostic logs', () => {
  for (const forbidden of [
    { manuscript: 'private draft text' },
    { manuscriptId: 'draft-123' },
    { accessToken: 'secret' },
    { errorLogs: ['private path'] },
    { screenshot: 'data:image/png;base64,AAAA' },
  ]) {
    assert.equal(studioFeedbackSchema.safeParse({ ...valid, ...forbidden }).success, false);
  }
});

test('rejects invalid category, excessive text and malformed contact e-mail', () => {
  assert.equal(studioFeedbackSchema.safeParse({ ...valid, category: 'analytics' }).success, false);
  assert.equal(studioFeedbackSchema.safeParse({ ...valid, description: 'x'.repeat(4001) }).success, false);
  assert.equal(studioFeedbackSchema.safeParse({ ...valid, contactEmail: 'invalid@@example' }).success, false);
});

test('rejects additional technical fingerprinting properties', () => {
  assert.equal(studioFeedbackSchema.safeParse({
    ...valid,
    technical: { platform: 'android', appVersion: '1', locale: 'hu', deviceId: 'abc' },
  }).success, false);
});
