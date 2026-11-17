import assert from 'node:assert/strict';
import test from 'node:test';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';
import { extractManuscriptState } from '../src/model/versioning.ts';
import {
  importOjsMetadata,
  exportOjsMetadata,
  localMetadataValue,
  remoteMetadataValue,
  localizedValue,
} from '../src/model/ojsMetadataReconciliation.ts';
import type { OjsMetadataSnapshot } from '../src/services/ojsMetadataTypes.ts';

export function snapshot(): OjsMetadataSnapshot {
  return {
    protocol: 'omi-ojs-metadata/1',
    authority: 'OJS',
    stateToken: 'a'.repeat(64),
    workflowToken: 'b'.repeat(64),
    submissionId: 12,
    publicationId: 13,
    stage: 'production',
    publicationStatus: 1,
    locales: ['hu', 'en', 'en_US'],
    writableFields: ['title', 'subtitle', 'abstract', 'keywords'],
    abstractRepresentation: 'plain-text',
    metadata: {
      title: { hu: 'OJS cím', en: 'OJS title' },
      subtitle: { hu: 'Alcím' },
      abstract: {
        hu: 'OJS absztrakt',
        en: 'OJS abstract',
        en_US: 'Regional abstract',
      },
      keywords: { hu: ['OJS kulcs'], en: ['OJS term'] },
      doi: '10.1234/test',
      references: 'Native bibliography',
      pages: '12–19',
      issueId: 1,
      datePublished: null,
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      copyrightHolder: { hu: 'Kiadó' },
      copyrightYear: 2026,
    },
    contributors: [
      {
        externalId: '7',
        name: { given: 'Author', family: 'Name' },
        identifiers: [
          { scheme: 'orcid', value: 'https://orcid.org/0000-0000-0000-0000' },
        ],
      },
    ],
  };
}
function manuscript() {
  return {
    ...extractManuscriptState(createHtmlGalleyStudy()),
    locale: 'hu',
    title: 'OMI cím',
    subtitle: 'OMI alcím',
    abstract: 'OMI absztrakt',
    keywords: ['OMI kulcs'],
  };
}
test('selective pull preserves manuscript content, identities and unselected fields', () => {
  const state = manuscript();
  const before = JSON.stringify(state);
  const next = importOjsMetadata(state, snapshot(), 'hu', [
    'title',
    'keywords',
  ]);
  assert.equal(next.title, 'OJS cím');
  assert.deepEqual(next.keywords, ['OJS kulcs']);
  assert.equal(next.abstract, state.abstract);
  assert.strictEqual(next.sections, state.sections);
  assert.strictEqual(next.agents, state.agents);
  assert.strictEqual(next.contributions, state.contributions);
  assert.equal(JSON.stringify(state), before);
});
test('secondary language abstract and keywords preserve primary compatibility values and existing translations', () => {
  const state = {
    ...manuscript(),
    abstracts: { de: 'Deutsch' },
    keywordsByLocale: { de: ['Deutsch'] },
  };
  const next = importOjsMetadata(state, snapshot(), 'en', [
    'abstract',
    'keywords',
  ]);
  assert.equal(next.abstract, state.abstract);
  assert.deepEqual(next.keywords, state.keywords);
  assert.deepEqual(next.abstracts, {
    hu: state.abstract,
    de: 'Deutsch',
    en: 'OJS abstract',
  });
  assert.deepEqual(next.keywordsByLocale, {
    hu: state.keywords,
    de: ['Deutsch'],
    en: ['OJS term'],
  });
  assert.throws(
    () => importOjsMetadata(state, snapshot(), 'en', ['title']),
    /language/,
  );
});
test('locale aliases are matched explicitly and conflicting aliases are rejected', () => {
  const state = { ...manuscript(), abstracts: { 'en-US': 'Old regional' } };
  const next = importOjsMetadata(state, snapshot(), 'en_US', ['abstract']);
  assert.equal(next.abstracts?.['en-US'], 'Regional abstract');
  assert.equal(Object.hasOwn(next.abstracts!, 'en_US'), false);
  assert.equal(
    localizedValue({ 'en-US': 'Same', en_US: 'Same' }, 'en-US'),
    'Same',
  );
  assert.throws(
    () => localizedValue({ en_US: 'A', 'en-US': 'B' }, 'en_US'),
    /Conflicting/,
  );
});
test('missing values never borrow a different language or silently clear a field', () => {
  assert.equal(remoteMetadataValue(snapshot(), 'en', 'subtitle'), undefined);
  assert.throws(
    () =>
      importOjsMetadata(manuscript(), snapshot(), 'en', ['copyrightHolder']),
    /no value/,
  );
  assert.throws(
    () => importOjsMetadata(manuscript(), snapshot(), 'de', ['abstract']),
    /locale/,
  );
});
test('push exports only approved manuscript fields in the selected native locale', () => {
  const state = manuscript();
  assert.deepEqual(
    exportOjsMetadata(state, snapshot(), 'hu', [
      'title',
      'abstract',
      'keywords',
    ]),
    { title: state.title, abstract: state.abstract, keywords: state.keywords },
  );
  const readonly = { ...snapshot(), writableFields: [] };
  assert.throws(
    () => exportOjsMetadata(state, readonly, 'hu', ['title']),
    /permit/,
  );
  assert.throws(
    () => exportOjsMetadata(state, snapshot(), 'en', ['title']),
    /permit/,
  );
  assert.equal(localMetadataValue(state, 'en', 'title'), undefined);
});
test('publisher fields can be imported explicitly without becoming writable OJS proposals', () => {
  const state = manuscript();
  const next = importOjsMetadata(state, snapshot(), 'hu', [
    'licenseUrl',
    'copyrightHolder',
    'copyrightYear',
  ]);
  assert.equal(next.metadata?.copyrightYear, 2026);
  assert.equal(next.metadata?.copyrightHolder?.hu, 'Kiadó');
  assert.equal(state.metadata?.copyrightYear, undefined);
  assert.throws(() =>
    importOjsMetadata(state, snapshot(), 'hu', ['doi' as never]),
  );
  assert.throws(() =>
    exportOjsMetadata(state, snapshot(), 'hu', ['copyrightYear' as never]),
  );
});
