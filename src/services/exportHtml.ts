import {
  collectCrossReferenceTargets,
  formatCrossReferenceLabel,
  type OmiCrossReferenceTarget,
} from '../model/crossReferences.ts';
import { renderBibliography, renderCitationCluster } from '../model/cslRendering.ts';
import { latexToMathMl } from '../model/equationRendering.ts';
import { assetPath } from '../model/assets.ts';
import {
  buildPublicationRenderingContext,
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

export const OMI_HTML_RENDERER_VERSION = '0.1.0-alpha.1' as const;
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
  const context = buildPublicationRenderingContext(manuscript, profile);
  const diagnostics: HtmlDiagnostic[] = context.publicationIssues.map((issue) => ({
    code: `publication-${issue.code}`,
    severity: issue.severity,
    message: issue.detail ? `${issue.code}: ${issue.detail}` : issue.code,
    targetId: issue.targetId,
  }));

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
    noteLabels: collectNoteLabels(manuscript),
    assetMap: new Map((manuscript.assets ?? []).map((asset) => [asset.id, asset])),
    assetPrefix: options.assetPrefix ?? '',
  };

  const labels = localizedLabels(context.locale);
  const stateDigest = currentStateDigest(manuscript);
  const title = context.subtitle
    ? `${context.title}: ${context.subtitle}`
    : context.title;
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
    `  <title>${escapeHtml(title)}</title>`,
    '  <style>',
    indent(renderProfileCss(profile), 2),
    '  </style>',
    '</head>',
    '<body>',
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
      `<h1 id="article-title">${escapeHtml(context.title)}</h1>`,
      subtitle,
      motto,
      contributors,
      abstract,
      keywords,
    ]
      .filter(Boolean)
      .join('\n'),
    1,
  )}\n</header>`;
}

function renderContributors(state: RenderState): string {
  const { context } = state;
  if (!context.contributors.length) return '';
  const rules = context.profile.rules.contributors;
  const affiliationMap = new Map(
    context.contributors
      .flatMap((contributor) => contributor.affiliations)
      .map((affiliation) => [affiliation.id, affiliation]),
  );

  const authors = context.contributors
    .map((contributor) => {
      const affiliationMarkers =
        rules.showAffiliations && rules.affiliationMode === 'markers'
          ? contributor.affiliations
              .map((affiliation) => {
                const ordinal = Array.from(affiliationMap.keys()).indexOf(affiliation.id) + 1;
                return `<a class="affiliation-marker" href="#${htmlId('aff', affiliation.id)}" aria-label="Affiliation ${ordinal}">${ordinal}</a>`;
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

      return `<li id="${htmlId('contrib', contributor.contributionId)}"><span class="author-name">${escapeHtml(
        contributor.displayName,
      )}</span>${corresponding}${affiliationMarkers ? `<sup>${affiliationMarkers}</sup>` : ''}${
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
            return `<li id="${htmlId('aff', affiliation.id)}">${escapeHtml(details)}${
              ror ? ` <span class="affiliation-ror">${ror}</span>` : ''
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
    .map((block) => renderBlock(block, state))
    .filter(Boolean)
    .join('\n');
  const children = section.children.map((child) => renderSection(child, state)).join('\n');
  const content = [
    `<h${headingLevel}${ariaLevel}>${number}<span class="section-title">${escapeHtml(
      section.title,
    )}</span></h${headingLevel}>`,
    blocks,
    children,
  ]
    .filter(Boolean)
    .join('\n');

  return `<section id="${htmlId('sec', section.id)}" class="manuscript-section" data-omi-section-id="${escapeAttribute(
    section.id,
  )}">\n${indent(content, 1)}\n</section>`;
}

function renderBlock(block: OmiBlock, state: RenderState): string {
  if (block.visual) {
    switch (block.visual.kind) {
      case 'image':
        return renderImage(block, state);
      case 'table':
        return renderTable(block, state);
      case 'chart':
        return renderChart(block, state);
      case 'equation':
        return renderEquation(block, state);
    }
  }

  const root = parseStructuredContent(block.content);
  if (!root) {
    const fallback = block.content.trim();
    return fallback
      ? `<p id="${htmlId('block', block.id)}">${escapeHtml(fallback)}</p>`
      : '';
  }

  const rendered = renderJsonNode(root, state);
  return rendered
    ? `<div id="${htmlId('block', block.id)}" class="text-block" data-omi-block-id="${escapeAttribute(
        block.id,
      )}">${rendered}</div>`
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
  const image = `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(visual.alt)}"${
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

function renderTable(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'table') return '';
  const visual = block.visual;
  const headerRows = Math.max(0, Math.min(visual.headerRows ?? 0, visual.cells.length));
  const header = headerRows
    ? `<thead>${visual.cells
        .slice(0, headerRows)
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join('')}</tr>`,
        )
        .join('')}</thead>`
    : '';
  const bodyRows = visual.cells.slice(headerRows);
  const body = `<tbody>${bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  const table = `<table>${header}${body}</table>`;
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
  state.diagnostics.push({
    code: 'html-chart-data-table-fallback',
    severity: 'warning',
    message: `Chart ${block.id} is rendered as its accessible source-data table in the current HTML alpha renderer.`,
    targetId: block.id,
  });
  const captionText = visual.caption?.trim() || visual.title?.trim();
  const caption = captionText ? `<figcaption>${escapeHtml(captionText)}</figcaption>` : '';
  const rows = visual.cells
    .map((row, rowIndex) => {
      const cells = row.map((cell, columnIndex) => {
        const tag = rowIndex === 0 || columnIndex === 0 ? 'th' : 'td';
        const scope = rowIndex === 0 ? ' scope="col"' : columnIndex === 0 ? ' scope="row"' : '';
        return `<${tag}${scope}>${escapeHtml(cell)}</${tag}>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  return `<figure id="${htmlId('chart', block.id)}" class="scholarly-chart" data-chart-type="${escapeAttribute(
    visual.chartType,
  )}">${caption}<table class="chart-data"><tbody>${rows}</tbody></table></figure>`;
}

