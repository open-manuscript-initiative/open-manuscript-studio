import { listPresentation, normalizeListAttribute } from '../model/directListFormatting';
import { paragraphFormattingCss } from '../model/directParagraphFormatting';
import { DIRECT_FORMAT_NAMES, directFormattingCss, underlineCss, type DirectFormat } from '../model/directFormatting';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChartPreview } from '../components/ChartPreview';
import { publicationSpineWidth } from '../model/publicationSpine';
import { matterFrameBoxStyle, matterImageStyle, type PublicationMatterFrame } from '../model/publicationMatterFrames';
import { frameClipPath, frameShapeSvg } from './publicationFrameShapes';
import { renderTextBoxGraphic, visualTextBoxDiagnostics } from '../model/textBoxes';
import { tableCellFormat, tableCellTextStyle, tableColumnWidths, tableMergeLayout, tableRowSplitPolicy, tableCellAppearanceStyle, tableRowHeight, tableCellDocument, cellDocumentWithDefaults, cellNestedTable } from '../model/tableLayout';
import { TABLE_LAYOUT_CSS } from './tableLayoutCss';
import { sourceAttributionLossDiagnostics } from '../model/sourceAttributionExport';
import { publicPublicationManuscript } from '../model/publicationAnnotations';
import { getIssueStudyCitationMetadata } from '../model/issueStudyCitationMetadata';
import {
  collectCrossReferenceTargets,
  formatCrossReferenceLabel,
  type OmiCrossReferenceTarget,
} from '../model/crossReferences.ts';
import { renderBibliography, renderCitationCluster } from '../model/cslRendering.ts';
import { getBibliographyRecords } from '../model/citations.ts';
import { getManuscriptFundingStatement } from '../model/semanticFields.ts';
import { buildNoteLabelMap, getNoteKind, sortNotesByDocumentOrder } from '../model/notes.ts';
import { renderPublicationNoteBody } from './publicationNoteBody';
import { contributorNameParts } from '../model/contributorName.ts';
import { renderLatexMath } from '../model/equationRendering.ts';
import { assetPath } from '../model/assets.ts';
import { getPublicationCoverSheet } from '../model/publicationCoverSheet';
import { getPublicationMatter, publicationMatterPages, type PublicationMatterPage } from '../model/publicationMatter';
import { resolvePublicationMatterText } from '../model/publicationShortcodes';
import { authorFontStyle, cssStringLiteral } from './embeddedCss';
import {
  buildPublicationRenderingContext,
  collectPublicationContributors,
  type OmiPublicationRenderingContext,
  type OmiRenderedSection,
} from '../model/publicationRendering.ts';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile.ts';
import { getRevisionStateDigest } from '../model/revisionIntegrity.ts';
import type { OmiAsset } from '../types/assets.ts';
import type {
  OmiAnnotation,
  OmiBibliographicRecord,
  OmiBlock,
  OmiCitation,
  OmiCrossReference,
  OmiManuscript,
} from '../types/omi.ts';

export const OMI_HTML_RENDERER_VERSION = '0.1.0-alpha.3' as const;
export const OMI_HTML_PROFILE = 'semantic-html5-alpha-0.1' as const;

export type HtmlDiagnosticSeverity = 'error' | 'warning';

export interface HtmlDiagnostic {
  code: string;
  severity: HtmlDiagnosticSeverity;
  message: string;
  targetId?: string;
}

export interface HtmlRenderOptions {
  /** Prefix inserted before portable `media/...` asset paths. */
  assetPrefix?: string;
  /** Move semantic footnotes to their anchors for a paged-media renderer. */
  noteLayout?: 'paged';
  publicationMatter?: boolean;
}

export interface HtmlExportResult {
  html: string;
  context: OmiPublicationRenderingContext;
  diagnostics: HtmlDiagnostic[];
  validForExport: boolean;
}

type JsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: JsonNode[];
};

interface RenderState {
  manuscript: OmiManuscript;
  context: OmiPublicationRenderingContext;
  diagnostics: HtmlDiagnostic[];
  targetMap: Map<string, OmiCrossReferenceTarget>;
  crossReferenceMap: Map<string, OmiCrossReference>;
  citationMap: Map<string, OmiCitation>;
  recordMap: Map<string, OmiBibliographicRecord>;
  annotationMap: Map<string, OmiAnnotation>;
  noteLabels: Map<string, string>;
  assetMap: Map<string, OmiAsset>;
  assetPrefix: string;
  pagedNotes: boolean;
  emittedFootnotes: Set<string>;
  emittedLocalNotes: Set<string>;
  noteHtmlBodies: Map<string, string>;
}

/**
 * Renders one OMI manuscript as a complete, script-free semantic HTML5 article.
 *
 * The function consumes the same format-independent publication context as the
 * JATS renderer. It never mutates the manuscript and never treats presentation
 * HTML as canonical scholarly state.
 */
