import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLICATION_TEXT_ROLES, publicationParagraphStyleName, withPublicationTextRoles } from '../src/model/publicationTextRoles.ts';
import { buildPublicationStyleCss, buildPublicationTextRoleCss, clonePublicationStyleTemplate, normalizePublicationStyle, publicationInlineStyleProperties, publicationNoteCitationRules, resolvePublicationParagraphStyle } from '../src/services/publicationStyleExport.ts';

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

test('text roles migrate saved styles once and keep custom names, IDs and properties', () => {
  const old = { defaultStyleId: 'body', items: [
    { id: 'body', name: 'Törzsszöveg', basedOnId: null, nextStyleId: 'body', properties: {} },
    { id: 'quotation', name: 'Archival quotation', basedOnId: 'body', nextStyleId: 'body', properties: { fontSize: 9.7 } },
    { id: 'custom', name: 'Diplomatic source', basedOnId: 'body', nextStyleId: 'body', properties: { language: 'la' } },
  ] };
  const before = JSON.stringify(old);
  const migrated = withPublicationTextRoles(old);
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(withPublicationTextRoles(migrated), migrated);
  for (const role of PUBLICATION_TEXT_ROLES) assert.equal(migrated.items.filter((item) => item.role === role).length, 1);
  const body = migrated.items.find((item) => item.id === 'body')!;
  assert.equal(publicationParagraphStyleName(body, 'de-DE'), 'Fließtext');
  assert.equal(publicationParagraphStyleName(migrated.items.find((item) => item.id === 'quotation')!, 'hu'), 'Archival quotation');
  assert.equal(migrated.items.find((item) => item.id === 'quotation')!.properties.fontSize, 9.7);
  assert.deepEqual(migrated.items.find((item) => item.id === 'custom'), old.items[2]);
});

test('role styles follow legacy typography defaults and inherit the document or explicit base language', () => {
  const style = clonePublicationStyleTemplate();
  const title = style.paragraphStyles.items.find((item) => item.role === 'title')!;
  assert.equal(resolvePublicationParagraphStyle(style, title.id, 'hu-HU').fontSize, style.styles.articleTitlePrimary.fontSize);
  style.styles.articleTitlePrimary.fontSize = 26;
  assert.equal(resolvePublicationParagraphStyle(style, title.id, 'hu-HU').fontSize, 26);
  title.properties = { fontSize: 27.3, lineHeight: 32.7, language: 'de-DE' };
  style.paragraphStyles.items.push({ id: 'custom-title', name: 'Source title', basedOnId: title.id, nextStyleId: 'body', properties: {} });
  const restored = normalizePublicationStyle(JSON.parse(JSON.stringify(style)));
  const resolved = resolvePublicationParagraphStyle(restored, 'custom-title', 'hu-HU');
  assert.equal(resolved.fontSize, 27.3); assert.equal(resolved.lineHeight, 32.7); assert.equal(resolved.language, 'de-DE');
  delete title.properties.language;
  assert.equal(resolvePublicationParagraphStyle(style, title.id, 'hu-HU').language, 'hu-HU');
  title.name = 'My title'; title.automaticName = false;
  assert.equal(publicationParagraphStyleName(title, 'hu'), 'My title');
});

test('semantic role CSS targets front matter, notes and quotations in preview and both exports', () => {
  const style = clonePublicationStyleTemplate();
  const motto = style.paragraphStyles.items.find((item) => item.role === 'motto')!;
  style.paragraphStyles.items.find((item) => item.role === 'heading1')!.properties.fontSize = 19.4;
  motto.properties = { fontSize: 13.7, lineHeight: 17.8, alignment: 'justify', language: 'la' };
  const html = buildPublicationStyleCss(style, 'html');
  const print = buildPublicationStyleCss(style, 'print');
  const live = buildPublicationTextRoleCss(style, 'print', 'hu-HU', '#proof', 1);
  assert.match(html, /\.omi-scholarly-article \.article-motto \{[^}]*font-size:13.7pt[^}]*text-align:left/);
  assert.match(print, /\.omi-scholarly-article \.article-motto \{[^}]*text-align:justify/);
  assert.match(live, /#proof \.publication-document-motto \{[^}]*font-size:18.266/);
  assert.match(live, /-webkit-locale:"la"/);
  assert.match(live, /#proof \.publication-document-keywords/);
  assert.match(live, /#proof \.publication-page-note/);
  assert.match(live, /#proof \.omi-continuous-tiptap-editor > h1[^}]*font-size:25.866/);
  assert.match(print, /\.omi-scholarly-article \.article-body h2[^}]*font-size:19.4pt/);
});

test('note citation typography inherits citation overrides while unset values follow the surrounding note', () => {
  const style = clonePublicationStyleTemplate();
  const citation = style.paragraphStyles.items.find((item) => item.role === 'citation')!;
  const note = style.paragraphStyles.items.find((item) => item.role === 'note-citation')!;
  assert.deepEqual(publicationInlineStyleProperties(style, note.id), {});
  assert.equal(resolvePublicationParagraphStyle(style, note.id).fontSize, style.styles.footnote.fontSize);
  citation.properties = { fontStyle: 'italic', fontSize: 8.7 };
  note.properties = { fontSize: 9.3 };
  assert.deepEqual(publicationInlineStyleProperties(style, note.id), { fontStyle: 'italic', fontSize: 9.3 });
  const css = buildPublicationTextRoleCss(style, 'print');
  const rule = css.split('\n').find((line) => line.includes('.article-notes .omi-note-citation'))!;
  assert.match(rule, /font-size:9.3pt/); assert.match(rule, /font-style:italic/);
  assert.doesNotMatch(rule, /text-align|margin|line-height/);
});

test('note citation presentation inherits profile settings and permits independent portable overrides', () => {
  const style = clonePublicationStyleTemplate();
  const rules = { style: 'apa-7' as const, noteFirstStyle: 'chicago-notes-bibliography' as const, noteSubsequentStyle: 'mla-9' as const, bibliographyHeading: true };
  const before = JSON.stringify(rules);
  assert.deepEqual(publicationNoteCitationRules(style, rules), rules);
  style.noteCitationStyles = { first: 'iso-690', subsequent: 'apa-7' };
  const restored = normalizePublicationStyle(JSON.parse(JSON.stringify(style)));
  const result = publicationNoteCitationRules(restored, rules);
  assert.equal(result.style, 'apa-7'); assert.equal(result.noteFirstStyle, 'iso-690'); assert.equal(result.noteSubsequentStyle, 'apa-7');
  assert.equal(JSON.stringify(rules), before);
});

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
  assert.equal(properties.fillTint, 100);
  assert.equal(properties.openType?.stylisticSet, 20);
  assert.deepEqual(properties.openType?.stylisticSets, [1, 20]);
  assert.equal(properties.hyphenationSettings?.preference, 100);
  assert.equal(properties.characterStroke?.widthPt, 0);
  assert.equal(properties.characterStroke?.tint, 0);
});
