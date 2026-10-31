import assert from 'node:assert/strict';
import test from 'node:test';

import { getPublicationProfile, validateManuscriptForPublication } from '../src/model/publicationProfile.ts';
import { buildPublicationRenderingContext } from '../src/model/publicationRendering.ts';
import { createAssetMetadata } from '../src/model/assets.ts';
import { clearMemoryAssetCache, putAssetPayload } from '../src/services/assetRepository.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildPublicationHtmlArtifact } from '../src/services/publicationHtmlArtifact.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('nested sections and child blocks survive HTML/JATS rendering without manuscript mutation', () => {
  const manuscript = createVersionedTestManuscript();
  const source = manuscript.sections[0]!;
  source.children = [{
    id: 'embedded-section', title: 'Nested archival evidence',
    blocks: [{
      id: 'nested-parent', type: 'paragraph', content: 'Parent scholarly passage',
      children: [{ id: 'nested-child', type: 'paragraph', content: 'Child scholarly passage' }],
    }],
    children: [{
      id: 'embedded-grandchild', title: 'Nested grandchild',
      blocks: [{ id: 'grandchild-block', type: 'paragraph', content: 'Deeply nested quotation' }],
    }],
  }];
  const before = JSON.stringify(manuscript);
  const profile = getPublicationProfile('omi-generic-scholarly');
  assert.ok(profile);
  const context = buildPublicationRenderingContext(manuscript, profile);
  assert.equal(context.sections[0]?.children[0]?.id, 'embedded-section');
  assert.equal(context.sections[0]?.children[0]?.depth, 1);
  assert.equal(context.sections[0]?.children[0]?.number, '1.1.');
  assert.equal(context.sections[0]?.children[0]?.children[0]?.id, 'embedded-grandchild');
  const html = renderHtmlArticle(manuscript, profile);
  const jats = renderJatsArticle(manuscript, profile);
  for (const value of [html.html, jats.xml]) {
    for (const text of ['Nested archival evidence', 'Nested grandchild',
      'Parent scholarly passage', 'Child scholarly passage', 'Deeply nested quotation']) {
      assert.ok(value.includes(text), `Missing content from rendered publication: ${text}`);
    }
  }
  assert.equal(JSON.stringify(manuscript), before);
});

test('profile readiness checks deep image/table accessibility and target kind, not only root blocks', () => {
  const manuscript = createVersionedTestManuscript();
  const profile = getPublicationProfile('omi-journal-author-date');
  assert.ok(profile);
  manuscript.sections[0]!.children = [{
    id: 'inner', title: 'Figures and tables', blocks: [{
      id: 'group', type: 'paragraph', content: 'Group',
      children: [
        { id: 'inner-figure', type: 'image', content: '',
          visual: { kind: 'image', src: '', mediaType: 'image/png', alt: '' } },
        { id: 'inner-table', type: 'table', content: '',
          visual: { kind: 'table', cells: [['Sample']], headerRows: 0 } },
      ],
    }],
  }];
  manuscript.crossReferences = [{
    id: 'xref-deep', anchorId: 'xref-anchor', sourceBlockId: 'block-one',
    targetId: 'inner-figure', targetKind: 'figure', displayStyle: 'label-number',
  }];
  const before = JSON.stringify(manuscript);
  const issues = validateManuscriptForPublication(manuscript, profile);
  assert.ok(issues.some((issue) => issue.code === 'missing-figure-alt' && issue.targetId === 'inner-figure'));
  assert.ok(issues.some((issue) => issue.code === 'missing-table-header' && issue.targetId === 'inner-table'));
  assert.equal(issues.some((issue) => issue.code === 'unresolved-cross-reference' && issue.targetId === 'xref-deep'), false);
  manuscript.crossReferences[0]!.targetKind = 'table';
  const inconsistent = validateManuscriptForPublication(manuscript, profile);
  assert.ok(inconsistent.some((issue) => issue.code === 'unresolved-cross-reference' && issue.targetId === 'xref-deep'));
  assert.equal(JSON.stringify({ ...manuscript, crossReferences: [{ ...manuscript.crossReferences[0], targetKind: 'figure' }] }), before);
});

test('standalone HTML publication embeds nested-section figure bytes, never a broken package-local link', async () => {
  clearMemoryAssetCache();
  const manuscript = createVersionedTestManuscript();
  const bytes = new TextEncoder().encode('synthetic-image-data');
  const asset = await createAssetMetadata(bytes, {
    id: 'nested-figure-asset', mediaType: 'image/png', fileName: 'nested.png',
    createdAt: '2026-08-07T00:00:00.000Z',
  });
  manuscript.assets = [asset];
  manuscript.sections[0]!.children = [{
    id: 'nested-media', title: 'Nested media',
    blocks: [{
      id: 'nested-paragraph', type: 'paragraph', content: 'Visual context',
      children: [{
        id: 'nested-image', type: 'image', content: '',
        visual: { kind: 'image', src: '', assetId: asset.id, mediaType: 'image/png', alt: 'Synthetic image' },
      }],
    }],
  }];
  const original = JSON.stringify(manuscript);
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const html = await buildPublicationHtmlArtifact(manuscript);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.ok(html.includes('Synthetic image'));
  assert.ok(!html.includes('src="media/images/'));
  assert.equal(JSON.stringify(manuscript), original);
  clearMemoryAssetCache();
  await assert.rejects(() => buildPublicationHtmlArtifact(manuscript), /Image integrity check failed/);
});
