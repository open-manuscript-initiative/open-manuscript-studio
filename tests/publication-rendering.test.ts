import assert from 'node:assert/strict';
import test from 'node:test';

import { contributorNameParts } from '../src/model/contributorName.ts';
import {
  buildPublicationRenderingContext,
  collectPublicationContributors,
} from '../src/model/publicationRendering.ts';
import { getPublicationProfile } from '../src/model/publicationProfile.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

test('builds a format-independent rendering context without mutating the manuscript', () => {
  const manuscript = createTestManuscript();
  manuscript.subtitle = 'Portable subtitle';
  manuscript.motto = 'Structure once.';
  const before = JSON.stringify(manuscript);
  const profile = getPublicationProfile('omi-generic-scholarly');
  assert.ok(profile);

  const context = buildPublicationRenderingContext(manuscript, profile);

  assert.equal(context.title, manuscript.title);
  assert.equal(context.subtitle, 'Portable subtitle');
  assert.equal(context.motto, 'Structure once.');
  assert.equal(context.profile.id, 'omi-generic-scholarly');
  assert.equal(context.headRevisionId, manuscript.headRevisionId);
  assert.equal(context.sections.length, 1);
  assert.equal(context.sections[0]?.number, '1.');
  assert.equal(JSON.stringify(manuscript), before);
});

test('turns flat preorder section storage into a hierarchical publication tree', () => {
  const manuscript = createTestManuscript();
  const root = manuscript.sections[0];
  assert.ok(root);
  const childId = 'section-child';
  const grandchildId = 'section-grandchild';

  manuscript.sections = [
    root,
    {
      id: childId,
      title: 'Child',
      blocks: [],
      parentSectionId: root.id,
    } as (typeof manuscript.sections)[number],
    {
      id: grandchildId,
      title: 'Grandchild',
      blocks: [],
      parentSectionId: childId,
    } as (typeof manuscript.sections)[number],
  ];
  const profile = getPublicationProfile('omi-generic-scholarly');
  assert.ok(profile);

  const context = buildPublicationRenderingContext(manuscript, profile);

  assert.equal(context.sections.length, 1);
  assert.equal(context.sections[0]?.children[0]?.title, 'Child');
  assert.equal(context.sections[0]?.children[0]?.children[0]?.title, 'Grandchild');
  assert.equal(context.sections[0]?.children[0]?.number, '1.1.');
  assert.equal(context.sections[0]?.children[0]?.children[0]?.number, '1.1.1.');
});

test('publication contributor name parts preserve order and custom attribution forms', () => {
  const manuscript = createTestManuscript();
  const [contributor] = collectPublicationContributors(manuscript);
  assert.ok(contributor);

  assert.deepEqual(contributorNameParts(contributor), [
    { kind: 'given', text: 'Ada' },
    { kind: 'family', text: 'Scholar' },
  ]);

  contributor.displayName = 'Scholar Ada';
  assert.deepEqual(contributorNameParts(contributor), [
    { kind: 'family', text: 'Scholar' },
    { kind: 'given', text: 'Ada' },
  ]);

  contributor.displayName = 'A. Scholar';
  assert.deepEqual(contributorNameParts(contributor), [
    { kind: 'literal', text: 'A. Scholar' },
  ]);
});

test('publication contributors respect public contribution visibility', () => {
  const manuscript = createTestManuscript();
  const contribution = manuscript.contributions[0];
  assert.ok(contribution);

  assert.equal(collectPublicationContributors(manuscript).length, 1);

  contribution.visibility = 'private';
  assert.equal(collectPublicationContributors(manuscript).length, 0);
});

test('publication contributors never leak private name or identifier assertions', () => {
  const manuscript = createTestManuscript();
  const agent = manuscript.agents[0];
  const contribution = manuscript.contributions[0];
  assert.ok(agent);
  assert.ok(contribution);

  agent.names = [
    {
      id: 'private-name',
      value: 'Private Legal Name',
      givenName: 'Private',
      familyName: 'Name',
      preferred: true,
      visibility: 'private',
    },
    {
      id: 'public-name',
      value: 'Public Attribution',
      givenName: 'Public',
      familyName: 'Attribution',
      visibility: 'public',
    },
  ];
  agent.identifiers = [
    {
      id: 'private-orcid',
      scheme: 'orcid',
      value: '0000-0000-0000-0001',
      normalizedValue: '0000-0000-0000-0001',
      verificationStatus: 'self-asserted',
      visibility: 'private',
    },
  ];
  agent.affiliations[0] = {
    ...agent.affiliations[0]!,
    organizationIdentifier: {
      id: 'private-ror',
      scheme: 'ror',
      value: 'https://ror.org/012345678',
      normalizedValue: 'https://ror.org/012345678',
      verificationStatus: 'verified',
      visibility: 'private',
    },
  };

  const [rendered] = collectPublicationContributors(manuscript);

  assert.equal(rendered?.displayName, 'Public Attribution');
  assert.equal(rendered?.orcid, undefined);
  assert.equal(rendered?.affiliations[0]?.organizationIdentifier, undefined);
});

test('print preserves all four alignments while responsive HTML omits justification and hyphenation', async () => {
  const { clonePublicationStyleTemplate, buildPublicationStyleCss } = await import('../src/services/publicationStyleExport.ts');
  const style = clonePublicationStyleTemplate();
  for (const alignment of ['left', 'center', 'right', 'justify']) {
    for (const typography of Object.values(style.styles)) typography.alignment = alignment;
    style.paragraphStyles.items[0]!.properties.alignment = alignment as 'left' | 'center' | 'right' | 'justify';
    const print = buildPublicationStyleCss(style, 'print');
    const html = buildPublicationStyleCss(style, 'html');
    assert.match(print, new RegExp(`text-align: ${alignment};`));
    assert.match(html, new RegExp(`text-align: ${alignment === 'justify' ? 'left' : alignment};`));
    assert.doesNotMatch(html, /text-align: justify;/);
    for (const selector of ['.article-front h1', '.article-body h2', '.article-body h3', 'figcaption', 'table caption']) {
      const rule = html.split('\n').find((line) => line.startsWith(`${selector} {`));
      assert.ok(rule, `${selector} has an HTML typography rule`);
      assert.ok(rule.includes(`text-align: ${alignment === 'justify' ? 'left' : alignment};`), `${selector} keeps its effective HTML alignment`);
    }
    assert.match(html, new RegExp(`\\.article-body, \\.manuscript-section-body \\{ text-align: ${alignment === 'justify' ? 'left' : alignment};`));
  }
  assert.equal(style.styles.body.alignment, 'justify');
  assert.match(buildPublicationStyleCss(style, 'print'), /hyphens: auto/);
});
