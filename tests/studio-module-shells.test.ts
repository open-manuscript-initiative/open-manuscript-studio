import assert from 'node:assert/strict';
import test from 'node:test';

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

test('registers all planned discipline shells with empty navigation contributions', () => {
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
  assert.ok(builtinModuleManifests.every(
    (module) => module.requiredCapabilities.length === 0,
  ));
});

test('provides a translated title and description for every registered module shell', () => {
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
