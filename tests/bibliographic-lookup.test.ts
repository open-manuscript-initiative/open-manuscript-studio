import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCrossrefLookupUrl,
  buildDataCiteLookupUrl,
  buildMtmtLookupUrls,
  buildOpenAlexLookupUrl,
  deduplicateCandidates,
  normalizeLookupDoi,
  parseCrossrefResponse,
  parseDataCiteResponse,
  parseMtmtResponse,
  parseOpenAlexResponse,
} from '../src/services/bibliographicLookup.ts';
import {
  ACADEMIA_WEB_PROVIDER,
  buildWebBibliographicSearchUrl,
  createWebBibliographicProvider,
  normalizeWebBibliographicProvider,
  validateWebBibliographicProviderDraft,
} from '../src/services/webBibliographicProviders.ts';


test('normalizes DOI input from common DOI URL forms', () => {
  assert.equal(
    normalizeLookupDoi('https://doi.org/10.1234/Example.1'),
    '10.1234/example.1',
  );
  assert.equal(normalizeLookupDoi('doi: 10.5555/ABC.42.'), '10.5555/abc.42');
  assert.equal(normalizeLookupDoi('not a doi'), undefined);
});


test('builds provider queries without mixing provider-specific contracts', () => {
  const crossref = new URL(
    buildCrossrefLookupUrl('Open manuscript infrastructure', 'contact@example.org'),
  );
  assert.equal(crossref.hostname, 'api.crossref.org');
  assert.equal(crossref.searchParams.get('query.bibliographic'), 'Open manuscript infrastructure');
  assert.equal(crossref.searchParams.get('mailto'), 'contact@example.org');

  const datacite = new URL(buildDataCiteLookupUrl('10.5281/zenodo.1234567'));
  assert.equal(datacite.hostname, 'api.datacite.org');
  assert.match(datacite.pathname, /10\.5281%2Fzenodo\.1234567$/i);

  const openalex = new URL(buildOpenAlexLookupUrl('structured scholarly publishing', 'test-key'));
  assert.equal(openalex.hostname, 'api.openalex.org');
  assert.equal(openalex.searchParams.get('search'), 'structured scholarly publishing');
  assert.equal(openalex.searchParams.get('api_key'), 'test-key');

  const mtmt = buildMtmtLookupUrls('10.1234/example');
  assert.equal(mtmt.length, 2);
  assert.equal(new URL(mtmt[0]!).hostname, 'm2.mtmt.hu');
  assert.match(new URL(mtmt[0]!).searchParams.get('cond') ?? '', /identifiers\.identifier;eq;/);
});


test('maps Crossref metadata to a portable OMI bibliographic record', () => {
  const [candidate] = parseCrossrefResponse({
    message: {
      items: [
        {
          DOI: '10.1000/test',
          type: 'journal-article',
          title: ['Example Article'],
          author: [{ given: 'Ada', family: 'Example' }],
          'container-title': ['Journal of Examples'],
          issued: { 'date-parts': [[2026, 5, 1]] },
          volume: '12',
          issue: '2',
          page: '10-20',
          URL: 'https://doi.org/10.1000/test',
        },
      ],
    },
  });

  assert.ok(candidate);
  assert.equal(candidate.record.title, 'Example Article');
  assert.equal(candidate.record.issued, '2026');
  assert.equal(candidate.record.contributors[0]?.familyName, 'Example');
  assert.equal(candidate.record.identifiers[0]?.scheme, 'doi');
});


test('maps DataCite and OpenAlex responses into the same record model', () => {
  const [datacite] = parseDataCiteResponse({
    data: [
      {
        id: '10.5281/zenodo.123',
        attributes: {
          doi: '10.5281/zenodo.123',
          titles: [{ title: 'Dataset Example' }],
          creators: [{ givenName: 'Bela', familyName: 'Minta', name: 'Minta, Bela' }],
          publicationYear: 2025,
          types: { resourceTypeGeneral: 'Dataset' },
          publisher: 'Zenodo',
          url: 'https://zenodo.org/records/123',
        },
      },
    ],
  });

  const [openalex] = parseOpenAlexResponse({
    results: [
      {
        id: 'https://openalex.org/W123',
        doi: 'https://doi.org/10.1000/openalex',
        title: 'OpenAlex Example',
        type: 'article',
        publication_year: 2024,
        authorships: [{ author: { display_name: 'Example Author' } }],
        primary_location: {
          landing_page_url: 'https://doi.org/10.1000/openalex',
          source: { display_name: 'Example Journal' },
        },
        biblio: { volume: '4', issue: '1', first_page: '1', last_page: '9' },
      },
    ],
  });

  assert.equal(datacite?.record.type, 'dataset');
  assert.equal(datacite?.record.issued, '2025');
  assert.equal(openalex?.record.type, 'journal-article');
  assert.equal(openalex?.record.containerTitle, 'Example Journal');
  assert.equal(openalex?.record.pages, '1-9');
});


