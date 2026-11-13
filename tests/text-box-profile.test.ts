import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv2020/dist/2020.js';
import { createTextBox, textBoxPlainText } from '../src/model/textBoxes.ts';
import { TEXT_BOX_CONTENT_PROFILE, TEXT_BOX_SOURCE_EXTENSION, encodeTextBoxContent, decodeTextBoxContent, editedTextBox } from '../src/model/textBoxContent.ts';
import { createTextBoxBlock } from '../src/model/visualBlocks.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';

const fixture = JSON.parse(readFileSync(new URL('../src/schemas/fixtures/text-box-content-0.1.json', import.meta.url), 'utf8'));
const schema = JSON.parse(readFileSync(new URL('../src/schemas/text-box-content-0.1.schema.json', import.meta.url), 'utf8'));

test('portable profile golden round-trips semantic runs through the editor adapter and independent schema', () => {
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.ok(validate(fixture), JSON.stringify(validate.errors));
  const content = JSON.stringify(fixture);
  const decoded = decodeTextBoxContent(content, TEXT_BOX_CONTENT_PROFILE);
  assert.deepEqual(decoded.diagnostics, []);
  assert.deepEqual(JSON.parse(encodeTextBoxContent(decoded.document)), fixture);
  const box = { ...createTextBox(), content };
  assert.equal(textBoxPlainText(box), 'Árvíz & <x>\n2\nSecond paragraph');
  const m = createVersionedTestManuscript();
  m.sections[0].blocks.push(createTextBoxBlock(box));
  assert.deepEqual(parseOmiJson(serializeOmiJson(m)).sections[0].blocks.at(-1)?.visual, { kind: 'text-box', textBox: box });
});

test('known profiles reject invalid content while unknown versions retain exact opaque data and export warnings', () => {
  const m = createVersionedTestManuscript();
  const box = createTextBox('editable');
  const block = createTextBoxBlock(box);
  m.sections[0].blocks.push(block);
  box.content = '{"format":"omi-text-box-content","version":"0.1.0","paragraphs":null}';
  assert.throws(() => parseOmiJson(serializeOmiJson(m)), /text.box|content|profile/i);
  box.contentProfile = 'https://example.org/text-box/future';
  box.content = '{ "future": ["unrecognized", "α"] }';
  const before = JSON.stringify(box);
  const reopened = parseOmiJson(serializeOmiJson(m));
  assert.deepEqual(reopened.sections[0].blocks.at(-1)?.visual, block.visual);
  for (const render of [renderHtmlArticle, renderJatsArticle]) {
    assert.ok(render(m).diagnostics.some(d => d.code === 'text-box-unknown-profile' && d.targetId === box.id));
  }
  assert.equal(JSON.stringify(box), before);
  const edited = editedTextBox(box, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Author edited' }] }] });
  assert.equal(textBoxPlainText(edited), 'Author edited');
  assert.deepEqual(edited.extensions?.[TEXT_BOX_SOURCE_EXTENSION], { contentProfile: box.contentProfile, content: box.content });
  assert.equal(JSON.stringify(box), before);
});

test('opening legacy or additive content never rewrites it; explicit edits retain unsupported source', () => {
  for (const value of [
    { content: 'Own literal plain text' },
    { content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'legacy', marks: [{ type: 'futureMark' }] }] }] }) },
    { contentProfile: TEXT_BOX_CONTENT_PROFILE, content: JSON.stringify({ ...fixture, future: { literal: true } }) },
  ]) {
    const box = createTextBox(); delete box.contentProfile; Object.assign(box, value);
    const before = JSON.stringify(box);
    const m = createVersionedTestManuscript(); m.sections[0].blocks.push(createTextBoxBlock(box));
    const reopened = parseOmiJson(serializeOmiJson(m));
    assert.deepEqual(reopened.sections[0].blocks.at(-1)?.visual, m.sections[0].blocks.at(-1)?.visual);
    const decoded = decodeTextBoxContent(box.content, box.contentProfile);
    if (decoded.diagnostics.length) assert.deepEqual(editedTextBox(box, decoded.document).extensions?.[TEXT_BOX_SOURCE_EXTENSION], value);
    assert.equal(JSON.stringify(box), before);
  }
});
