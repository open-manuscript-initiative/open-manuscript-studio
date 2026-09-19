import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectReferenceInterchangeFormat,
  parseReferenceInterchange,
} from '../src/services/referenceInterchange.ts';

test('imports RIS records into the OMI bibliographic model', () => {
  const result = parseReferenceInterchange(
    [
      'TY  - JOUR',
      'ID  - zotero-export-1',
      'AU  - Scholar, Ada',
      'AU  - Example, Béla',
      'TI  - Structured references',
      'JO  - Journal of Examples',
      'PY  - 2026/09/19',
      'VL  - 12',
      'IS  - 3',
      'SP  - 10',
      'EP  - 24',
      'DO  - https://doi.org/10.1000/example',
      'SN  - 1234-5678',
      'UR  - https://example.org/article',
      'ER  -',
    ].join('\n'),
    'ris',
  );

  assert.equal(result.records.length, 1);
  const record = result.records[0]!;
  assert.equal(record.type, 'journal-article');
  assert.equal(record.title, 'Structured references');
  assert.equal(record.containerTitle, 'Journal of Examples');
  assert.equal(record.issued, '2026');
  assert.equal(record.pages, '10-24');
  assert.equal(record.contributors[0]?.givenName, 'Ada');
  assert.equal(record.contributors[0]?.familyName, 'Scholar');
  assert.equal(
    record.identifiers.find((item) => item.scheme === 'doi')?.value,
    '10.1000/example',
  );
  assert.equal(
    record.identifiers.find((item) => item.scheme === 'issn')?.value,
    '1234-5678',
  );
});

test('imports BibTeX while preserving source keys and structured names', () => {
  const result = parseReferenceInterchange(
    `@article{example2026,
      author = {Scholar, Ada and Example, Béla},
      title = {Reference {Manager} Integration},
      journal = {Journal of Examples},
      year = {2026},
      volume = {7},
      number = {2},
      pages = {101--119},
      doi = {10.1000/bib-example},
      url = {https://example.org/bib}
    }`,
    'bibtex',
  );

  assert.equal(result.records.length, 1);
  const record = result.records[0]!;
  assert.equal(record.title, 'Reference Manager Integration');
  assert.equal(record.contributors[1]?.familyName, 'Example');
  assert.equal(
    record.identifiers.find((item) => item.scheme === 'bibtex')?.value,
    'example2026',
  );
  assert.equal(
    record.identifiers.find((item) => item.scheme === 'doi')?.value,
    '10.1000/bib-example',
  );
});

test('imports CSL JSON creators dates and identifiers', () => {
  const result = parseReferenceInterchange(
    JSON.stringify([
      {
        id: 'csl-1',
        type: 'chapter',
        title: 'A chapter',
        author: [{ given: 'Ada', family: 'Scholar' }],
        editor: [{ literal: 'Example Editorial Board' }],
        'container-title': 'Collected Examples',
        issued: { 'date-parts': [[2026, 9, 19]] },
        publisher: 'Example Press',
        'publisher-place': 'Budapest',
        DOI: 'https://doi.org/10.1000/csl-example',
        ISBN: ['978-1-2345-6789-0'],
        URL: 'https://example.org/chapter',
      },
    ]),
    'csl-json',
  );

  assert.equal(result.records.length, 1);
  const record = result.records[0]!;
  assert.equal(record.type, 'book-chapter');
  assert.equal(record.issued, '2026-09-19');
  assert.equal(record.contributors[0]?.givenName, 'Ada');
  assert.equal(record.contributors[1]?.literalName, 'Example Editorial Board');
  assert.equal(
    record.identifiers.find((item) => item.scheme === 'csl')?.value,
    'csl-1',
  );
  assert.equal(
    record.identifiers.find((item) => item.scheme === 'isbn')?.value,
    '978-1-2345-6789-0',
  );
});

test('detects supported reference interchange files by extension or content', () => {
  assert.equal(detectReferenceInterchangeFormat('', 'library.ris'), 'ris');
  assert.equal(detectReferenceInterchangeFormat('', 'library.bib'), 'bibtex');
  assert.equal(detectReferenceInterchangeFormat('[]', 'library.json'), 'csl-json');
  assert.equal(
    detectReferenceInterchangeFormat('TY  - BOOK\nER  -'),
    'ris',
  );
  assert.equal(
    detectReferenceInterchangeFormat('@book{x, title={X}}'),
    'bibtex',
  );
});

test('reports untitled interchange records instead of creating invalid references', () => {
  const result = parseReferenceInterchange(
    'TY  - JOUR\nAU  - Scholar, Ada\nER  -',
    'ris',
  );
  assert.equal(result.records.length, 0);
  assert.equal(result.issues.length, 1);
});