export function renderHtmlArticle(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
  options: HtmlRenderOptions = {},
): HtmlExportResult {
  manuscript = publicPublicationManuscript(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const diagnostics: HtmlDiagnostic[] = context.publicationIssues.map((issue) => ({
    code: `publication-${issue.code}`,
    severity: issue.severity,
    message: issue.detail ? `${issue.code}: ${issue.detail}` : issue.code,
    targetId: issue.targetId,
  }));

  diagnostics.push(...sourceAttributionLossDiagnostics(manuscript, 'HTML'));

  if (!profileSupportsOutput(profile, 'html')) {
    diagnostics.push({
      code: 'profile-does-not-support-html',
      severity: 'error',
      message: `Publication profile ${profile.id}@${profile.version} does not declare HTML output support.`,
    });
  }

  const targetMap = new Map(
    collectCrossReferenceTargets({
      sections: manuscript.sections,
      crossReferenceNumbering: profile.rules.objects.numbering,
      namedAnchors: manuscript.namedAnchors,
    }).map((target) => [target.id, target]),
  );
  const state: RenderState = {
    manuscript,
    context,
    diagnostics,
    targetMap,
    crossReferenceMap: new Map(
      (manuscript.crossReferences ?? []).map((reference) => [reference.id, reference]),
    ),
    citationMap: new Map(manuscript.citations.map((citation) => [citation.id, citation])),
    recordMap: new Map(
      (manuscript.bibliographicRecords ?? []).map((record) => [record.id, record]),
    ),
    annotationMap: new Map(manuscript.annotations.map((annotation) => [annotation.id, annotation])),
    noteLabels: collectNoteLabels(manuscript, profile.rules.notes.localNotePlacement === 'with-notes'),
    assetMap: new Map((manuscript.assets ?? []).map((asset) => [asset.id, asset])),
    assetPrefix: options.assetPrefix ?? '',
    pagedNotes: options.noteLayout === 'paged',
    emittedFootnotes: new Set(),
    emittedLocalNotes: new Set(),
    noteHtmlBodies: new Map(),
  };
  state.noteHtmlBodies = collectNoteHtmlBodies(state);

  const labels = localizedLabels(context.locale);
  const stateDigest = currentStateDigest(manuscript);
  const title = context.subtitle
    ? `${context.title}: ${context.subtitle}`
    : context.title;
  const matterBefore = options.publicationMatter === false ? [] : publicationMatterPages(manuscript, 'before');
  const matterAfter = options.publicationMatter === false ? [] : publicationMatterPages(manuscript, 'after');
  const matter = getPublicationMatter(manuscript);
  const spineWidth = matter ? publicationSpineWidth(matter) : 10;
  const coverSheets = matter && (matterBefore.length || matterAfter.length) ? renderPublicationCoverSheets(matter, state) : '';
  const titlePages = matterBefore.filter((page) => ['half-title', 'series-page', 'title-page', 'imprint-page'].includes(page.kind));
  const article = [
    renderFront(state, labels),
    context.sections.length
      ? `<div class="article-body">\n${indent(
          context.sections.map((section) => renderSection(section, state)).join('\n'),
          1,
        )}\n</div>`
      : '',
    renderNotes(state, labels),
    renderBibliographySection(state, labels),
  ]
    .filter(Boolean)
    .join('\n');

  const html = [
    '<!doctype html>',
    `<html lang="${escapeAttribute(normalizeLanguage(context.locale))}">`,
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <meta name="generator" content="Open Manuscript Studio HTML renderer ${OMI_HTML_RENDERER_VERSION}">`,
    `  <meta name="omi-rendering-profile" content="${OMI_HTML_PROFILE}">`,
    `  <meta name="omi-manuscript-id" content="${escapeAttribute(context.manuscriptId)}">`,
    `  <meta name="omi-head-revision" content="${escapeAttribute(context.headRevisionId)}">`,
    `  <meta name="omi-publication-profile" content="${escapeAttribute(`${profile.id}@${profile.version}`)}">`,
    stateDigest
      ? `  <meta name="omi-state-digest-sha256" content="${escapeAttribute(stateDigest)}">`
      : '',
    ...renderIssueCitationMeta(manuscript),
    `  <title>${escapeHtml(title)}</title>`,
    '  <style>',
    indent(renderProfileCss(profile), 2),
    '  </style>',
    state.pagedNotes ? `<style data-omi-paged-notes>\n${PAGED_NOTE_CSS}\n</style>` : '',
    matterBefore.length || matterAfter.length ? `<style data-omi-publication-matter>\n${publicationMatterCss(profile, spineWidth)}\n</style>` : '',
    '</head>',
    '<body>',
    coverSheets + titlePages.map((page) => renderPublicationMatterPage(page, state)).join('\n'),
    `  <article class="omi-scholarly-article" data-omi-manuscript-id="${escapeAttribute(
      context.manuscriptId,
    )}" data-omi-head-revision="${escapeAttribute(context.headRevisionId)}">`,
    indent(article, 2),
    '  </article>',
    '</body>',
    '</html>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  diagnostics.push(...validateHtmlStructure(html));

  return {
    html,
    context,
    diagnostics,
    validForExport: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

export function htmlFileName(
  manuscript: Pick<OmiManuscript, 'title' | 'id'>,
): string {
  return `${fileStem(manuscript)}.html`;
}

export function htmlPackageFileName(
  manuscript: Pick<OmiManuscript, 'title' | 'id'>,
): string {
  return `${fileStem(manuscript)}.html.zip`;
}

/** Browser/CI structural checks independent from a particular HTML validator. */
export function validateHtmlStructure(html: string): HtmlDiagnostic[] {
  const diagnostics: HtmlDiagnostic[] = [];

  for (const required of [
    '<!doctype html>',
    '<html ',
    '<article class="omi-scholarly-article"',
    '<header class="article-front">',
    '<h1',
  ]) {
    if (!html.toLowerCase().includes(required.toLowerCase())) {
      diagnostics.push({
        code: 'html-required-structure-missing',
        severity: 'error',
        message: `Required semantic HTML structure is missing: ${required}`,
      });
    }
  }

  const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1] ?? '');
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      diagnostics.push({
        code: 'duplicate-html-id',
        severity: 'error',
        message: `Duplicate HTML id: ${id}`,
        targetId: id,
      });
    }
    seen.add(id);
  }

  for (const match of html.matchAll(/\shref="#([^"]+)"/g)) {
    const target = match[1] ?? '';
    if (target && !seen.has(target)) {
      diagnostics.push({
        code: 'unresolved-html-fragment',
        severity: 'error',
        message: `HTML link points to a missing fragment: ${target}`,
        targetId: target,
      });
    }
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\salt="[^"]*"/.test(match[1] ?? '')) {
      diagnostics.push({
        code: 'image-alt-attribute-missing',
        severity: 'error',
        message: 'Rendered HTML image is missing an alt attribute.',
      });
    }
  }

  return diagnostics;
}

function renderFront(
  state: RenderState,
  labels: ReturnType<typeof localizedLabels>,
): string {
  const { context } = state;
  const funding = context.profile.rules.notes.fundingStarNote
    ? getManuscriptFundingStatement(state.manuscript)
    : '';
  const starReference = funding
    ? '<sup class="funding-star-reference"><a href="#funding-star-note" role="doc-noteref" aria-label="Funding statement">*</a></sup>'
    : '';
  const fundingNote = funding
    ? `<aside id="funding-star-note" class="article-funding-star-note" role="doc-footnote"><span class="funding-star-marker" aria-hidden="true">*</span> ${escapeHtml(funding)}</aside>`
    : '';
  const motto = context.motto
    ? `<blockquote class="article-motto motto-${escapeAttribute(
        context.frontMatterRules.motto.alignment,
      )} motto-${escapeAttribute(context.frontMatterRules.motto.style)}">${escapeHtml(
        context.motto,
      )}</blockquote>`
    : '';
  const subtitle = context.subtitle
    ? `<p class="article-subtitle">${escapeHtml(context.subtitle)}</p>`
    : '';
  const contributors = renderContributors(state);
  const abstract = context.abstract
    ? `<section class="article-abstract" aria-labelledby="abstract-heading"><h2 id="abstract-heading">${escapeHtml(
        labels.abstract,
      )}</h2><p>${escapeHtml(context.abstract)}</p></section>`
    : '';
  const keywords = context.keywords.length
    ? `<section class="article-keywords" aria-labelledby="keywords-heading"><h2 id="keywords-heading">${escapeHtml(
        labels.keywords,
      )}</h2><ul>${context.keywords
        .map((keyword) => `<li>${escapeHtml(keyword)}</li>`)
        .join('')}</ul></section>`
    : '';

  return `<header class="article-front">\n${indent(
    [
      `<h1 id="article-title">${escapeHtml(context.title)}${starReference}</h1>`,
      subtitle,
      motto,
      contributors,
      fundingNote,
      abstract,
      keywords,
    ]
      .filter(Boolean)
      .join('\n'),
    1,
  )}\n</header>`;
}

