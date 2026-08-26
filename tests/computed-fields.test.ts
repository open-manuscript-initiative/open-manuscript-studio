import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countManuscriptWords,
  createComputedField,
  resolveComputedField,
  validateComputedFields,
} from '../src/model/computedFields.ts';
import { createSemanticField } from '../src/model/semanticFields.ts';

function manuscript() {
  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json' as const,
    id: 'm1', version: '0.1.0', identityModelVersion: 'OMI-SPEC-150@0.1.0' as const,
    locale: 'en', title: 'A semantic title', subtitle: 'Subtitle', abstract: 'Short abstract', keywords: [],
    agents: [], contributions: [], tombstones: [], annotations: [], citations: [],
    sections: [{ id: 's1', title: 'Introduction', blocks: [{ id: 'b1', type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Three words here' }] }] }) }] }],
    createdAt: '2026-01-02T12:00:00.000Z', updatedAt: '2026-02-03T12:00:00.000Z',
  };
}

test('document property and count fields resolve from live manuscript state', () => {
  const doc = manuscript();
  const title = createComputedField({ label: 'Title', kind: 'document-property', property: 'title' }, '2026-01-01T00:00:00.000Z');
  const sections = createComputedField({ label: 'Sections', kind: 'section-count' }, '2026-01-01T00:00:00.000Z');
  assert.equal(resolveComputedField(doc, title, 'en'), 'A semantic title');
  assert.equal(resolveComputedField(doc, sections, 'en'), '1');
  assert.ok(countManuscriptWords(doc) >= 8);
});

test('semantic-field computed values follow the source field', () => {
  const source = createSemanticField({ id: 'sf1', role: 'funding-statement', label: 'Funding', valueType: 'text', value: 'Grant 42' }, '2026-01-01T00:00:00.000Z');
  const field = createComputedField({ label: 'Funding value', kind: 'semantic-field', semanticFieldId: source.id }, '2026-01-01T00:00:00.000Z');
  const doc = { ...manuscript(), semanticFields: [source], computedFields: [field] };
  assert.equal(resolveComputedField(doc, field, 'en'), 'Grant 42');
  assert.deepEqual(validateComputedFields(doc), []);
});

test('cross-reference fields resolve current target numbering and titles', () => {
  const field = createComputedField({ label: 'Introduction reference', kind: 'cross-reference', crossReferenceTargetId: 's1', crossReferenceDisplayStyle: 'label-number-title' }, '2026-01-01T00:00:00.000Z');
  const doc = { ...manuscript(), computedFields: [field] };
  assert.match(resolveComputedField(doc, field, 'en'), /Introduction/);
  assert.deepEqual(validateComputedFields(doc), []);
});

test('validation reports missing dynamic sources instead of silently retargeting', () => {
  const missingSemantic = createComputedField({ label: 'Missing semantic source', kind: 'semantic-field', semanticFieldId: 'gone' }, '2026-01-01T00:00:00.000Z');
  const missingTarget = createComputedField({ label: 'Missing xref target', kind: 'cross-reference', crossReferenceTargetId: 'gone' }, '2026-01-01T00:00:00.000Z');
  const doc = { ...manuscript(), computedFields: [missingSemantic, missingTarget] };
  assert.deepEqual(validateComputedFields(doc).map((issue) => issue.type), ['missing-semantic-field', 'missing-cross-reference-target']);
});

test('current date uses deterministic supplied time and ISO presentation when requested', () => {
  const field = createComputedField({ label: 'Today', kind: 'current-date', dateStyle: 'iso' }, '2026-01-01T00:00:00.000Z');
  assert.equal(resolveComputedField(manuscript(), field, 'en', new Date('2026-08-26T07:00:00.000Z')), '2026-08-26');
});
