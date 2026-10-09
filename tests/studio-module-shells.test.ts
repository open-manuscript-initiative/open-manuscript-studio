import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getDisciplineWorkspaceStorageKey } from '../src/modules/disciplineWorkspace.ts';
import { readResearchExcerpts } from '../src/modules/researchModuleProjection.ts';

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
import { buildRomanianArchivesSearchUrl } from '../src/modules/history-archives/romanianArchives.ts';
import { searchSefaria } from '../server/src/integrations/sefaria/sefariaSearch.ts';
import { createExperimentalWorkspace, isExperimentalWorkspace, parseExperimentalWorkspace } from '../src/modules/experimental-laboratory/model.ts';
import { addDesignDeviation, createStatisticalWorkspace, describe, estimateTwoGroupSampleSize, isStatisticalWorkspace, linearRegression, oneWayAnova, parseDelimited, parseLaboratoryMeasurements, parseStatisticalWorkspace, preregisterDesign, randomizeParticipants, welchTTest } from '../src/modules/statistical-analysis/model.ts';

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
  'org.omi.statistical-analysis',
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



test('Romanian Archives search URL targets the official text catalogue and encodes the query', () => {
  const url = new URL(buildRomanianArchivesSearchUrl('  Béthlen + Oradea  '));

  assert.equal(url.origin, 'https://descopera.arhivelenationale.ro');
  assert.equal(url.pathname, '/cautare-text/');
  assert.equal(url.searchParams.get('ts'), 'Béthlen + Oradea');
  assert.equal(url.searchParams.get('pg'), '1');
  assert.equal(url.searchParams.get('pgs'), '10');
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


test('statistical analysis parses CSV/TSV and rejects malformed rows', () => {
  assert.deepEqual(parseDelimited('group,value\nA,1\nB,2'), {
    columns: ['group', 'value'],
    rows: [['A', '1'], ['B', '2']],
  });
  assert.deepEqual(parseDelimited('name\tvalue\n"Sample\tA"\t2'), {
    columns: ['name', 'value'],
    rows: [['Sample\tA', '2']],
  });
  assert.equal(parseDelimited('a,b\n1'), null);
  assert.equal(parseDelimited('a,b\n"unclosed,2'), null);
});

test('descriptive statistics include sample spread, quartiles, and a t confidence interval', () => {
  const result = describe([1, 2, 3, 4]);
  assert.ok(result);
  assert.equal(result.n, 4);
  assert.equal(result.mean, 2.5);
  assert.equal(result.median, 2.5);
  assert.equal(result.minimum, 1);
  assert.equal(result.maximum, 4);
  assert.equal(result.standardDeviation, Math.sqrt(5 / 3));
  assert.ok(result.confidenceLow < result.mean && result.confidenceHigh > result.mean);
});

test('Welch t test and one-way ANOVA return bounded two-sided p values', () => {
  const comparison = welchTTest([1, 2, 3], [4, 5, 6]);
  assert.ok(comparison);
  assert.ok(comparison.pValue > 0 && comparison.pValue < 0.05);
  assert.ok(comparison.confidenceHigh < 0);

  const analysis = oneWayAnova([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  assert.ok(analysis);
  assert.equal(analysis.fStatistic, 27);
  assert.ok(analysis.pValue > 0 && analysis.pValue < 0.01);
});

test('linear regression fits exact linear data', () => {
  assert.deepEqual(linearRegression([1, 2, 3], [3, 5, 7]), {
    n: 3, intercept: 1, slope: 2, correlation: 1, rSquared: 1,
  });
});


test('statistical analysis JSON validates and round-trips datasets and analysis settings', () => {
  const workspace = createStatisticalWorkspace();
  workspace.analysisTitle = 'Treatment comparison';
  workspace.configuration.valueColumn = '2';
  workspace.configuration.groupColumn = '0';
  workspace.dataset = {
    id: 'dataset-1',
    title: 'Measurements',
    sourceStudy: 'Study A',
    importedAt: '2026-10-07T08:00:00.000Z',
    columns: ['group', 'replicate', 'value'],
    rows: [['control', '1', '4.2'], ['treated', '1', '5.1']],
  };
  assert.equal(isStatisticalWorkspace(workspace), true);
  assert.deepEqual(parseStatisticalWorkspace(JSON.stringify(workspace)), workspace);
  assert.equal(parseStatisticalWorkspace('{broken'), null);
  assert.equal(isStatisticalWorkspace({ ...workspace, schemaVersion: 2 }), false);
});


test('statistical analysis imports laboratory measurements as linked tabular data', () => {
  const imported = parseLaboratoryMeasurements(JSON.stringify({
    schemaVersion: 1,
    title: 'Physics investigation',
    studies: [{
      title: 'Cooling experiment',
      instruments: [{ id: 'thermometer-1', name: 'Digital thermometer' }],
      assays: [{
        title: 'Temperature over time',
        technology: 'Thermometry',
        materialReferences: 'water-1',
        measurements: [{
          name: 'Temperature',
          value: '21.5',
          unit: '°C',
          uncertainty: '0.1',
          measuredAt: '2026-10-07T08:00',
          instrumentId: 'thermometer-1',
        }],
      }],
    }],
  }));
  assert.ok(imported);
  assert.equal(imported.projectTitle, 'Physics investigation');
  assert.deepEqual(imported.rows[0], ['Physics investigation', 'Cooling experiment', 'Temperature over time', 'Thermometry', 'water-1', 'Temperature', '21.5', '°C', '0.1', '2026-10-07T08:00', 'Digital thermometer']);
  assert.equal(parseLaboratoryMeasurements(JSON.stringify({ schemaVersion: 1, title: 'Empty', studies: [] })), null);
});


test('experimental design sample size uses a two-sided normal approximation and validates inputs', () => {
  assert.equal(estimateTwoGroupSampleSize(0.05, 0.8, 0.5), 63);
  assert.equal(estimateTwoGroupSampleSize(0.05, 0.8, 0), null);
  assert.equal(estimateTwoGroupSampleSize(1, 0.8, 0.5), null);
});

test('seeded allocation is reproducible, balanced, and plan registration is immutable with deviations logged', () => {
  const first = randomizeParticipants(['P1', 'P2', 'P3', 'P4', 'P5'], ['A', 'B'], 'seed-1');
  assert.deepEqual(randomizeParticipants(['P1', 'P2', 'P3', 'P4', 'P5'], ['A', 'B'], 'seed-1'), first);
  assert.equal(Math.abs(first.filter(item => item.group === 'A').length - first.filter(item => item.group === 'B').length), 1);

  const design = createStatisticalWorkspace().design;
  design.hypothesis = 'Treatment improves outcome';
  const frozen = preregisterDesign(design, '2026-10-07T00:00:00.000Z');
  assert.equal(frozen.preregisteredAt, '2026-10-07T00:00:00.000Z');
  assert.equal(JSON.parse(frozen.preregisteredSnapshot!).hypothesis, 'Treatment improves outcome');
  assert.equal(preregisterDesign(frozen, 'later'), frozen);
  const withDeviation = addDesignDeviation(frozen, 'Used a prespecified sensitivity analysis', '2026-10-08T00:00:00.000Z');
  assert.equal(withDeviation.deviations.length, 1);
  assert.equal(withDeviation.deviations[0]?.description, 'Used a prespecified sensitivity analysis');
});

test('legacy statistical workspace JSON migrates with an empty experimental design', () => {
  const workspace = createStatisticalWorkspace();
  const legacy = { ...workspace } as Partial<typeof workspace>;
  delete legacy.design;
  const migrated = parseStatisticalWorkspace(JSON.stringify(legacy));
  assert.ok(migrated);
  assert.equal(migrated.design.groups.join(','), 'Control,Treatment');
});


test('completed research module workspaces no longer render scaffold labels or descriptions', () => {
  const source = readFileSync(new URL('../src/modules/ModuleManagerPanel.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('copy.scaffoldTitle'), false);
  assert.equal(source.includes('copy.scaffoldDescription'), false);
  for (const locale of ['en', 'de', 'hu']) {
    const copy = getModuleShellCopy(locale);
    assert.equal('scaffoldTitle' in copy, false);
    assert.equal('scaffoldDescription' in copy, false);
    for (const moduleId of expectedModuleIds) assert.ok(copy.modules[moduleId]?.description);
  }
});

test('module insertion cannot silently copy research workspace records into a manuscript', () => {
  const source = readFileSync(new URL('../src/modules/ResearchModuleInsertPanel.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('readModuleWorkspace'), false);
  assert.equal(source.includes('flattenModuleData'), false);
  assert.match(source, /heading\(details\?\.title \?\? module\.titleKey\)/);
  assert.match(source, /paragraph\(details\?\.description \?\? module\.descriptionKey\)/);
});

test('research excerpt projection selects named fields and never flattens confidential metadata', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const userId = 'synthetic-user';
  const moduleId = 'org.omi.corpus-linguistics';
  const key = 'omi:corpus-linguistics:v1:' + getDisciplineWorkspaceStorageKey(userId, 'default', moduleId);
  const storage = new Map<string, string>([[key, JSON.stringify({
    version: 1,
    documents: [{
      id: 'document-1', title: 'Synthetic passage', text: 'Public sample excerpt',
      source: 'Synthetic public source, p. 2',
      participantIdentity: 'PRIVATE SYNTHETIC NAME',
    }],
    confidentialInterviewNotes: 'PRIVATE SYNTHETIC NOTE',
  })]]);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: (name: string) => storage.get(name) ?? null } },
  });
  try {
    assert.deepEqual(readResearchExcerpts(moduleId, userId), [{
      id: 'document-1', moduleId, label: 'Synthetic passage',
      text: 'Public sample excerpt', source: 'Synthetic public source, p. 2',
    }]);
    assert.deepEqual(readResearchExcerpts('org.omi.social-research-methods', userId), []);
    storage.set(key, JSON.stringify({ version: 2, documents: [{ id: 'document-1', text: 'Future schema' }] }));
    assert.deepEqual(readResearchExcerpts(moduleId, userId), []);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('additional module projections include explicit sources and exclude private social research records', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const userId = 'synthetic-user-2';
  const legalId = 'org.omi.legal-sources';
  const socialId = 'org.omi.social-research-methods';
  const key = (id: string) => getDisciplineWorkspaceStorageKey(userId, 'default', id);
  const storage = new Map<string, string>([
    [key(legalId), JSON.stringify({ sources: [{
      id: 'law-1', title: 'Synthetic public law', citation: 'Law 1',
      versions: [{ id: 'version-1', date: '2026', text: 'Public legal text', url: 'https://example.org/law/1' }],
    }] })],
    [key(socialId), JSON.stringify({
      title: 'Synthetic study', method: 'Public methodology',
      ethics: 'PRIVATE SYNTHETIC CONSENT',
      transcripts: [{ id: 'transcript-1', participant: 'PRIVATE SYNTHETIC PERSON', text: 'PRIVATE SYNTHETIC INTERVIEW' }],
    })],
  ]);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: (name: string) => storage.get(name) ?? null } },
  });
  try {
    assert.deepEqual(readResearchExcerpts(legalId, userId), [{
      id: 'version-1', moduleId: legalId, label: 'Synthetic public law · 2026',
      text: 'Public legal text', source: 'https://example.org/law/1',
    }]);
    assert.deepEqual(readResearchExcerpts(socialId, userId), [{
      id: 'research-design', moduleId: socialId, label: 'Synthetic study',
      text: 'Public methodology', source: '',
    }]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