function renderContributors(state: RenderState, targetId?: string): string {
  const { context } = state;
  const contributors = targetId ? collectPublicationContributors({
    id: targetId, agents: state.manuscript.agents, contributions: state.manuscript.contributions,
  }) : context.contributors;
  if (!contributors.length) return '';
  const affiliationId = (id: string) => htmlId('aff', targetId ? `${targetId}-${id}` : id);
  const rules = context.profile.rules.contributors;
  const affiliationMap = new Map(
    contributors
      .flatMap((contributor) => contributor.affiliations)
      .map((affiliation) => [affiliation.id, affiliation]),
  );

  const authors = contributors
    .map((contributor) => {
      const affiliationMarkers =
        rules.showAffiliations && rules.affiliationMode === 'markers'
          ? contributor.affiliations
              .map((affiliation) => {
                const ordinal = Array.from(affiliationMap.keys()).indexOf(affiliation.id) + 1;
                return `<a class="affiliation-marker" href="#${affiliationId(affiliation.id)}" aria-label="Affiliation ${ordinal}">${ordinal}</a>`;
              })
              .join(',')
          : '';
      const inlineAffiliations =
        rules.showAffiliations && rules.affiliationMode === 'inline'
          ? contributor.affiliations
              .map((affiliation) => affiliation.organizationName)
              .filter(Boolean)
              .join('; ')
          : '';
      const orcid = rules.showOrcid && contributor.orcid
        ? `<a class="orcid" href="${escapeAttribute(contributor.orcid)}" rel="external">ORCID</a>`
        : '';
      const corresponding = rules.showCorrespondingMarker && contributor.corresponding
        ? '<span class="corresponding" aria-label="Corresponding author">*</span>'
        : '';

      const name = contributorNameParts(contributor)
        .map((part) => {
          const className =
            part.kind === 'given'
              ? 'author-given-name'
              : part.kind === 'family'
                ? 'author-family-name'
                : 'author-literal-name';
          return `<span class="${className}">${escapeHtml(part.text)}</span>`;
        })
        .join(' ');

      return `<li id="${htmlId('contrib', contributor.contributionId)}"><span class="author-name">${name}</span>${corresponding}${affiliationMarkers ? `<sup>${affiliationMarkers}</sup>` : ''}${
        inlineAffiliations ? `<span class="author-affiliation-inline">${escapeHtml(inlineAffiliations)}</span>` : ''
      }${orcid ? `<span class="author-orcid">${orcid}</span>` : ''}</li>`;
    })
    .join('');

  const affiliations =
    rules.showAffiliations && rules.affiliationMode === 'markers' && affiliationMap.size
      ? `<ol class="affiliations">${Array.from(affiliationMap.values())
          .map((affiliation) => {
            const details = [
              affiliation.position,
              affiliation.department,
              affiliation.organizationName,
            ]
              .filter(Boolean)
              .join(', ');
            const ror = affiliation.organizationIdentifier
              ? `<a href="${escapeAttribute(
                  normalizeRorHref(affiliation.organizationIdentifier),
                )}" rel="external">ROR</a>`
              : '';
            return `<li id="${affiliationId(affiliation.id)}">${escapeHtml(details)}${
              ror ? ` <span class="author-affiliation-inline">${ror}</span>` : ''
            }</li>`;
          })
          .join('')}</ol>`
      : '';

  return `<section class="article-contributors" aria-label="Authors"><ol class="authors">${authors}</ol>${affiliations}</section>`;
}

function renderSection(section: OmiRenderedSection, state: RenderState): string {
  const headingLevel = Math.min(6, Math.max(2, section.depth + 2));
  const ariaLevel = section.depth + 2 > 6 ? ` aria-level="${section.depth + 2}"` : '';
  const number = section.number
    ? `<span class="section-number" aria-hidden="true">${escapeHtml(section.number)}</span>`
    : '';
  const blocks = section.blocks
    .map((block) => renderBlockTree(block, state))
    .filter(Boolean)
    .join('\n');
  const children = section.children.map((child) => renderSection(child, state)).join('\n');
  const defaultColumns = Math.max(
    1,
    Math.min(3, Math.trunc(state.context.profile.rules.layout.columns || 1)),
  );
  const columns = section.layout?.columns ?? defaultColumns;
  const columnGapMm = section.layout?.columnGapMm ?? 8;
  const tabStops = section.layout?.tabStopsMm ?? [];
  const tabIntervalMm = tabStops[0] ?? 12.5;
  const tabStopsAttribute = tabStops.length
    ? ` data-omi-tab-stops-mm="${escapeAttribute(tabStops.join(' '))}"`
    : '';
  const body = blocks
    ? `<div class="manuscript-section-body" data-omi-columns="${columns}"${tabStopsAttribute} style="column-count:${columns};column-gap:${columnGapMm}mm;tab-size:${tabIntervalMm}mm">\n${indent(blocks, 1)}\n</div>`
    : '';
  const content = [
    `<h${headingLevel}${ariaLevel}>${number}<span class="section-title">${escapeHtml(
      section.title,
    )}</span></h${headingLevel}>`,
    // Imported studies own their authors; never promote them to issue-level authors.
    section.depth === 0 && state.manuscript.sections.some(item => item.id === section.id && item.studyMetadata)
      ? renderContributors(state, section.id) : '',
    body,
    children,
  ]
    .filter(Boolean)
    .join('\n');

  return `<section id="${htmlId('sec', section.id)}" class="manuscript-section" data-omi-section-id="${escapeAttribute(
    section.id,
  )}">\n${indent(content, 1)}\n</section>`;
}

/** Keep all semantic child blocks in the output, in canonical preorder.
 * Rendering-only flattening never modifies manuscript content or identities. */
function renderBlockTree(block: OmiBlock, state: RenderState): string {
  const own = renderBlock(block, state);
  const descendants = (block.children ?? []).map((child) => renderBlockTree(child, state)).filter(Boolean);
  return [own, ...descendants].filter(Boolean).join('\n');
}

function renderBlock(block: OmiBlock, state: RenderState): string {
  if (block.visual) for (const diagnostic of visualTextBoxDiagnostics(block.visual)) {
    state.diagnostics.push({ ...diagnostic, severity: 'warning', message: 'This text-box view cannot represent all stored content. Original data remains in OMI; review before publication.' });
  }
  if (block.visual) {
    switch (block.visual.kind) {
      case 'text-box': {
        const box = block.visual.textBox;
        return `<figure id="${htmlId('block', block.id)}" data-omi-block-id="${escapeAttribute(block.id)}">${renderTextBoxGraphic(box.width + Math.max(0, box.x), box.height + Math.max(0, box.y), [box])}</figure>`;
      }
      case 'image':
        return renderImage(block, state);
      case 'table':
        return renderTable(block, state);
      case 'chart':
        return renderChart(block, state);
      case 'equation':
        return renderEquation(block, state);
      case 'music-score':
        return renderMusicScore(block, state);
    }
  }

  const root = parseStructuredContent(block.content);
  const paragraphStyleAttribute = block.paragraphStyleId?.trim()
    ? ` data-omi-paragraph-style-id="${escapeAttribute(block.paragraphStyleId.trim())}"`
    : '';
  if (!root) {
    const fallback = block.content.trim();
    return fallback
      ? `<p id="${htmlId('block', block.id)}" data-omi-block-id="${escapeAttribute(
          block.id,
        )}"${paragraphStyleAttribute}>${escapeHtml(fallback)}</p>`
      : '';
  }

  const rendered = renderJsonNode(root, state);
  return rendered
      ? `<div id="${htmlId('block', block.id)}" class="text-block" data-omi-block-id="${escapeAttribute(
        block.id,
      )}"${paragraphStyleAttribute}>${rendered}</div>`
    : '';
}

function renderImage(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'image') return '';
  const visual = block.visual;
  const asset = visual.assetId ? state.assetMap.get(visual.assetId) : undefined;
  let src = visual.src.trim();

  if (visual.assetId) {
    if (!asset) {
      state.diagnostics.push({
        code: 'html-asset-metadata-missing',
        severity: 'error',
        message: `Image block ${block.id} references missing asset metadata ${visual.assetId}.`,
        targetId: visual.assetId,
      });
      src = '';
    } else {
      src = `${state.assetPrefix}${assetPath(asset)}`;
    }
  } else if (src.startsWith('data:')) {
    state.diagnostics.push({
      code: 'html-legacy-embedded-image',
      severity: 'warning',
      message: `Image block ${block.id} still uses an embedded data URL instead of a portable asset.`,
      targetId: block.id,
    });
  }

  if (!src) {
    state.diagnostics.push({
      code: 'html-image-source-missing',
      severity: 'error',
      message: `Image block ${block.id} has no renderable source.`,
      targetId: block.id,
    });
  }

  const width = finiteDimension(visual.width);
  const height = finiteDimension(visual.height);
  const image = visual.textBoxes?.length ? renderTextBoxGraphic(width ?? 600, height ?? 300, visual.textBoxes, { src, alt: visual.alt }) : `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(visual.alt)}"${
    width ? ` width="${width}"` : ''
  }${height ? ` height="${height}"` : ''}>`;
  const caption = visual.caption?.trim()
    ? `<figcaption>${escapeHtml(visual.caption)}</figcaption>`
    : '';
  const content = state.context.profile.rules.objects.figureCaptionPosition === 'above'
    ? [caption, image].filter(Boolean).join('\n')
    : [image, caption].filter(Boolean).join('\n');

  return `<figure id="${htmlId('fig', block.id)}" class="scholarly-figure" data-omi-block-id="${escapeAttribute(
    block.id,
  )}">\n${indent(content, 1)}\n</figure>`;
}