test('maps MTMT public API data and preserves the MTMT identifier', () => {
  const [candidate] = parseMtmtResponse({
    content: [
      {
        mtid: 12345678,
        title: 'MTMT Example Publication',
        publishedYear: 2026,
        type: { label: 'Journal Article' },
        authorships: [
          { author: { givenName: 'Judit', familyName: 'Példa', label: 'Példa Judit' } },
        ],
        journal: { label: 'Example Journal' },
        identifiers: [
          { source: { label: 'DOI' }, identifier: '10.1000/mtmt-example' },
        ],
      },
    ],
  });

  assert.ok(candidate);
  assert.equal(candidate.record.title, 'MTMT Example Publication');
  assert.equal(candidate.record.identifiers.some((id) => id.scheme === 'mtmt' && id.value === '12345678'), true);
  assert.equal(candidate.record.identifiers.some((id) => id.scheme === 'doi' && id.value === '10.1000/mtmt-example'), true);
});


test('deduplicates the same DOI returned by multiple providers', () => {
  const crossref = parseCrossrefResponse({
    message: {
      items: [{ DOI: '10.1000/same', title: ['Same Work'], type: 'journal-article' }],
    },
  });
  const datacite = parseDataCiteResponse({
    data: [{
      id: '10.1000/same',
      attributes: {
        doi: '10.1000/same',
        titles: [{ title: 'Same Work' }],
        creators: [],
        publicationYear: 2026,
        types: { resourceTypeGeneral: 'JournalArticle' },
      },
    }],
  });

  const merged = deduplicateCandidates([...crossref, ...datacite]);
  assert.equal(merged.length, 1);
  assert.deepEqual(new Set(merged[0]?.providers), new Set(['crossref', 'datacite']));
});


test('validates signed-in web providers without accepting credentials or insecure URLs', () => {
  assert.equal(
    validateWebBibliographicProviderDraft({
      name: 'Example Library',
      loginUrl: 'https://example.org/login',
      searchUrlTemplate: 'https://example.org/search?q={query}',
      logoutUrl: 'https://example.org/logout',
    }),
    undefined,
  );

  assert.equal(
    validateWebBibliographicProviderDraft({
      name: 'Example Library',
      loginUrl: 'http://example.org/login',
      searchUrlTemplate: 'https://example.org/search?q={query}',
    }),
    'login-url',
  );

  assert.equal(
    validateWebBibliographicProviderDraft({
      name: 'Example Library',
      loginUrl: 'https://user:secret@example.org/login',
      searchUrlTemplate: 'https://example.org/search?q={query}',
    }),
    'login-url',
  );

  assert.equal(
    validateWebBibliographicProviderDraft({
      name: 'Example Library',
      loginUrl: 'https://example.org/login',
      searchUrlTemplate: 'https://example.org/search',
    }),
    'search-template',
  );
});


test('builds an encoded Academia.edu signed-in search from the preset', () => {
  const url = new URL(
    buildWebBibliographicSearchUrl(
      ACADEMIA_WEB_PROVIDER,
      'open manuscript infrastructure',
    ),
  );

  assert.equal(url.hostname, 'www.academia.edu');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('q'), 'open manuscript infrastructure');
  assert.equal(ACADEMIA_WEB_PROVIDER.loginUrl, 'https://www.academia.edu/login');
  assert.equal(ACADEMIA_WEB_PROVIDER.logoutUrl, 'https://www.academia.edu/logout');
});


test('stores only provider configuration and creates unique custom provider ids', () => {
  const provider = createWebBibliographicProvider(
    {
      name: 'Example Library',
      loginUrl: 'https://example.org/login',
      searchUrlTemplate: 'https://example.org/search?q={query}',
      logoutUrl: 'https://example.org/logout',
    },
    ['example-library'],
  );

  assert.equal(provider.id, 'example-library-2');
  assert.deepEqual(
    Object.keys(provider).sort(),
    ['enabled', 'id', 'loginUrl', 'logoutUrl', 'name', 'searchUrlTemplate'].sort(),
  );
  assert.equal(
    normalizeWebBibliographicProvider({
      ...provider,
      loginUrl: 'javascript:alert(1)',
    }),
    undefined,
  );
});
