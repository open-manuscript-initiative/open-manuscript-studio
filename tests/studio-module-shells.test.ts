import assert from 'node:assert/strict';
import test from 'node:test';

import { getDisciplineWorkspaceStorageKey } from '../src/modules/disciplineWorkspace.ts';

import {
  builtinModuleManifests,
  historyArchivesModule,
  studioModules,
  defaultModuleInstallationPolicy,
} from '../src/modules/catalog.ts';
import {
  getModulePreferencesStorageKey,
  readStudioModulePreferences,
  writeStudioModulePreferences,
  type ModulePreferenceStorage,
} from '../src/modules/preferences.ts';
import { getModuleShellCopy } from '../src/modules/moduleShellTranslations.ts';
import { resolveStudioModuleActivationState } from '../src/modules/types.ts';
import { searchEuropeana } from '../server/src/integrations/europeana/europeanaSearch.ts';
import { searchNaraCatalog } from '../server/src/integrations/nara/naraCatalogSearch.ts';
import { searchSefaria } from '../server/src/integrations/sefaria/sefariaSearch.ts';
import { createExperimentalWorkspace, isExperimentalWorkspace, parseExperimentalWorkspace } from '../src/modules/experimental-laboratory/model.ts';

const expectedModuleIds = [
  'org.omi.history-archives',
  'org.omi.religious-texts',
  'org.omi.critical-text-edition',
  'org.omi.corpus-linguistics',
  'org.omi.musicology',
  'org.omi.cultural-heritage',
  'org.omi.social-research-methods',
  'org.omi.legal-sources',
  'org.omi.research-reproducibility',
  'org.omi.spatial-research',
  'org.omi.archaeology',
  'org.omi.experimental-laboratory',
];

function createStorage(): ModulePreferenceStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('registers all built-in discipline modules with navigation contributions', () => {
  assert.deepEqual(
    studioModules.list().map(({ id }) => id),
    [...expectedModuleIds].sort(),
  );
  assert.deepEqual(
    defaultModuleInstallationPolicy.enabledModuleIds,
    expectedModuleIds,
  );
  assert.equal(builtinModuleManifests.length, expectedModuleIds.length);
  assert.ok(builtinModuleManifests.every(
    (module) => module.contributions.some(({ slot }) => slot === 'research-navigation'),
  ));
  assert.deepEqual(historyArchivesModule.requiredCapabilities, ['archives.search']);
  assert.deepEqual(
    builtinModuleManifests.find((module) => module.id === 'org.omi.religious-texts')?.requiredCapabilities,
    ['religious-texts.search'],
  );
});

test('provides a translated title and description for every registered module', () => {
  for (const locale of ['en', 'de', 'hu']) {
    const copy = getModuleShellCopy(locale);
    for (const moduleId of expectedModuleIds) {
      assert.ok(copy.modules[moduleId]?.title, `Missing ${locale} title for ${moduleId}`);
      assert.ok(copy.modules[moduleId]?.description, `Missing ${locale} description for ${moduleId}`);
      assert.ok(copy.modules[moduleId]?.overview, `Missing ${locale} overview for ${moduleId}`);
    }
    assert.ok(copy.europeana.searchLabel, `Missing ${locale} Europeana search label`);
    assert.ok(copy.europeana.setupRequired, `Missing ${locale} Europeana setup message`);
    assert.ok(copy.europeana.loadMore, `Missing ${locale} Europeana pagination label`);
    assert.ok(copy.nara.searchLabel, `Missing ${locale} NARA search label`);
    assert.ok(copy.nara.setupRequired, `Missing ${locale} NARA setup message`);
    assert.ok(copy.nara.loadMore, `Missing ${locale} NARA pagination label`);
    assert.ok(copy.nara.attribution?.includes('not endorsed or certified'), `Missing ${locale} NARA attribution`);
  }
});

test('stores active module selections separately by user and workspace', () => {
  const storage = createStorage();
  writeStudioModulePreferences('user-a', {
    workspaceId: 'workspace-a',
    activeModuleIds: [historyArchivesModule.id, historyArchivesModule.id],
  }, storage);

  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [historyArchivesModule.id] },
  );
  assert.deepEqual(
    readStudioModulePreferences('user-b', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [] },
  );
  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-b', storage),
    { workspaceId: 'workspace-b', activeModuleIds: [] },
  );
  assert.notEqual(
    getModulePreferencesStorageKey('user-a', 'workspace-a'),
    getModulePreferencesStorageKey('user-b', 'workspace-a'),
  );
});

