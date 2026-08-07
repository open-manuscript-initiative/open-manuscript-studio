import assert from 'node:assert/strict';
import test from 'node:test';

import {
  frontMatterIsEmpty,
  getPublicationFrontMatterRules,
  normalizeOptionalFrontMatterValue,
  serializePublicationProfileWithFrontMatter,
} from '../src/model/frontMatter.ts';
import {
  BUILTIN_PUBLICATION_PROFILES,
} from '../src/model/publicationProfile.ts';

test('keeps subtitle and motto independently optional', () => {
  assert.equal(frontMatterIsEmpty({}), true);
  assert.equal(frontMatterIsEmpty({ subtitle: 'A subtitle' }), false);
  assert.equal(frontMatterIsEmpty({ motto: 'Sapere aude' }), false);
  assert.equal(
    frontMatterIsEmpty({ subtitle: '   ', motto: '\n' }),
    true,
  );
});

test('normalizes an intentionally empty optional front-matter field to absence', () => {
  assert.equal(normalizeOptionalFrontMatterValue(''), undefined);
  assert.equal(normalizeOptionalFrontMatterValue('A subtitle'), 'A subtitle');
  assert.equal(normalizeOptionalFrontMatterValue('Sapere aude'), 'Sapere aude');
});

test('every built-in publication profile supports optional subtitle and motto', () => {
  for (const profile of BUILTIN_PUBLICATION_PROFILES) {
    const rules = getPublicationFrontMatterRules(profile);
    assert.equal(rules.subtitle.mode, 'optional');
    assert.equal(rules.subtitle.position, 'below-title');
    assert.equal(rules.motto.mode, 'optional');
    assert.equal(rules.motto.position, 'below-subtitle');
  }
});

test('profile export carries explicit reproducible front-matter rules', () => {
  const profile = BUILTIN_PUBLICATION_PROFILES[0];
  assert.ok(profile);

  const exported = JSON.parse(
    serializePublicationProfileWithFrontMatter(profile),
  ) as {
    rules: {
      frontMatter: {
        subtitle: { mode: string };
        motto: { mode: string; style: string; alignment: string };
      };
    };
  };

  assert.equal(exported.rules.frontMatter.subtitle.mode, 'optional');
  assert.equal(exported.rules.frontMatter.motto.mode, 'optional');
  assert.equal(exported.rules.frontMatter.motto.style, 'italic');
  assert.equal(exported.rules.frontMatter.motto.alignment, 'right');
});