function renderTable(block: OmiBlock, state: RenderState,nested=false): string {
  if (block.visual?.kind !== 'table') return '';
  const visual = block.visual;
  const renderCellText = (cell: string, row: number, column: number) => {
    const format = tableCellFormat(visual.cellFormats, row, column);
    const doc=tableCellDocument(visual,row,column);
    const text=doc?cellDocumentWithDefaults(doc,format.horizontalAlign).content?.map((node,index)=>{const table=cellNestedTable(node);return table?renderTable({...block,id:block.id+'-cell-'+row+'-'+column+'-'+index,visual:table},state,true):renderJsonNode(node,state);}).join('')??'':escapeHtml(cell).replace(/\r\n?|\n/g, '&#10;');
    if (format.textRotation === 0 && format.textDirection === 'auto' && !visual.cellFormats?.[`${row}:${column}`]) return text;
    const css = Object.entries({...tableCellTextStyle(format.textRotation), ...(format.horizontalAlign?{textAlign:format.horizontalAlign,...(format.textRotation===0?{width:'100%'}:{})}:{})}).map(([key, value]) =>
      `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}`,
    ).join(';');
    const tag=doc?'div':'span';
    return `<${tag} class="omi-table-cell-text" dir="${format.textDirection}" data-text-rotation="${format.textRotation}" style="${css}">${text}</${tag}>`;
  };
  const headerRows = Math.max(0, Math.min(visual.headerRows ?? 0, visual.cells.length));
  const layout=tableMergeLayout(visual.cells,visual.cellMerges,headerRows);
  const renderCell=(cell:string,r:number,c:number,tag:'td'|'th')=>{
    if(layout.covered(r,c)) return '';
    const m=layout.at(r,c);
    const css=Object.entries(tableCellAppearanceStyle(tableCellFormat(visual.cellFormats,r,c))).map(([key,value])=>key.replace(/[A-Z]/g,l=>'-'+l.toLowerCase())+':'+value).join(';');
    return '<'+tag+(tag==='th'?' scope="'+(m && m.colSpan>1?'colgroup':'col')+'"':'')+(m && m.rowSpan>1?' rowspan="'+m.rowSpan+'"':'')+(m && m.colSpan>1?' colspan="'+m.colSpan+'"':'')+(css?' style="'+css+'"':'')+'>'+renderCellText(cell,r,c)+'</'+tag+'>';
  };
  const rowStart=(r:number)=>{
    const height=tableRowHeight(visual,r);
    return '<tr'+(tableRowSplitPolicy(visual,r)==='allow'?' data-omi-row-split="allow"':'')+
      (height.mode==='auto'?'':' data-omi-row-height="'+height.mode+'" style="height:'+height.heightPt+'pt"')+'>';
  };
  const header = headerRows
    ? `<thead>${visual.cells
        .slice(0, headerRows)
        .map(
          (row, rowIndex) =>
            `${rowStart(rowIndex)}${row.map((cell, columnIndex) => renderCell(cell,rowIndex,columnIndex,'th')).join('')}</tr>`,
        )
        .join('')}</thead>`
    : '';
  const bodyRows = visual.cells.slice(headerRows);
  const body = `<tbody>${bodyRows
    .map((row, rowIndex) => `${rowStart(rowIndex+headerRows)}${row.map((cell, columnIndex) => renderCell(cell,rowIndex+headerRows,columnIndex,'td')).join('')}</tr>`)
    .join('')}</tbody>`;
  const widths = tableColumnWidths(visual.cells, visual.columnWidths);
  const columns = `<colgroup>${widths.map((width) => `<col style="width:${width}%">`).join('')}</colgroup>`;
  const reduction = visual.fontSizeReduction === 0 ? 0 : 1;
  const table = `<table style="--omi-table-font-reduction:${reduction}">${columns}${header}${body}</table>`;
  if(nested) return table;
  const caption = visual.caption?.trim()
    ? `<figcaption>${escapeHtml(visual.caption)}</figcaption>`
    : '';
  const content = state.context.profile.rules.objects.tableCaptionPosition === 'above'
    ? [caption, table].filter(Boolean).join('\n')
    : [table, caption].filter(Boolean).join('\n');

  return `<figure id="${htmlId('tbl', block.id)}" class="scholarly-table" data-omi-block-id="${escapeAttribute(
    block.id,
  )}">\n${indent(content, 1)}\n</figure>`;
}

function renderChart(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'chart') return '';
  const visual = block.visual;
  // Render the *same* React SVG used by the manuscript and publication preview.
  // React's server renderer escapes untrusted chart titles and category labels.
  // No runtime JavaScript, external stylesheets or remote chart dependencies.
  const rendered = renderToStaticMarkup(createElement(ChartPreview, {
    data: visual,
    emptyLabel: '',
  }));
  const svg = rendered.startsWith('<svg') ? rendered : '';
  if (!svg) {
    state.diagnostics.push({
      code: 'html-chart-no-renderable-data',
      severity: 'warning',
      message: `Chart ${block.id} has no renderable numeric values; source data is retained as a table.`,
      targetId: block.id,
    });
  }

  const captionText = visual.caption?.trim() || visual.title?.trim();
  const caption = captionText ? `<figcaption>${escapeHtml(captionText)}</figcaption>` : '';
  const sourceLabel = localizedLabels(state.manuscript.locale).chartSourceData;
  const [header, ...dataRows] = visual.cells;
  const head = header
    ? `<thead><tr>${header.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
    : '';
  const body = dataRows.map((row) =>
    `<tr>${row.map((cell, index) => index === 0
      ? `<th scope="row">${escapeHtml(cell)}</th>`
      : `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
  ).join('');
  const table = `<table class="chart-data"><caption>${escapeHtml(sourceLabel)}</caption>${head}<tbody>${body}</tbody></table>`;
  const source = svg
    ? `<details class="scholarly-chart-source"><summary>${escapeHtml(sourceLabel)}</summary>${table}</details>`
    : table;

  return `<figure id="${htmlId('chart', block.id)}" class="scholarly-chart" data-omi-block-id="${escapeAttribute(
    block.id,
  )}" data-chart-type="${escapeAttribute(visual.chartType)}" data-chart-style="${escapeAttribute(visual.stylePreset ?? 'color')}">
${indent([caption, svg, source].filter(Boolean).join('\n'), 1)}
</figure>`;
}

function renderEquation(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'equation') return '';
  const visual = block.visual;
  const latex = visual.latex?.trim() || (visual.notation === 'latex' ? visual.source.trim() : '');
  let equation: string;

  if (latex) {
    const result = renderLatexMath(latex);
    if (result.error) state.diagnostics.push({
      code: 'invalid-equation-latex', severity: 'error',
      message: result.error, targetId: block.id,
    });
    equation = result.mathml;
  } else {
    equation = `<pre class="equation-source"><code>${escapeHtml(visual.source)}</code></pre>`;
    state.diagnostics.push({
      code: 'html-equation-source-fallback',
      severity: 'warning',
      message: `Equation ${block.id} has no normalized LaTeX and is rendered as escaped source notation.`,
      targetId: block.id,
    });
  }

  const target = state.targetMap.get(block.id);
  const generatedLabel = target
    ? `${localizedLabels(state.context.locale).equation} ${target.number}`
    : '';
  const captionText = visual.caption?.trim() || visual.label?.trim() || generatedLabel;
  const caption = captionText ? `<figcaption>${escapeHtml(captionText)}</figcaption>` : '';

  return `<figure id="${htmlId('eq', block.id)}" class="scholarly-equation" data-omi-block-id="${escapeAttribute(
    block.id,
  )}">${equation}${caption}</figure>`;
}

function renderMusicScore(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'music-score') return '';
  const visual = block.visual;
  const target = state.targetMap.get(block.id);
  const label = target ? `${localizedLabels(state.context.locale).figure} ${target.number}` : '';
  const title = visual.caption?.trim() || visual.title?.trim() || label;
  const notes = visual.notes.slice(0, 256).map((note) => note.rest ? 'rest' : `${note.step}${note.alter === 1 ? '♯' : note.alter === -1 ? '♭' : ''}${note.octave}`).join(' ');
  return `<figure id="${htmlId('music', block.id)}" class="scholarly-music-score" data-omi-block-id="${escapeAttribute(block.id)}"><div class="music-score-data" data-format="${escapeAttribute(visual.format)}">${escapeHtml(notes)}</div>${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''}</figure>`;
}