test('ignores malformed stored module preference data', () => {
  const storage = createStorage();
  const key = getModulePreferencesStorageKey('user-a', 'workspace-a');
  storage.values.set(key, '{ broken json');

  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [] },
  );

  storage.values.set(key, JSON.stringify({ version: 2, activeModuleIds: ['future'] }));
  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [] },
  );
});

test('uses isolated local storage keys for each research module workspace', () => {
  const keys = expectedModuleIds.map((moduleId) =>
    getDisciplineWorkspaceStorageKey('user-a', 'workspace-a', moduleId),
  );

  assert.equal(new Set(keys).size, expectedModuleIds.length);
  assert.notEqual(
    getDisciplineWorkspaceStorageKey('user-a', 'workspace-a', expectedModuleIds[0]!),
    getDisciplineWorkspaceStorageKey('user-b', 'workspace-a', expectedModuleIds[0]!),
  );
  assert.notEqual(
    getDisciplineWorkspaceStorageKey('user-a', 'workspace-a', expectedModuleIds[0]!),
    getDisciplineWorkspaceStorageKey('user-a', 'workspace-b', expectedModuleIds[0]!),
  );
});

test('workspace activation state remains bounded by the enabled module policy', () => {
  assert.equal(
    resolveStudioModuleActivationState(
      historyArchivesModule.id,
      defaultModuleInstallationPolicy,
      { workspaceId: 'default', activeModuleIds: [] },
    ),
    'available',
  );
  assert.equal(
    resolveStudioModuleActivationState(
      historyArchivesModule.id,
      { revision: 2, enabledModuleIds: [] },
      { workspaceId: 'default', activeModuleIds: [historyArchivesModule.id] },
    ),
    'disabled-by-installation',
  );
  assert.equal(
    resolveStudioModuleActivationState(
      historyArchivesModule.id,
      defaultModuleInstallationPolicy,
      { workspaceId: 'default', activeModuleIds: [historyArchivesModule.id] },
    ),
    'active',
  );
});



test('Europeana adapter uses the secret header and normalizes archival discovery metadata', async () => {
  let requestedUrl: URL | undefined;
  let requestedHeaders: Headers | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = new URL(input instanceof Request ? input.url : String(input));
    requestedHeaders = new Headers(init?.headers);
    return Response.json({
      success: true,
      totalResults: 19,
      nextCursor: 'cursor-next',
      apikey: 'must-not-be-forwarded',
      items: [{
        id: '/2020601/item-123',
        title: { en: ['Letters from 1848'] },
        dcCreator: ['Archive author'],
        year: ['1848'],
        dataProvider: ['City Archives'],
        edmPreview: ['https://images.example.org/thumb.jpg'],
        edmIsShownAt: ['https://archives.example.org/item/123'],
        edmRights: ['http://rightsstatements.org/vocab/InC/1.0/'],
      }],
    });
  };

  const result = await searchEuropeana({
    query: 'letters 1848',
    cursor: 'cursor-current',
    apiKey: 'private-project-key',
    fetchImpl,
  });

  assert.equal(requestedUrl?.origin, 'https://api.europeana.eu');
  assert.equal(requestedUrl?.searchParams.get('query'), 'letters 1848');
  assert.equal(requestedUrl?.searchParams.get('cursor'), 'cursor-current');
  assert.equal(requestedUrl?.searchParams.get('rows'), '12');
  assert.equal(requestedHeaders?.get('X-Api-Key'), 'private-project-key');
  assert.equal(requestedUrl?.searchParams.has('wskey'), false);
  assert.deepEqual(result, {
    totalResults: 19,
    nextCursor: 'cursor-next',
    items: [{
      id: '/2020601/item-123',
      title: 'Letters from 1848',
      description: null,
      creator: 'Archive author',
      date: '1848',
      provider: 'City Archives',
      thumbnailUrl: 'https://images.example.org/thumb.jpg',
      rights: 'http://rightsstatements.org/vocab/InC/1.0/',
      recordUrl: 'https://www.europeana.eu/item/2020601/item-123',
      sourceUrl: 'https://archives.example.org/item/123',
    }],
  });
  assert.equal(JSON.stringify(result).includes('private-project-key'), false);
});

