import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeLatexText, escapeLatexUrl } from '../src/services/latexEscaping.ts';

test('escapes LaTeX text in one pass without re-escaping generated commands', () => {
  assert.equal(
    escapeLatexText('A\\B # $ % & _ { } ~ ^'),
    'A\\textbackslash{}B \\# \\$ \\% \\& \\_ \\{ \\} \\textasciitilde{} \\textasciicircum{}',
  );
});

test('normalizes line breaks to explicit LaTeX breaks', () => {
  assert.equal(escapeLatexText('first\r\nsecond\nthird'), 'first\\\\ second\\\\ third');
});

test('escapes characters that can break a hyperref URL argument', () => {
  assert.equal(
    escapeLatexUrl('https://example.org/a{b}#c%20\\d'),
    'https://example.org/a%7Bb%7D\\#c\\%20%5Cd',
  );
});