function renderPublicationCoverSheets(model: NonNullable<ReturnType<typeof getPublicationMatter>>, state: RenderState): string {
  const profile = state.context.profile;
  const width = profile.publicationStyle?.page.width ?? (profile.rules.layout.pageSize === 'Letter' ? 215.9 : 210);
  const height = profile.publicationStyle?.page.height ?? (profile.rules.layout.pageSize === 'Letter' ? 279.4 : 297);
  const spineWidth = publicationSpineWidth(model);
  return (['cover-outside', 'cover-inside'] as const).map((kind) => {
    const sheet = getPublicationCoverSheet(model, kind, width, height);
    if (!sheet.enabled) return '';
    return `<section class="omi-publication-cover-spread" data-cover-sheet="${kind}" data-spine-width-mm="${spineWidth}" style="width:${2 * width + spineWidth}mm;height:${height}mm">${renderPublicationMatterPage(sheet, state, { width: 2 * width + spineWidth, height, left: 0 })}</section>`;
  }).join('');
}

function renderMatterShortcodes(content: string, targetId: string, state: RenderState, locale?: string): string {
  const resolved = resolvePublicationMatterText(content, state.manuscript, locale);
  for (const key of resolved.missing) state.diagnostics.push({ code: 'publication-matter-shortcode-missing', severity: 'error', message: 'Missing publication metadata: ' + key, targetId });
  return renderJsonNode(JSON.parse(resolved.content) as JsonNode, state);
}

function renderPublicationMatterPage(page: PublicationMatterPage, state: RenderState, panel?: { width: number; height: number; left: number }): string {
  const appearance = page.appearance;
  const justify = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[appearance.vertical];
  const styles = `font-family:${cssStringLiteral(appearance.fontFamily)},serif;font-size:${appearance.fontSizePt}pt;color:${appearance.color};background:${appearance.background};text-align:${appearance.alignment};hyphens:auto;justify-content:${justify};padding:${appearance.paddingMm}mm`;
  let image = '';
  if (page.image) {
    const asset = state.assetMap.get(page.image.assetId);
    if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mediaType)) {
      state.diagnostics.push({ code: 'publication-matter-image-missing', severity: 'error', message: 'A publication cover image is missing or unsupported.', targetId: page.kind });
    } else image = `<img class="omi-publication-matter-image" src="${escapeAttribute(state.assetPrefix + assetPath(asset))}" alt="${escapeAttribute(page.image.alt)}" style="object-fit:${page.image.fit}">`;
  }
  const width = panel?.width ?? state.context.profile.publicationStyle?.page.width ?? (state.context.profile.rules.layout.pageSize === 'Letter' ? 215.9 : 210);
  const height = panel?.height ?? state.context.profile.publicationStyle?.page.height ?? (state.context.profile.rules.layout.pageSize === 'Letter' ? 279.4 : 297);
  const frames = (page.frames ?? []).map((frame, index) => renderPublicationMatterFrame(frame, index, width, height, state)).join('');
  return `<section class="omi-publication-matter-page" data-publication-matter="${page.kind}" aria-label="${page.kind}" style="${escapeAttribute(styles + (frames || panel ? `;height:${height}mm;overflow:hidden` : '') + (panel ? `;width:${width}mm;min-height:${height}mm;position:absolute;left:${panel.left}mm;top:0;max-width:none` : ''))}">${image}<div class="omi-publication-matter-text">${renderMatterShortcodes(page.content, page.kind, state)}</div>${frames}</section>`;
}

function renderPublicationMatterFrame(frame: PublicationMatterFrame, index: number, width: number, height: number, state: RenderState): string {
  const inline = (style: object) => Object.entries(style).map(([key, value]) => `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`).join(';');
  const box = inline({ ...matterFrameBoxStyle(frame, width, height), zIndex: index + 2 });
  let content = '';
  if (frame.kind === 'text') content = renderMatterShortcodes(frame.content!, frame.id, state, frame.style.language || undefined);
  else if (frame.image) {
    const asset = state.assetMap.get(frame.image.assetId);
    if (!asset || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mediaType)) {
      state.diagnostics.push({ code: 'publication-matter-frame-image-missing', severity: 'error', message: 'A publication page frame image is missing or unsupported.', targetId: frame.id });
    } else content = `<img class="omi-matter-frame-image" src="${escapeAttribute(state.assetPrefix + assetPath(asset))}" alt="${escapeAttribute(frame.image.alt)}" style="${escapeAttribute(inline(matterImageStyle(frame)))}">`;
  }
  const textStyle = frame.kind === 'text' ? `;display:flex;flex-direction:column;justify-content:${{ top: 'flex-start', center: 'center', bottom: 'flex-end' }[frame.vertical ?? 'top']};padding:${frame.style.paddingMm}mm;font-family:${cssStringLiteral(frame.style.fontFamily)},serif;font-size:${frame.style.fontSizePt}pt;line-height:${frame.style.lineHeightPt}pt;font-weight:${frame.style.fontWeight};font-style:${frame.style.fontStyle};color:${frame.style.color};text-align:${frame.style.alignment};hyphens:${frame.style.hyphenation === false ? 'none' : 'auto'}` : '';
  return `<div class="omi-matter-frame" data-matter-frame-id="${escapeAttribute(frame.id)}" data-frame-kind="${frame.kind}" aria-label="${escapeAttribute(frame.name)}" style="${escapeAttribute(box)}">${frameShapeSvg(frame, { ...frame.style, strokeWidthMm: 0 })}<div class="omi-matter-frame-content"${frame.style.hyphenation === false ? ' data-omi-no-hyphenation="true"' : ''}${frame.style.language ? ` lang="${escapeAttribute(frame.style.language)}"` : ''} style="clip-path:${frameClipPath(frame)}${escapeAttribute(textStyle)}">${content}</div>${frame.style.strokeWidthMm > 0 ? frameShapeSvg(frame, { ...frame.style, fill: 'none' }) : ''}</div>`;
}

function publicationMatterCss(profile: OmiPublicationProfile, spineWidth: number): string {
  const width = profile.publicationStyle?.page.width ?? (profile.rules.layout.pageSize === 'Letter' ? 215.9 : 210);
  const height = profile.publicationStyle?.page.height ?? (profile.rules.layout.pageSize === 'Letter' ? 279.4 : 297);
  return `
@page omi_publication_matter { size:${width}mm ${height}mm; margin:0; counter-increment:page 0;
  @top-left { content:none } @top-center { content:none } @top-right { content:none }
  @bottom-left { content:none } @bottom-center { content:none } @bottom-right { content:none }
}
@page omi_publication_cover { size:${2 * width + spineWidth}mm ${height}mm; margin:0; counter-increment:page 0;
  @top-left { content:none } @top-center { content:none } @top-right { content:none }
  @bottom-left { content:none } @bottom-center { content:none } @bottom-right { content:none }
}
.omi-publication-cover-spread { page:omi_publication_cover; position:relative; break-before:page; break-after:page; break-inside:avoid; background:#fff; isolation:isolate; }
.omi-publication-cover-spread > .omi-publication-matter-page { page:auto; break-before:auto; break-after:auto; margin:0; box-shadow:none; }
.omi-publication-matter-page { page:omi_publication_matter; break-before:page; break-after:page; break-inside:avoid;
  box-sizing:border-box; width:${width}mm; min-height:${height}mm; position:relative; display:flex; flex-direction:column; isolation:isolate;
  print-color-adjust:exact; -webkit-print-color-adjust:exact; overflow-wrap:anywhere; }
.omi-publication-matter-image { position:absolute; inset:0; width:100%; height:100%; z-index:0; }
.omi-matter-frame { overflow:visible; }
.omi-matter-frame > .omi-frame-outline { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
.omi-matter-frame-content { position:absolute; inset:0; overflow:hidden; box-sizing:border-box; }
.omi-matter-frame-content > p,.omi-matter-frame-content > div { flex-shrink:0; }\n.omi-matter-frame-content p { margin:0 0 .8em; font:inherit; white-space:pre-wrap; }
.omi-matter-frame-content p:last-child { margin-bottom:0; }
.omi-matter-frame-image { display:block; object-fit:fill; }
.omi-publication-matter-text { position:relative; z-index:1; } .omi-publication-matter-text p { white-space:pre-wrap; }
@media screen { .omi-publication-matter-page { margin:1rem auto; max-width:100%; box-shadow:0 2px 10px #0002; } }
@media print { .omi-publication-matter-page { margin:0; } }
`;
}