test('Europeana adapter rejects unsafe result links and malformed records', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    success: true,
    totalResults: 2,
    items: [
      { id: '/dataset/valid', title: 'Record', guid: 'javascript:alert(1)', edmPreview: ['http://unsafe.example/image'], edmIsShownAt: ['javascript:alert(1)'] },
      { id: '//evil.example/item', title: 'Invalid identifier' },
    ],
  });

  const result = await searchEuropeana({ query: 'record', apiKey: 'test-key', fetchImpl });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.recordUrl, 'https://www.europeana.eu/item/dataset/valid');
  assert.equal(result.items[0]?.thumbnailUrl, null);
  assert.equal(result.items[0]?.sourceUrl, null);
});


test('NARA adapter keeps the key in a header and normalizes a catalog search result', async () => {
  let requestedUrl: URL | undefined;
  let requestedHeaders: Headers | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = new URL(input instanceof Request ? input.url : String(input));
    requestedHeaders = new Headers(init?.headers);
    return Response.json({
      body: {
        hits: {
          total: { value: 13, relation: 'eq' },
          hits: [{
            _id: '123456',
            _source: {
              record: {
                naId: 123456,
                title: 'Letters from 1848',
                scopeAndContentNote: [{ note: 'Correspondence and related records.' }],
                creators: [{ creatorName: 'City Archives' }],
                inclusiveDates: [{ inclusiveStartDate: 1848, inclusiveEndDate: 1849 }],
                recordGroupName: 'Record Group 21',
                digitalObjects: [{ thumbnailUrl: 'https://catalog.archives.gov/id/123456/thumbnails/1' }],
                useRestriction: { status: 'Unrestricted' },
              },
            },
          }],
        },
      },
    });
  };

  const result = await searchNaraCatalog({
    query: 'letters 1848',
    apiKey: 'private-nara-key',
    fetchImpl,
  });

  assert.equal(requestedUrl?.origin, 'https://catalog.archives.gov');
  assert.equal(requestedUrl?.pathname, '/api/v2/records/search');
  assert.equal(requestedUrl?.searchParams.get('q'), 'letters 1848');
  assert.equal(requestedUrl?.searchParams.get('limit'), '12');
  assert.equal(requestedUrl?.searchParams.has('searchAfter'), false);
  assert.equal(requestedUrl?.searchParams.has('apiKey'), false);
  assert.equal(requestedHeaders?.get('x-api-key'), 'private-nara-key');
  assert.deepEqual(result, {
    totalResults: 13,
    nextCursor: null,
    items: [{
      id: '123456',
      title: 'Letters from 1848',
      description: 'Correspondence and related records.',
      creator: 'City Archives',
      date: '1848',
      provider: 'Record Group 21',
      thumbnailUrl: 'https://catalog.archives.gov/id/123456/thumbnails/1',
      rights: 'Unrestricted',
      recordUrl: 'https://catalog.archives.gov/id/123456',
      sourceUrl: null,
    }],
  });
  assert.equal(JSON.stringify(result).includes('private-nara-key'), false);
});

test('NARA adapter drops malformed records and unsafe thumbnail URLs', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    body: {
      hits: {
        total: { value: 2 },
        hits: [
          { _id: '123', _source: { record: { naId: '123', title: 'Valid', digitalObjects: [{ thumbnailUrl: 'javascript:alert(1)' }] } } },
          { _id: '../bad', _source: { record: { naId: '../bad', title: 'Invalid identifier' } } },
        ],
      },
    },
  });

  const result = await searchNaraCatalog({ query: 'record', apiKey: 'test-key', fetchImpl });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.recordUrl, 'https://catalog.archives.gov/id/123');
  assert.equal(result.items[0]?.thumbnailUrl, null);
});


