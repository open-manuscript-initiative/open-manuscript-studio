import assert from 'node:assert/strict';
import test from 'node:test';

import { renderJatsArticle } from '../src/services/exportJats.ts';
import {
  JATS_VALIDATION_DTD_FILE,
  validateJats14ArticleAuthoring,
} from '../server/src/services/jatsValidator.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('generated OMI JATS passes the pinned JATS 1.4 Article Authoring MathML3 DTD', async () => {
  const manuscript = createVersionedTestManuscript();
  const rendered = renderJatsArticle(manuscript);
  assert.equal(rendered.validForExport, true);
  assert.match(
    rendered.xml,
    new RegExp(JATS_VALIDATION_DTD_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );

  const validation = await validateJats14ArticleAuthoring(rendered.xml);
  assert.equal(
    validation.valid,
    true,
    validation.diagnostics.map((item) => item.message).join('\n'),
  );
  assert.equal(validation.version, '1.4');
  assert.equal(validation.tagSet, 'articleauthoring');
  assert.equal(validation.schema, 'DTD');
  assert.equal(validation.schemaVariant, 'MathML3');
});

test('DTD validation rejects structurally invalid but well-formed JATS', async () => {
  const manuscript = createVersionedTestManuscript();
  const rendered = renderJatsArticle(manuscript);
  const invalidXml = rendered.xml.replace(
    /<article-title>[\s\S]*?<\/article-title>/,
    '<not-an-article-title>Invalid</not-an-article-title>',
  );

  const validation = await validateJats14ArticleAuthoring(invalidXml);
  assert.equal(validation.valid, false);
  assert.equal(
    validation.diagnostics.some((item) => item.code === 'dtd-validity-error'),
    true,
  );
});

test('validator ignores submitted remote DTD locations and uses the pinned local DTD', async () => {
  const manuscript = createVersionedTestManuscript();
  const rendered = renderJatsArticle(manuscript);
  const remote = rendered.xml.replace(
    /<!DOCTYPE article SYSTEM "[^"]+">/,
    '<!DOCTYPE article SYSTEM "https://invalid.example.test/evil.dtd">',
  );

  const validation = await validateJats14ArticleAuthoring(remote);
  assert.equal(
    validation.valid,
    true,
    validation.diagnostics.map((item) => item.message).join('\n'),
  );
});

test('validator rejects input-side entity declarations and internal subsets', async () => {
  const malicious =
    '<?xml version="1.0"?><!DOCTYPE article [<!ENTITY x "expanded">]><article dtd-version="1.4"><front><article-meta><title-group><article-title>&x;</article-title></title-group></article-meta></front></article>';

  const validation = await validateJats14ArticleAuthoring(malicious);
  assert.equal(validation.valid, false);
  assert.equal(validation.diagnostics[0]?.code, 'unsafe-xml');
});