function renderJsonNode(node: JsonNode, state: RenderState): string {
  const children = () => (node.content ?? []).map((child) => renderJsonNode(child, state)).join('');

  switch (node.type) {
    case 'doc':
      return children();
    case 'paragraph': {
      const css = paragraphFormattingCss(node.attrs, state.pagedNotes ? 'print' : 'html');
      const noHyphenation=state.pagedNotes&&node.attrs?.omiAutoHyphenation===false?' data-omi-no-hyphenation="true"':'';
      return `<p${noHyphenation}${css ? ` style="${css}"` : ''}>${children()}</p>`;
    }
    case 'blockquote':
      return `<blockquote>${children()}</blockquote>`;
    case 'bulletList':
      return `<ul>${children()}</ul>`;
    case 'orderedList': {
      const start = normalizeListAttribute('omiListStart',node.attrs?.start ?? node.attrs?.omiListStart);
      const presentation = listPresentation(node.attrs);
      return `<ol${start && start !== 1 ? ` start="${start}"` : ''}${presentation.type ? ` type="${presentation.type}"` : ''}${presentation.style ? ` style="${presentation.style}"` : ''}>${children()}</ol>`;
    }
    case 'listItem':
      return `<li>${children()}</li>`;
    case 'codeBlock':
      return `<pre><code>${escapeHtml(textContent(node))}</code></pre>`;
    case 'heading': {
      const level = Math.min(6, Math.max(2, integerAttr(node.attrs, 'level') ?? 3));
      return `<h${level}>${children()}</h${level}>`;
    }
    case 'hardBreak':
      return '<br>';
    case 'omiTab':
      return '<span class="omi-tab" aria-hidden="true">\t</span>';
    case 'text':
      return applyMarks(renderTextWithTabs(node.text ?? ''), node.marks ?? []);
    case 'omiCitation':
      return renderCitationMarker(node, state);
    case 'omiCrossReference':
      return renderCrossReferenceMarker(node, state);
    case 'omiNote':
      return renderNoteMarker(node, state);
    default:
      return children() || (node.text ? escapeHtml(node.text) : '');
  }
}

function renderCitationMarker(node: JsonNode, state: RenderState): string {
  const ids = arrayStringAttr(node.attrs, 'citationIds');
  const fallbackId = stringAttr(node.attrs, 'citationId');
  const citationIds = ids.length ? ids : fallbackId ? [fallbackId] : [];
  const citations = citationIds
    .map((id) => state.citationMap.get(id))
    .filter((citation): citation is OmiCitation => Boolean(citation));

  if (!citations.length) {
    state.diagnostics.push({
      code: 'html-citation-marker-unresolved',
      severity: 'error',
      message: 'An inline citation marker does not resolve to a semantic citation occurrence.',
    });
    return '<span class="citation citation-unresolved">[unresolved citation]</span>';
  }

  const records = citations
    .map((citation) => state.recordMap.get(citation.target))
    .filter((record): record is OmiBibliographicRecord => Boolean(record));
  const label = renderCitationCluster(
    citations,
    records,
    state.context.profile.rules.citations.style,
    state.context.locale,
  );
  const targetIds = citations
    .map((citation) => citation.target)
    .filter((id) => state.recordMap.has(id));

  if (!targetIds.length) {
    return `<span class="citation citation-unresolved">${escapeHtml(label)}</span>`;
  }

  return `<a class="citation" role="doc-biblioref" href="#${htmlId(
    'ref',
    targetIds[0] ?? '',
  )}" data-bibliography-targets="${escapeAttribute(
    targetIds.map((id) => htmlId('ref', id)).join(' '),
  )}">${escapeHtml(label)}</a>`;
}

function renderCrossReferenceMarker(node: JsonNode, state: RenderState): string {
  const crossReferenceId = stringAttr(node.attrs, 'crossReferenceId');
  const reference = crossReferenceId
    ? state.crossReferenceMap.get(crossReferenceId)
    : undefined;
  if (!reference) {
    state.diagnostics.push({
      code: 'html-cross-reference-marker-unresolved',
      severity: 'error',
      message: 'An inline cross-reference marker does not resolve to a semantic cross-reference.',
      targetId: crossReferenceId,
    });
    return '<span class="xref xref-unresolved">[unresolved reference]</span>';
  }

  const target = state.targetMap.get(reference.targetId);
  const label = formatCrossReferenceLabel(reference, target, state.context.locale);
  if (!target) {
    return `<span class="xref xref-unresolved">${escapeHtml(label)}</span>`;
  }

  return `<a class="xref" href="#${targetHtmlId(target, state)}">${escapeHtml(label)}</a>`;
}

function renderNoteMarker(node: JsonNode, state: RenderState): string {
  const noteId = stringAttr(node.attrs, 'noteId');
  const annotation = noteId ? state.annotationMap.get(noteId) : undefined;
  if (!annotation) {
    state.diagnostics.push({
      code: 'html-note-marker-unresolved',
      severity: 'error',
      message: 'An inline note marker does not resolve to a semantic note annotation.',
      targetId: noteId,
    });
    return '<sup class="note-ref note-ref-unresolved">?</sup>';
  }
  const localLayout = state.context.profile.rules.notes.localNotePlacement ?? 'inline';
  if (getNoteKind(annotation) === 'author-note' && localLayout !== 'with-notes') {
    if (state.emittedLocalNotes.has(annotation.id)) return '';
    state.emittedLocalNotes.add(annotation.id);
    const body = state.noteHtmlBodies.get(annotation.id) ?? escapeHtml(annotation.body);
    const id = htmlId('note', annotation.id);
    if (localLayout === 'margin') {
      return `<span id="${id}" class="omi-local-note-margin" role="note" data-note-kind="local">${body}</span>`;
    }
    return `<span id="${id}" class="omi-local-note-inline" role="note" data-note-kind="local"> (${body})</span>`;
  }
  const label = state.noteLabels.get(annotation.id) ?? '?';
  const reference = `<sup class="note-ref"><a id="${htmlId('noteref', annotation.id)}" role="doc-noteref" href="#${htmlId(
    'note',
    annotation.id,
  )}">${escapeHtml(label)}</a></sup>`;
  if (!state.pagedNotes || getNoteKind(annotation) !== 'footnote') return reference;
  if (state.emittedFootnotes.has(annotation.id)) {
    return `<sup class="note-ref"><a role="doc-noteref" href="#${htmlId('note', annotation.id)}">${escapeHtml(label)}</a></sup>`;
  }
  state.emittedFootnotes.add(annotation.id);
  // Keep the float at its anchor, even when the enclosing paragraph is split.
  // Explicit labels preserve OMI numbering across chapters and repeated calls.
  // Encode line breaks so HTML source indentation cannot change note content.
  const body = (state.noteHtmlBodies.get(annotation.id) ?? escapeHtml(annotation.body))
    .replace(/\r\n?|\n/g, '&#10;');
  return `${reference}<span class="omi-page-footnote" id="${htmlId('note', annotation.id)}" role="doc-footnote"><sup class="omi-page-footnote-label">${escapeHtml(label)}</sup> ${body}</span>`;
}

const PAGED_NOTE_CSS = `
@page { @footnote { border-top: .5pt solid currentColor; padding-top: 2mm; } }
.omi-page-footnote {
  float: footnote;
  font-size: 9.5pt;
  line-height: 1.4;
  font-weight: normal;
  font-style: normal;
  text-indent: 0;
  text-align: left;
  white-space: pre-wrap;
  orphans: 2;
  widows: 2;
}
.omi-page-footnote::footnote-call, .omi-page-footnote::footnote-marker { content: none; }
.omi-page-footnote-label { font-size: .75em; line-height: 0; }
`.trim();