function renderEquation(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'equation') return '';
  const visual = block.visual;
  const latex = visual.latex?.trim() || (visual.notation === 'latex' ? visual.source.trim() : '');
  let equation: string;

  if (latex) {
    equation = latexToMathMl(latex);
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

function renderJsonNode(node: JsonNode, state: RenderState): string {
  const children = () => (node.content ?? []).map((child) => renderJsonNode(child, state)).join('');

  switch (node.type) {
    case 'doc':
      return children();
    case 'paragraph':
      return `<p>${children()}</p>`;
    case 'blockquote':
      return `<blockquote>${children()}</blockquote>`;
    case 'bulletList':
      return `<ul>${children()}</ul>`;
    case 'orderedList': {
      const start = integerAttr(node.attrs, 'start');
      return `<ol${start && start !== 1 ? ` start="${start}"` : ''}>${children()}</ol>`;
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
    case 'text':
      return applyMarks(escapeHtml(node.text ?? ''), node.marks ?? []);
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

  return `<a class="xref" href="#${targetHtmlId(target)}">${escapeHtml(label)}</a>`;
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
  const label = state.noteLabels.get(annotation.id) ?? '?';
  return `<sup class="note-ref"><a id="${htmlId('noteref', annotation.id)}" role="doc-noteref" href="#${htmlId(
    'note',
    annotation.id,
  )}">${escapeHtml(label)}</a></sup>`;
}

function renderNotes(
  state: RenderState,
  labels: ReturnType<typeof localizedLabels>,
): string {
  const notes = state.manuscript.annotations.filter(
    (annotation) => annotation.type === 'note',
  );
  if (!notes.length) return '';
  const placement = state.context.profile.rules.notes.placement;

  return `<section class="article-notes" role="doc-endnotes" data-note-placement="${escapeAttribute(
    placement,
  )}" aria-labelledby="notes-heading"><h2 id="notes-heading">${escapeHtml(labels.notes)}</h2><ol>${notes
    .map(
      (note) =>
        `<li id="${htmlId('note', note.id)}" role="doc-endnote">${escapeHtml(
          note.body,
        )} <a class="note-backref" href="#${htmlId('noteref', note.id)}" aria-label="Back to note reference">↩</a></li>`,
    )
    .join('')}</ol></section>`;
}

function renderBibliographySection(
  state: RenderState,
  labels: ReturnType<typeof localizedLabels>,
): string {
  const citedIds = new Set(state.manuscript.citations.map((citation) => citation.target));
  const citedRecords = (state.manuscript.bibliographicRecords ?? []).filter((record) =>
    citedIds.has(record.id),
  );
  if (!citedRecords.length) return '';

  const entries = renderBibliography(
    citedRecords,
    state.context.profile.rules.citations.style,
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

function applyMarks(
  escapedText: string,
  marks: Array<{ type?: string; attrs?: Record<string, unknown> }>,
): string {
  return marks.reduce((output, mark) => {
    switch (mark.type) {
      case 'bold':
        return `<strong>${output}</strong>`;
      case 'italic':
        return `<em>${output}</em>`;
      case 'strike':
        return `<del>${output}</del>`;
      case 'code':
        return `<code>${output}</code>`;
      case 'omiSuperscript':
        return `<sup>${output}</sup>`;
      case 'omiSubscript':
        return `<sub>${output}</sub>`;
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
      default:
        return output;
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
.article-body { column-count: ${layout.columns}; column-gap: 2.2rem; text-align: ${alignment}; }
.manuscript-section, .scholarly-figure, .scholarly-table, .scholarly-chart, .scholarly-equation { break-inside: avoid; }
.manuscript-section > h2, .manuscript-section > h3, .manuscript-section > h4, .manuscript-section > h5, .manuscript-section > h6 { break-after: avoid; text-align: left; }
.section-number { margin-right: .45em; }
p { orphans: 3; widows: 3; }
figure { margin: 1.5rem 0; }
figcaption { font-size: .92em; margin: .45rem 0; }
img { display: block; max-width: 100%; height: auto; margin-inline: auto; }
table { width: 100%; border-collapse: collapse; margin: .75rem 0; }
th, td { border: 1px solid #999; padding: .35rem .5rem; vertical-align: top; }
th { text-align: left; }
math { overflow-x: auto; max-width: 100%; }
.article-notes, .article-bibliography { margin-top: 2.5rem; text-align: left; }
.article-bibliography li, .article-notes li { margin-bottom: .65em; }
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

function collectNoteLabels(manuscript: OmiManuscript): Map<string, string> {
  const labels = new Map<string, string>();
  let ordinal = 0;
  for (const annotation of manuscript.annotations) {
    if (annotation.type !== 'note') continue;
    ordinal += 1;
    labels.set(annotation.id, String(ordinal));
  }
  return labels;
}

function targetHtmlId(target: OmiCrossReferenceTarget): string {
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
    };
  }
  if (language === 'de') {
    return {
      abstract: 'Zusammenfassung',
      keywords: 'Schlüsselwörter',
      notes: 'Anmerkungen',
      references: 'Literatur',
      equation: 'Gleichung',
    };
  }
  return {
    abstract: 'Abstract',
    keywords: 'Keywords',
    notes: 'Notes',
    references: 'References',
    equation: 'Equation',
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
