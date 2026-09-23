import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergePublicationParagraphStyleProperties,
  normalizePublicationParagraphStyleCollection,
  type PublicationParagraphStyleCollection,
} from '../src/model/publicationParagraphStyles.ts';

const fallback: PublicationParagraphStyleCollection = {
  defaultStyleId: 'body',
  items: [{
    id: 'body',
    name: 'Body',
    basedOnId: null,
    nextStyleId: 'body',
    properties: {},
  }],
};

test('normalizes extended InDesign paragraph style fields', () => {
  const collection = normalizePublicationParagraphStyleCollection({
    defaultStyleId: 'heading',
    items: [{
      id: 'heading',
      name: 'Heading',
      basedOnId: null,
      nextStyleId: 'heading',
      shortcut: 'Ctrl+1',
      properties: {
        kerningMode: 'optical',
        position: 'superior',
        noBreak: true,
        balanceRaggedLines: true,
        baselineGridAlignment: 'first-line',
        keepWithPrevious: true,
        keepWithNextLines: 3,
        ruleAbove: {
          enabled: true,
          widthPt: 1,
          style: 'double',
          gapColor: 'Paper',
          gapTint: 35,
          widthMode: 'text',
        },
        border: {
          enabled: true,
          widths: { topPt: 1, rightPt: 2, bottomPt: 3, leftPt: 4 },
          corners: {
            topLeft: { radiusMm: 2, shape: 'rounded' },
          },
          offsets: { topMm: 1, leftMm: -0.5 },
          mergeConsecutive: true,
        },
        shading: {
          enabled: true,
          color: 'Black',
          tint: 10,
          suppressInExport: true,
        },
        hyphenationSettings: {
          minimumWordLength: 5,
          preference: 72,
        },
        justification: {
          autoLeadingPercent: 107.92,
          composer: 'adobe-paragraph',
        },
        dropCaps: {
          lines: 3,
          characters: 1,
          alignLeftEdge: true,
        },
        nestedLineStyles: [{
          id: 'line-1',
          characterStyleId: 'small-caps',
          lines: 2,
        }],
        openType: {
          titlingAlternates: true,
          figureStyle: 'oldstyle-proportional',
          stylisticSets: [4, 1, 4, 25],
        },
        underline: {
          enabled: true,
          weightPt: 0.9,
          style: 'solid',
          gapTint: 40,
        },
        exportTagging: {
          htmlTag: 'h2',
          ariaRole: 'heading',
          applyHtmlClass: true,
          cssClass: 'chapter-title',
          emitCss: true,
          pdfTag: 'H2',
        },
      },
      preservedIdml: {
        Composer: 'Adobe Paragraph Composer',
        KeepRule: true,
        '__proto__': 'rejected',
      },
    }],
  }, fallback);

  const style = collection.items[0];
  assert.equal(style.shortcut, 'Ctrl+1');
  assert.equal(style.properties.kerningMode, 'optical');
  assert.equal(style.properties.position, 'superior');
  assert.equal(style.properties.keepWithNextLines, 3);
  assert.equal(style.properties.ruleAbove?.gapTint, 35);
  assert.equal(style.properties.border?.widths?.leftPt, 4);
  assert.equal(style.properties.border?.corners?.topLeft?.shape, 'rounded');
  assert.equal(style.properties.shading?.suppressInExport, true);
  assert.equal(style.properties.hyphenationSettings?.preference, 72);
  assert.equal(style.properties.justification?.autoLeadingPercent, 107.92);
  assert.equal(style.properties.nestedLineStyles?.[0]?.lines, 2);
  assert.deepEqual(style.properties.openType?.stylisticSets, [1, 4, 20]);
  assert.equal(style.properties.exportTagging?.ariaRole, 'heading');
  assert.equal(style.preservedIdml?.Composer, 'Adobe Paragraph Composer');
  assert.equal(Object.prototype.hasOwnProperty.call(style.preservedIdml, '__proto__'), false);
});

test('deep-merges inherited border corners, side widths, and offsets', () => {
  const merged = mergePublicationParagraphStyleProperties({
    border: {
      enabled: true,
      widths: {
        topPt: 1,
        rightPt: 2,
        bottomPt: 3,
        leftPt: 4,
      },
      corners: {
        topLeft: { radiusMm: 2, shape: 'rounded' },
        topRight: { radiusMm: 3, shape: 'bevel' },
      },
      offsets: {
        topMm: 1,
        rightMm: 2,
        bottomMm: 3,
        leftMm: 4,
      },
    },
  }, {
    border: {
      widths: { topPt: 8 },
      corners: {
        topLeft: { radiusMm: 6 },
      },
      offsets: { leftMm: 9 },
    },
  });

  assert.deepEqual(merged.border?.widths, {
    topPt: 8,
    rightPt: 2,
    bottomPt: 3,
    leftPt: 4,
  });
  assert.deepEqual(merged.border?.corners?.topLeft, {
    radiusMm: 6,
    shape: 'rounded',
  });
  assert.deepEqual(merged.border?.corners?.topRight, {
    radiusMm: 3,
    shape: 'bevel',
  });
  assert.deepEqual(merged.border?.offsets, {
    topMm: 1,
    rightMm: 2,
    bottomMm: 3,
    leftMm: 9,
  });
});

test('clamps unsafe or out-of-range compatibility values', () => {
  const collection = normalizePublicationParagraphStyleCollection({
    defaultStyleId: 'body',
    items: [{
      id: 'body',
      name: 'Body',
      basedOnId: null,
      nextStyleId: 'body',
      properties: {
        fillTint: 140,
        openType: {
          stylisticSet: 99,
          stylisticSets: [-1, 0, 1, 21],
        },
        hyphenationSettings: {
          preference: 250,
        },
        characterStroke: {
          widthPt: -3,
          tint: -20,
        },
      },
    }],
  }, fallback);

  const properties = collection.items[0].properties;
  assert.equal(properties.fillTint, 140);
  assert.equal(properties.openType?.stylisticSet, 20);
  assert.deepEqual(properties.openType?.stylisticSets, [1, 20]);
  assert.equal(properties.hyphenationSettings?.preference, 100);
  assert.equal(properties.characterStroke?.widthPt, 0);
  assert.equal(properties.characterStroke?.tint, 0);
});
