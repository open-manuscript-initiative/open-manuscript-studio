import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractWordGeneratedListsFromXml,
} from '../src/services/docxGeneratedListImport.ts';

test('recognizes Word caption lists and INDEX result caches before body import', () => {
  const xml = `
    <w:document xmlns:w="urn:test"><w:body>
      <w:p><w:r><w:t>Ábrajegyzék</w:t></w:r></w:p>
      <w:p>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> TOC \\h \\z \\c "ábra" </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>1. ábra. Első kép</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>17</w:t></w:r>
      </w:p>
      <w:p><w:r><w:t>2. ábra. Második kép</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>21</w:t></w:r></w:p>
      <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
      <w:p><w:r><w:t>Névjegyzék</w:t></w:r></w:p>
      <w:p>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText xml:space="preserve"> INDEX \\c "2" \\z "1038" </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>Apaffi György I.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>29</w:t></w:r>
      </w:p>
      <w:p><w:r><w:t>Bethlen Gábor</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>31</w:t></w:r></w:p>
      <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
      <w:p><w:r><w:t>Valódi törzsszöveg</w:t></w:r></w:p>
    </w:body></w:document>`;

  const result = extractWordGeneratedListsFromXml(xml);
  assert.equal(result.definitions.length, 1);
  assert.equal(result.definitions[0]?.kind, 'figures');
  assert.equal(result.definitions[0]?.title, 'Ábrajegyzék');
  assert.equal(result.definitions[0]?.source?.captionLabel, 'ábra');
  assert.ok(result.headings.has('ábrajegyzék'));
  assert.ok(result.headings.has('névjegyzék'));
  assert.ok(result.renderedLines.has('1. ábra. első kép'));
  assert.ok(result.renderedLines.has('2. ábra. második kép'));
  assert.ok(result.renderedLines.has('apaffi györgy i.'));
  assert.ok(result.renderedLines.has('bethlen gábor'));
  assert.equal(result.renderedLines.has('valódi törzsszöveg'), false);
});

test('keeps Word caption labels semantic, including custom map sequences', () => {
  const xml = `
    <w:document xmlns:w="urn:test"><w:body>
      <w:p><w:r><w:t>Térképjegyzék</w:t></w:r></w:p>
      <w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\h \\z \\c "Térkép" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1. Térkép</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>44</w:t></w:r></w:p>
      <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
    </w:body></w:document>`;
  const result = extractWordGeneratedListsFromXml(xml);
  assert.equal(result.definitions[0]?.kind, 'figures');
  assert.equal(result.definitions[0]?.source?.captionLabel, 'Térkép');
  assert.equal(result.definitions[0]?.title, 'Térképjegyzék');
});
