import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addKeywords,
  normalizeKeywords,
  parseKeywordInput,
  removeKeyword,
} from '../src/model/keywords.ts';

test('normalizes whitespace and removes empty keywords', () => {
  assert.deepEqual(
    normalizeKeywords(['  open   science  ', '', ' publishing ']),
    ['open science', 'publishing'],
  );
});

test('deduplicates keywords case-insensitively while preserving first spelling', () => {
  assert.deepEqual(
    normalizeKeywords(['History', 'history', 'HISTORY', 'Archives']),
    ['History', 'Archives'],
  );
});

test('parses comma, semicolon and newline separated keyword input', () => {
  assert.deepEqual(
    parseKeywordInput('church history; archives\nReformation, manuscripts'),
    ['church history', 'archives', 'Reformation', 'manuscripts'],
  );
});

test('adds parsed keywords without duplicating existing values', () => {
  assert.deepEqual(
    addKeywords(['History'], 'history, Archives'),
    ['History', 'Archives'],
  );
});

test('removes only the requested keyword and preserves order', () => {
  assert.deepEqual(
    removeKeyword(['History', 'Archives', 'Religion'], 'Archives'),
    ['History', 'Religion'],
  );
});