test('NARA adapter follows the searchAfter cursor returned by the catalog API', async () => {
  let requestedUrl: URL | undefined;
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = new URL(input instanceof Request ? input.url : String(input));
    return Response.json({
      body: {
        hits: {
          total: { value: 24 },
          hits: Array.from({ length: 12 }, (_, index) => ({
            sort: [`sort-after-${index + 1}`],
            _source: {
              record: {
                naId: index + 1,
                title: `Record ${index + 1}`,
              },
            },
          })),
        },
      },
    });
  };

  const result = await searchNaraCatalog({
    query: 'catalogue',
    cursor: 'sort-before-page',
    apiKey: 'test-key',
    fetchImpl,
  });

  assert.equal(requestedUrl?.searchParams.get('searchAfter'), 'sort-before-page');
  assert.equal(requestedUrl?.searchParams.get('limit'), '12');
  assert.equal(requestedUrl?.searchParams.has('page'), false);
  assert.equal(result.items.length, 12);
  assert.equal(result.nextCursor, 'sort-after-12');
});


test('Sefaria adapter sends a bounded live text search and preserves citation metadata', async () => {
  let requestedUrl: URL | undefined;
  let requestedBody: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = new URL(input instanceof Request ? input.url : String(input));
    requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      hits: {
        total: { value: 1, relation: 'eq' },
        hits: [{
          _id: 'Genesis 1:1',
          _source: {
            ref: 'Genesis 1:1',
            heRef: 'בראשית א׳:א׳',
            title: 'Genesis Chapter 1 Verse 1',
            exact: 'In the beginning God created the heavens and the earth.',
            lang: 'en',
            version: 'Jewish English Torah',
            categories: ['Tanakh', 'Torah'],
          },
        }],
      },
    });
  };

  const result = await searchSefaria({ query: 'beginning', cursor: '12', fetchImpl });

  assert.equal(requestedUrl?.origin, 'https://www.sefaria.org');
  assert.equal(requestedUrl?.pathname, '/api/search/text/_search');
  assert.equal(requestedBody?.from, 12);
  assert.equal(requestedBody?.size, 12);
  assert.deepEqual(result, {
    totalResults: 1,
    nextCursor: null,
    items: [{
      id: 'Genesis 1:1:Jewish English Torah:en',
      reference: 'Genesis 1:1',
      title: 'Genesis Chapter 1 Verse 1',
      excerpt: 'In the beginning God created the heavens and the earth.',
      language: 'en',
      edition: 'Jewish English Torah',
      categories: ['Tanakh', 'Torah'],
      sourceUrl: 'https://www.sefaria.org/Genesis%201%3A1',
    }],
  });
});

test('Sefaria adapter rejects unsafe pagination cursors and keeps result links on the provider domain', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return Response.json({
      hits: {
        total: 3,
        hits: [
          { _source: { ref: 'Psalms 23:1', exact: 'The Lord is my shepherd.' } },
          { _source: { ref: 'javascript:alert(1)', exact: 'unsafe ref' } },
        ],
      },
    });
  };

  await assert.rejects(
    searchSefaria({ query: 'shepherd', cursor: '-1', fetchImpl }),
    /cursor is invalid/,
  );
  assert.equal(calls, 0);

  const result = await searchSefaria({ query: 'shepherd', fetchImpl });
  assert.equal(result.items.length, 1);
  assert.ok(result.items.every(({ sourceUrl }) => sourceUrl.startsWith('https://www.sefaria.org/')));
});


test('experimental laboratory projects validate and round-trip their portable module JSON', () => {
  const project = createExperimentalWorkspace();
  project.profile = 'chemistry';
  project.title = 'Example investigation';
  project.studies[0]!.assays.push({
    id: 'assay-1',
    title: 'Absorbance',
    technology: 'UV-visible spectroscopy',
    method: 'Measure at a fixed wavelength.',
    materialReferences: 'sample-1',
    measurements: [{
      id: 'measurement-1',
      name: 'Absorbance',
      value: '0.42',
      unit: 'AU',
      uncertainty: '0.01',
      measuredAt: '2026-10-07T08:00',
      instrumentId: 'instrument-1',
    }],
  });

  assert.equal(isExperimentalWorkspace(project), true);
  assert.deepEqual(parseExperimentalWorkspace(JSON.stringify(project)), project);
});

test('experimental laboratory import rejects malformed records and unsupported schema versions', () => {
  const project = createExperimentalWorkspace();
  assert.equal(parseExperimentalWorkspace('{broken'), null);
  assert.equal(isExperimentalWorkspace({ ...project, schemaVersion: 2 }), false);
  assert.equal(isExperimentalWorkspace({ ...project, studies: [{ ...project.studies[0], assays: [{ measurements: [null] }] }] }), false);
});