function collectNoteHtmlBodies(state: RenderState): Map<string, string> {
  const citationRules = state.context.profile.rules.citations;
  const previouslyCitedTargets = new Set<string>();
  const notes = sortNotesByDocumentOrder(state.manuscript);
  return new Map(notes.map((note) => {
    const noteBody = renderPublicationNoteBody(
      note,
      state.manuscript.bibliographicRecords ?? [],
      citationRules.noteFirstStyle ?? citationRules.style,
      state.context.locale,
      {
        subsequentStyle: citationRules.noteSubsequentStyle,
        previouslyCitedTargets: [...previouslyCitedTargets],
      },
    );
    for (const citation of note.noteCitations ?? []) previouslyCitedTargets.add(citation.target);
    return [note.id, noteBody.html];
  }));
}

function renderNotes(
  state: RenderState,
  labels: ReturnType<typeof localizedLabels>,
): string {
  const notes = sortNotesByDocumentOrder(state.manuscript).filter(
    (annotation) => annotation.type === 'note' && !state.emittedFootnotes.has(annotation.id) && !state.emittedLocalNotes.has(annotation.id),
  );
  if (!notes.length) return '';
  const placement = state.pagedNotes ? 'endnotes' : state.context.profile.rules.notes.placement;

  const noteItems = notes.map((note, index) => {
    const body = state.noteHtmlBodies.get(note.id) ?? escapeHtml(note.body);
    const unnumberedLocal = getNoteKind(note) === 'author-note' &&
      (state.context.profile.rules.notes.localNotePlacement ?? 'inline') !== 'with-notes';
    if (unnumberedLocal) {
      return `<li id="${htmlId('note', note.id)}" role="note" class="omi-local-note-unanchored">${body}</li>`;
    }
    return `<li id="${htmlId('note', note.id)}" role="doc-endnote" value="${escapeAttribute(
      state.noteLabels.get(note.id) ?? String(index + 1),
    )}">${body} <a class="note-backref" href="#${htmlId('noteref', note.id)}" aria-label="Back to note reference">↩</a></li>`;
  });

  return `<section class="article-notes" role="doc-endnotes" data-note-placement="${escapeAttribute(
    placement,
  )}" aria-labelledby="notes-heading"><h2 id="notes-heading">${escapeHtml(labels.notes)}</h2><ol>${noteItems.join('')}</ol></section>`;
}

function renderBibliographySection(
  state: RenderState,
  labels: ReturnType<typeof localizedLabels>,
): string {
  const bibliographyRecords = getBibliographyRecords(state.manuscript);
  if (!bibliographyRecords.length) return '';

  const entries = renderBibliography(
    bibliographyRecords,
    state.context.profile.rules.citations.bibliographyStyle ?? state.context.profile.rules.citations.style,
    state.context.locale,
  );
  const heading = state.context.profile.rules.citations.bibliographyHeading
    ? `<h2 id="references-heading">${escapeHtml(labels.references)}</h2>`
    : '<h2 id="references-heading" class="visually-hidden">References</h2>';

  return `<section class="article-bibliography" role="doc-bibliography" aria-labelledby="references-heading">${heading}<ol>${entries
    .map(
      (entry) =>
        `<li id="${htmlId('ref', entry.recordId)}" data-omi-record-id="${escapeAttribute(
          entry.recordId,
        )}">${escapeHtml(entry.text)}</li>`,
    )
    .join('')}</ol></section>`;
}

function renderTextWithTabs(value: string): string {
  return value
    .split('\t')
    .map((part) => escapeHtml(part))
    .join('<span class="omi-tab" aria-hidden="true">\t</span>');
}

function applyMarks(
  escapedText: string,
  marks: Array<{ type?: string; attrs?: Record<string, unknown> }>,
): string {
  if (marks.some(mark=>mark.type==='omiHiddenText' && mark.attrs?.value===true)) return '';
  return marks.reduce((output, mark) => {
    switch (mark.type) {
      case 'bold':
        return `<strong>${output}</strong>`;
      case 'italic':
        return `<em>${output}</em>`;
      case 'omiUnderline': {
        const css = underlineCss(mark.attrs?.variant);
        return css ? `<u style="${css}">${output}</u>` : `<u>${output}</u>`;
      }
      case 'omiSmallCaps':
        return `<span style="font-variant:small-caps">${output}</span>`;
      case 'strike':
        return `<del>${output}</del>`;
      case 'code':
        return `<code>${output}</code>`;
      case 'omiSuperscript':
        return `<sup>${output}</sup>`;
      case 'omiSubscript':
        return `<sub>${output}</sub>`;
      case 'omiSourceFont': {
        const family = (stringAttr(mark.attrs, 'family') ?? '').trim();
        return family && family.length <= 128
          ? `<span data-omi-source-font="${escapeAttribute(family)}" style="${escapeAttribute(authorFontStyle(family))}">${output}</span>`
          : output;
      }
      case 'omiLanguage': {
        const lang = stringAttr(mark.attrs, 'lang');
        return lang ? `<span lang="${escapeAttribute(normalizeLanguage(lang))}">${output}</span>` : output;
      }
      case 'omiLink': {
        const href = safeExternalHref(stringAttr(mark.attrs, 'href'));
        return href
          ? `<a href="${escapeAttribute(href)}" rel="external">${output}</a>`
          : output;
      }
      default: {
        const css = DIRECT_FORMAT_NAMES.includes(mark.type as DirectFormat) ? directFormattingCss(mark.type as DirectFormat, mark.attrs?.value) : '';
        return css ? `<span style="${css}">${output}</span>` : output;
      }
    }
  }, escapedText);
}

function renderProfileCss(profile: OmiPublicationProfile): string {
  const layout = profile.rules.layout;
  const family = layout.fontFamily === 'sans-serif'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    : 'Georgia, "Times New Roman", serif';
  const alignment = layout.textAlign === 'justified' ? 'justify' : 'left';
  return `:root { color-scheme: light; font-family: ${family}; font-size: ${layout.baseFontSizePt}pt; line-height: ${layout.lineHeight}; }
