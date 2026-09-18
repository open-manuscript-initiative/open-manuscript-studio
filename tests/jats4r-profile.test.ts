import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OMI_JATS4R_PROFILE_SCOPE,
  OMI_JATS4R_PROFILE_VERSION,
  OMI_JATS4R_UPSTREAM_REPOSITORY,
  OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
} from '../src/model/jatsPublicationProfiles.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { validateJats4rProfile } from '../src/services/jats4rProfileValidator.ts';
import { evaluateJatsPublicationRelease } from '../src/services/jatsReleaseGate.ts';
import type { JatsSchemaValidationResult } from '../src/services/jatsValidationApi.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

const VALID_DTD: JatsSchemaValidationResult = {
  standard: 'NISO JATS',
  version: '1.4',
  tagSet: 'articleauthoring',
  schema: 'DTD',
  schemaVariant: 'MathML3',
  schemaPackage: '@jats4r/dtds@0.0.10',
  engine: 'libxml2-wasm@0.7.2',
  valid: true,
  diagnostics: [],
};

test('generated OMI JATS passes the offline JATS4R publication profile baseline', () => {
  const rendered = renderJatsArticle(createTestManuscript());
  const profile = validateJats4rProfile(rendered.xml);

  assert.equal(profile.profile, 'jats4r');
  assert.equal(profile.profileVersion, OMI_JATS4R_PROFILE_VERSION);
  assert.equal(profile.scope, OMI_JATS4R_PROFILE_SCOPE);
  assert.equal(profile.upstream.repository, OMI_JATS4R_UPSTREAM_REPOSITORY);
  assert.equal(
    profile.upstream.schematronVersion,
    OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
  );
  assert.equal(
    profile.valid,
    true,
    profile.diagnostics
      .filter((item) => item.severity === 'error')
      .map((item) => `${item.code}: ${item.message}`)
      .join('\n'),
  );
  assert.match(rendered.xml, /<permissions\/>/);
});

test('JATS renderer emits reusable permissions, ALI license metadata and data availability', () => {
  const manuscript = createTestManuscript();
  manuscript.metadata = {
    rights: { en: 'This work is licensed under CC BY 4.0.' },
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    copyrightHolder: { en: 'Open Manuscript Institute' },
    copyrightYear: 2026,
    dataAvailability: { en: 'Research data are available in the cited repository.' },
  };

  const rendered = renderJatsArticle(manuscript);
  const profile = validateJats4rProfile(rendered.xml);

  assert.match(rendered.xml, /xmlns:ali="http:\/\/www\.niso\.org\/schemas\/ali\/1\.0"/);
  assert.match(rendered.xml, /<copyright-year>2026<\/copyright-year>/);
  assert.match(rendered.xml, /<copyright-holder>Open Manuscript Institute<\/copyright-holder>/);
  assert.match(
    rendered.xml,
    /<ali:license_ref>https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/<\/ali:license_ref>/,
  );
  assert.match(rendered.xml, /<sec sec-type="data-availability">/);
  assert.equal(
    profile.valid,
    true,
    profile.diagnostics
      .filter((item) => item.severity === 'error')
      .map((item) => `${item.code}: ${item.message}`)
      .join('\n'),
  );
});

test('JATS4R profile detects permissions, accessibility and citation errors', () => {
  const xml = `<?xml version="1.0"?>
<article dtd-version="1.4" xml:lang="en"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:mml="http://www.w3.org/1998/Math/MathML"
  xmlns:ali="http://www.niso.org/schemas/ali/1.0">
  <front>
    <article-meta>
      <title-group><article-title>Example</article-title></title-group>
      <contrib-group><contrib><contrib-id>0000-0002-1825-0097</contrib-id></contrib></contrib-group>
      <abstract><p>Abstract</p></abstract>
    </article-meta>
  </front>
  <body>
    <sec><title>Body</title>
      <p><ext-link xlink:href="https://example.test">https://example.test</ext-link></p>
      <fig id="fig-1"><graphic xlink:href="figure.png"/></fig>
      <table-wrap id="tbl-1"><table><tbody><tr><td>A</td></tr></tbody></table></table-wrap>
    </sec>
  </body>
  <back>
    <ref-list>
      <ref><element-citation><year>20XX</year><pub-id>10.1/example</pub-id></element-citation></ref>
    </ref-list>
  </back>
</article>`;

  const profile = validateJats4rProfile(xml);
  const codes = new Set(
    profile.diagnostics
      .filter((item) => item.severity === 'error')
      .map((item) => item.code),
  );

  for (const code of [
    'permissions.top-level',
    'accessibility.descriptive-link',
    'accessibility.graphic-alt-text',
    'accessibility.table-header',
    'authors.contrib-id-type',
    'citations.publication-type',
    'citations.four-digit-year',
    'citations.pub-id-type',
    'citations.ref-id',
  ]) {
    assert.equal(codes.has(code), true, `missing JATS4R diagnostic: ${code}`);
  }
  assert.equal(profile.valid, false);
});

test('JATS4R profile errors become a mandatory publication release gate', () => {
  const rendered = renderJatsArticle(createTestManuscript());
  const invalidProfile = validateJats4rProfile(
    rendered.xml.replace('<permissions/>', ''),
  );

  const release = evaluateJatsPublicationRelease(
    rendered,
    VALID_DTD,
    invalidProfile,
  );

  assert.equal(release.releasable, false);
  assert.equal(
    release.gates.find((gate) => gate.id === 'publication-profile')?.status,
    'fail',
  );
  assert.equal(
    release.profileDiagnosticCodes.includes('permissions.top-level'),
    true,
  );
});
