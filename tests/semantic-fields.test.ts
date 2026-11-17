import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSemanticField,
  getManuscriptFundingStatement,
  normalizeSemanticRole,
  updateSemanticField,
  validateSemanticFields,
} from '../src/model/semanticFields.ts';

const sections = [{ id: 'section-1', title: 'Introduction', blocks: [] }];

test('creates typed semantic fields with stable machine roles', () => {
  const field = createSemanticField({
    id: 'field-funding',
    role: 'Funding Statement',
    label: 'Finanszírozási nyilatkozat',
    valueType: 'rich-text',
    required: true,
  }, '2026-08-26T00:00:00.000Z');

  assert.equal(field.id, 'field-funding');
  assert.equal(field.role, 'funding-statement');
  assert.equal(field.label, 'Finanszírozási nyilatkozat');
  assert.equal(field.valueType, 'rich-text');
  assert.equal(field.value, '');
  assert.equal(field.required, true);
});

test('resolves only nonempty manuscript-level funding without duplicate notes', () => {
  const emptyFunding = createSemanticField({ role: 'funding-statement', label: 'Funding', value: '  ' });
  const sectionFunding = createSemanticField({ role: 'funding-statement', label: 'Section funding', scope: 'section', sectionId: 's1', value: 'Local grant' });
  const funding = createSemanticField({ role: 'funding-statement', label: 'Finanszírozás', value: '  Supported by Grant & Fund  <42>.  ' });
  assert.equal(getManuscriptFundingStatement({ semanticFields: [emptyFunding, sectionFunding, funding] }), 'Supported by Grant & Fund  <42>.');
  assert.equal(getManuscriptFundingStatement({ semanticFields: [sectionFunding] }), '');
  assert.equal(getManuscriptFundingStatement({}), '');
});

test('semantic role normalization is portable and independent from UI labels', () => {
  assert.equal(normalizeSemanticRole('Etikai nyilatkozat'), 'etikai-nyilatkozat');
  assert.equal(normalizeSemanticRole('Data availability / statement'), 'data-availability-statement');
});

test('validates required values and section targets', () => {
  const required = createSemanticField({
    id: 'required',
    role: 'ethics-statement',
    label: 'Ethics',
    valueType: 'text',
    required: true,
  });
  const sectionField = createSemanticField({
    id: 'section-field',
    role: 'section-note',
    label: 'Section note',
    valueType: 'text',
    scope: 'section',
    sectionId: 'missing-section',
  });

  const issues = validateSemanticFields({
    sections: sections as never,
    semanticFields: [required, sectionField],
  });
  assert.ok(issues.some((issue) => issue.fieldId === 'required' && issue.type === 'missing-required-value'));
  assert.ok(issues.some((issue) => issue.fieldId === 'section-field' && issue.type === 'missing-section'));
});

test('choice fields retain only declared options', () => {
  const field = createSemanticField({
    id: 'availability',
    role: 'data-availability-status',
    label: 'Availability',
    valueType: 'choice',
    options: ['open', 'restricted'],
    value: 'open',
  });
  const updated = updateSemanticField(field, { value: 'not-declared' });

  assert.equal(field.value, 'open');
  assert.equal(updated.value, '');
});

test('locking is semantic metadata and preserves the field value', () => {
  const field = createSemanticField({
    id: 'publisher-date',
    role: 'publication-date',
    label: 'Publication date',
    valueType: 'date',
    value: '2026-08-26',
  });
  const locked = updateSemanticField(field, { locked: true });

  assert.equal(locked.locked, true);
  assert.equal(locked.value, '2026-08-26');
});