@page { size: ${layout.pageSize}; margin: ${layout.marginMm.top}mm ${layout.marginMm.right}mm ${layout.marginMm.bottom}mm ${layout.marginMm.left}mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: #111; }
a { color: inherit; text-decoration-thickness: .08em; text-underline-offset: .12em; }
.omi-scholarly-article { max-width: 76rem; margin: 0 auto; padding: 2.5rem 2rem 4rem; }
.article-front { text-align: center; border-bottom: 1px solid #bbb; padding-bottom: 2rem; margin-bottom: 2rem; }
.article-front h1 { font-size: 2.15em; line-height: 1.15; margin: 0 0 .55em; }
.funding-star-reference { font-size: 0.55em; margin-left: 0.15em; vertical-align: super; }
.article-funding-star-note { max-width: 58rem; margin: 0.9rem auto 1.25rem; text-align: left; font-size: 0.85em; line-height: 1.5; }
.funding-star-marker { margin-right: 0.4em; font-weight: bold; }
.article-subtitle { font-size: 1.28em; margin: -.2em 0 1.2em; }
.article-motto { max-width: 38rem; margin: 1.4rem auto; border: 0; padding: 0; }
.motto-left { text-align: left; } .motto-center { text-align: center; } .motto-right { text-align: right; }
.motto-italic { font-style: italic; }
.authors, .affiliations, .article-keywords ul { list-style: none; padding: 0; }
.authors { display: flex; flex-wrap: wrap; justify-content: center; gap: .55rem 1.5rem; }
.author-affiliation-inline, .author-orcid { display: block; font-size: .9em; }
.affiliations { font-size: .9em; }
.article-abstract, .article-keywords { text-align: left; max-width: 52rem; margin: 1.5rem auto 0; }
.article-abstract h2, .article-keywords h2 { font-size: 1em; margin-bottom: .35em; }
.article-keywords ul { display: flex; flex-wrap: wrap; gap: .35em .8em; margin: 0; }
.article-body { text-align: ${alignment}; }
.manuscript-section-body { text-align: ${alignment}; }
.omi-tab { white-space: pre; }
.scholarly-figure, .scholarly-table, .scholarly-chart, .scholarly-equation { break-inside: avoid; }
.scholarly-chart .omi-chart-svg { display: block; width: 100%; height: auto; max-width: 100%; max-height: 390px; margin: 0.5rem auto; }
.scholarly-chart .omi-chart-labels text { fill: currentColor; font-size: 11px; }
.scholarly-chart .scholarly-chart-source { margin-top: 0.6rem; font-size: 0.85em; }
.scholarly-chart .scholarly-chart-source summary { cursor: pointer; }
.scholarly-chart .chart-data { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
.scholarly-chart .chart-data caption { text-align: left; font-weight: 600; }
.scholarly-chart .chart-data th, .scholarly-chart .chart-data td { border: 1px solid #a6a6a6; padding: 0.3em 0.5em; text-align: left; }
@media print { .scholarly-chart .omi-chart-svg { max-height: none; } }

.manuscript-section > h2, .manuscript-section > h3, .manuscript-section > h4, .manuscript-section > h5, .manuscript-section > h6 { break-after: avoid; text-align: left; }
.section-number { margin-right: .45em; }
p { orphans: 3; widows: 3; }
figure { margin: 1.5rem 0; }
figcaption { font-size: .92em; margin: .45rem 0; }
img { display: block; max-width: 100%; height: auto; margin-inline: auto; }
table { width: 100%; border-collapse: collapse; margin: .75rem 0; }
th, td { border: 1px solid #999; padding: .35rem .5rem; vertical-align: top; }
th { text-align: left; }
${TABLE_LAYOUT_CSS}
math { overflow-x: auto; max-width: 100%; }
.omi-local-note-inline { font-style: normal; }
.omi-local-note-unanchored { list-style: none; margin-inline-start: -1.25em; }
.omi-local-note-margin { float: right; clear: right; box-sizing: border-box; width: min(12rem, 32%); margin: 0 0 0.65rem 0.8rem; padding: 0.3rem 0.45rem; border-inline-start: 1px solid #bbb; font-size: 0.84em; line-height: 1.4; }
@media print { .omi-local-note-margin { width: 5rem; margin-right: -5.3rem; font-size: 0.72em; } }
.article-notes, .article-bibliography { margin-top: 2.5rem; text-align: left; }
.article-bibliography li, .article-notes li { margin-bottom: .65em; }
.article-notes li, .omi-local-note-inline, .omi-local-note-margin { white-space: pre-wrap; }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 760px) { .omi-scholarly-article { padding: 1.25rem 1rem 2rem; } .article-body { column-count: 1; } }
@media print { .omi-scholarly-article { max-width: none; padding: 0; } a { text-decoration: none; } }`;
}

function parseStructuredContent(value: string): JsonNode | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed) as JsonNode;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function collectNoteLabels(manuscript: OmiManuscript, includeLocalNotes: boolean): Map<string, string> {
  return buildNoteLabelMap(manuscript,undefined,{includeLocalNotes});
}

function targetHtmlId(target: OmiCrossReferenceTarget, state: RenderState): string {
  switch (target.kind) {
    case 'section':
      return htmlId('sec', target.id);
    case 'figure':
      return htmlId('fig', target.id);
    case 'table':
      return htmlId('tbl', target.id);
    case 'chart':
      return htmlId('chart', target.id);
    case 'equation':
      return htmlId('eq', target.id);
    case 'bookmark':
      return bookmarkDestinationHtmlId(target, state);
  }
}

function bookmarkDestinationHtmlId(target: OmiCrossReferenceTarget, state: RenderState): string {
  const destinationId = target.destinationId ?? target.id;
  if (target.destinationKind === 'section') {
    return htmlId('sec', destinationId);
  }

  const block = state.manuscript.sections
    .flatMap((section) => section.blocks)
    .find((candidate) => candidate.id === destinationId);
  switch (block?.visual?.kind) {
    case 'image':
      return htmlId('fig', destinationId);
    case 'table':
      return htmlId('tbl', destinationId);
    case 'chart':
      return htmlId('chart', destinationId);
    case 'equation':
      return htmlId('eq', destinationId);
    default:
      return htmlId('block', destinationId);
  }
}

function htmlId(prefix: string, value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${normalized || 'object'}`;
}

function currentStateDigest(manuscript: OmiManuscript): string | undefined {
  const head = manuscript.revisionHistory.revisions.find(
    (revision) => revision.id === manuscript.headRevisionId,
  );
  return head ? getRevisionStateDigest(head)?.value : undefined;
}

function finiteDimension(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

function safeExternalHref(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRorHref(value: string): string {
  const normalized = value.trim();
  return /^https?:\/\/ror\.org\//i.test(normalized)
    ? normalized
    : `https://ror.org/${normalized.replace(/^ror:/i, '').replace(/^\/+/, '')}`;
}

function normalizeLanguage(value: string): string {
  const normalized = value.trim().replace(/_/g, '-');
  if (!normalized) return 'und';
  try {
    return Intl.getCanonicalLocales(normalized)[0] ?? 'und';
  } catch {
    return 'und';
  }
}

function localizedLabels(locale: string) {
  const language = locale.trim().toLowerCase().split('-')[0];
  if (language === 'hu') {
    return {
      abstract: 'Absztrakt',
      keywords: 'Kulcsszavak',
      notes: 'Jegyzetek',
      references: 'Hivatkozások',
      equation: 'Egyenlet',
      figure: 'Ábra',
      chartSourceData: 'A grafikon forrásadatai',
    };
  }
  if (language === 'de') {
    return {
      abstract: 'Zusammenfassung',
      keywords: 'Schlüsselwörter',
      notes: 'Anmerkungen',
      references: 'Literatur',
      equation: 'Gleichung',
      figure: 'Abbildung',
      chartSourceData: 'Diagrammdaten',
    };
  }
  return {
    abstract: 'Abstract',
    keywords: 'Keywords',
    notes: 'Notes',
    references: 'References',
    equation: 'Equation',
    figure: 'Figure',
    chartSourceData: 'Chart source data',
  };
}

function textContent(node: JsonNode): string {
  return [node.text ?? '', ...(node.content ?? []).map(textContent)].join('');
}

function stringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = attrs?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function arrayStringAttr(
  attrs: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = attrs?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function integerAttr(
  attrs: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = attrs?.[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function indent(value: string, depth: number): string {
  const prefix = '  '.repeat(depth);
  return value
    .split('\n')
    .map((line) => (line ? `${prefix}${line}` : line))
    .join('\n');
}

function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  const title = manuscript.title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return title || manuscript.id || 'manuscript';
}


/** Planned issue identity is not an actual publication date. */
function renderIssueCitationMeta(manuscript: OmiManuscript): string[] {
  const metadata = getIssueStudyCitationMetadata(manuscript);
  if (!metadata) return [];
  const pairs: [string, string | undefined][] = [
    ['citation_title', manuscript.title], ['citation_journal_title', metadata.journalTitle],
    ['citation_doi', metadata.articleDoi], ['citation_issn', metadata.printIssn],
    ['citation_issn', metadata.onlineIssn], ['citation_volume', metadata.volume],
    ['citation_issue', metadata.issue], ['citation_firstpage', metadata.firstPage],
    ['citation_lastpage', metadata.lastPage], ['omi-issue-doi', metadata.issueDoi],
    ['omi-planned-publication-year', metadata.year], ['omi-publication-status', metadata.status],
    ['omi-journal-print-issn', metadata.printIssn], ['omi-journal-online-issn', metadata.onlineIssn],
    ['omi-journal-section', metadata.sectionTitle],
  ];
  return pairs.flatMap(([name, value]) => value ? [`  <meta name="${name}" content="${escapeAttribute(value)}">`] : []);
}
