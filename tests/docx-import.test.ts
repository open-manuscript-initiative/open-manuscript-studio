import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHeadingHierarchy,
  detectKeywordLine,
  headingLevelFromStyle,
  mapWordSourceType,
  mergeDetectedAuthors,
  parseDetectedAuthors,
  parseWordCitationInstruction,
  parseWordHyperlinkInstruction,
  wordCharacterStyleSemantics,
} from '../src/model/docxImport.ts';
import {
  LARGE_DOCX_THRESHOLD_BYTES,
  MAX_DOCX_PACKAGE_BYTES,
  MONOGRAPH_DOCX_THRESHOLD_BYTES,
  MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES,
  isLargeDocx,
  isMonographComplexity,
} from '../src/services/docxImportStrategy.ts';
import {
  extractRenderedWordTocLines,
  normalizeWordTocDisplayText,
} from '../src/services/docxTocImport.ts';

test('recognizes Word heading levels from built-in and localized style names', () => {
  assert.equal(headingLevelFromStyle('Heading2', undefined, undefined), 2);
  assert.equal(headingLevelFromStyle(undefined, 'Címsor 3', undefined), 3);
  assert.equal(headingLevelFromStyle(undefined, 'Überschrift 4', undefined), 4);
  assert.equal(headingLevelFromStyle(undefined, 'Normal', 1), 2);
});

test('recognizes Word character styles as portable inline semantics', () => {
  assert.deepEqual(wordCharacterStyleSemantics('Emphasis', 'Emphasis'), ['emphasis']);
  assert.deepEqual(wordCharacterStyleSemantics('Strong', 'Strong'), ['strong']);
  assert.deepEqual(wordCharacterStyleSemantics('Dolt', 'Dőlt'), ['emphasis']);
  assert.deepEqual(wordCharacterStyleSemantics('Felkover', 'Félkövér'), ['strong']);
  assert.deepEqual(wordCharacterStyleSemantics('Kiskapitalis', 'Kiskapitális'), ['small-caps']);
  assert.deepEqual(wordCharacterStyleSemantics('Underline', 'Aláhúzott'), ['underline']);
});

test('derives stable parent relationships from heading depth changes', () => {
  assert.deepEqual(
    buildHeadingHierarchy([
      { id: 'a', level: 1 },
      { id: 'b', level: 2 },
      { id: 'c', level: 3 },
      { id: 'd', level: 2 },
      { id: 'e', level: 1 },
    ]),
    [
      { id: 'a', parentId: undefined },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: 'a' },
      { id: 'e', parentId: undefined },
    ],
  );
});

test('parses and deduplicates DOCX author metadata without claiming verification', () => {
  const core = parseDetectedAuthors('Ada Lovelace; Alan Turing', 'core-properties');
  const styled = parseDetectedAuthors('Ada Lovelace', 'author-style');
  const merged = mergeDetectedAuthors(core, styled);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], {
    displayName: 'Ada Lovelace',
    givenName: 'Ada',
    familyName: 'Lovelace',
    source: 'core-properties',
  });
});

test('extracts single and clustered Word CITATION source tags', () => {
  assert.deepEqual(
    parseWordCitationInstruction(' CITATION Smith2020 \\l 1033 '),
    ['Smith2020'],
  );
  assert.deepEqual(
    parseWordCitationInstruction('CITATION Smith2020 \\m Jones2021 \\l 1033'),
    ['Smith2020', 'Jones2021'],
  );
});

test('extracts a Word HYPERLINK target without retaining field switches', () => {
  assert.equal(
    parseWordHyperlinkInstruction('HYPERLINK "https://openmanuscript.org/docs" \\o "OMI"'),
    'https://openmanuscript.org/docs',
  );
});

test('recognizes multilingual keyword lines', () => {
  assert.deepEqual(
    detectKeywordLine('Kulcsszavak: kézirat; metaadat; nyílt tudomány'),
    ['kézirat', 'metaadat', 'nyílt tudomány'],
  );
  assert.deepEqual(
    detectKeywordLine('Schlüsselwörter — Edition, Manuskript'),
    ['Edition', 'Manuskript'],
  );
});

test('maps common Word bibliography source types to portable resource types', () => {
  assert.equal(mapWordSourceType('JournalArticle'), 'journal-article');
  assert.equal(mapWordSourceType('BookSection'), 'book-chapter');
  assert.equal(mapWordSourceType('ElectronicSource'), 'web-page');
  assert.equal(mapWordSourceType('UnknownLegacyType'), 'manuscript');
});

test('normalizes cached Word TOC page numbers without changing the entry title', () => {
  assert.equal(
    normalizeWordTocDisplayText('1. Bevezetés\t12'),
    '1. bevezetés',
  );
  assert.equal(
    normalizeWordTocDisplayText('Második fejezet ........ 27'),
    'második fejezet',
  );
});

test('preserves Word TOC tab stops while extracting cached display rows', () => {
  const xml = `
    <w:document xmlns:w="urn:test">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>1. Bevezetés</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>12</w:t></w:r></w:p>
        <w:p><w:pPr><w:pStyle w:val="TOC2"/></w:pPr><w:r><w:t>1.1. Előzmények</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>13</w:t></w:r></w:p>
        <w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>Valódi bekezdés 42</w:t></w:r></w:p>
      </w:body>
    </w:document>`;

  assert.deepEqual(
    [...extractRenderedWordTocLines(xml)],
    ['1. bevezetés', '1.1. előzmények'],
  );
});

test('switches manuscript-sized DOCX packages to the large-document path', () => {
  assert.equal(isLargeDocx({ size: LARGE_DOCX_THRESHOLD_BYTES - 1 }), false);
  assert.equal(isLargeDocx({ size: LARGE_DOCX_THRESHOLD_BYTES }), true);
  assert.equal(isLargeDocx({ size: LARGE_DOCX_THRESHOLD_BYTES * 4 }), true);
});

test('routes book-sized or highly expanded Word XML to monograph mode', () => {
  assert.equal(
    isMonographComplexity({
      fileSize: MONOGRAPH_DOCX_THRESHOLD_BYTES,
      documentXmlBytes: 1,
    }),
    true,
  );
  assert.equal(
    isMonographComplexity({
      fileSize: 512 * 1024,
      documentXmlBytes: MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES,
    }),
    true,
  );
  assert.equal(
    isMonographComplexity({
      fileSize: MONOGRAPH_DOCX_THRESHOLD_BYTES - 1,
      documentXmlBytes: MONOGRAPH_DOCUMENT_XML_THRESHOLD_BYTES - 1,
    }),
    false,
  );
});

test('keeps a separate whole-DOCX safety ceiling for large packages', () => {
  assert.equal(MAX_DOCX_PACKAGE_BYTES, 200 * 1024 * 1024);
  assert.ok(MAX_DOCX_PACKAGE_BYTES > LARGE_DOCX_THRESHOLD_BYTES);
  assert.ok(MAX_DOCX_PACKAGE_BYTES > MONOGRAPH_DOCX_THRESHOLD_BYTES);
});
