import {
  collectCrossReferenceTargets,
  formatCrossReferenceLabel,
  type OmiCrossReferenceTarget,
} from '../model/crossReferences';
import { renderBibliography, renderCitationCluster } from '../model/cslRendering';
import { latexToMathMl } from '../model/equationRendering';
import {
  buildPublicationRenderingContext,
  type OmiPublicationRenderingContext,
  type OmiRenderedSection,
} from '../model/publicationRendering';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type {
  OmiAnnotation,
  OmiBibliographicContributor,
  OmiBibliographicRecord,
  OmiBlock,
  OmiCitation,
  OmiCrossReference,
  OmiManuscript,
} from '../types/omi';

export const OMI_JATS_RENDERER_VERSION = '0.1.0-alpha.1' as const;
export const OMI_JATS_VERSION = '1.4' as const;
export const OMI_JATS_TAGSET = 'articleauthoring' as const;
export const OMI_JATS_DTD_URL =
  'https://jats.nlm.nih.gov/articleauthoring/1.4/JATS-articleauthoring1-4.dtd' as const;

export type JatsDiagnosticSeverity = 'error' | 'warning';

export interface JatsDiagnostic {
  code: string;
  severity: JatsDiagnosticSeverity;
  message: string;
  targetId?: string;
}

export interface JatsExportResult {
  xml: string;
  context: OmiPublicationRenderingContext;
  diagnostics: JatsDiagnostic[];
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
  diagnostics: JatsDiagnostic[];
  targetMap: Map<string, OmiCrossReferenceTarget>;
  crossReferenceMap: Map<string, OmiCrossReference>;
  citationMap: Map<string, OmiCitation>;
  recordMap: Map<string, OmiBibliographicRecord>;
  annotationMap: Map<string, OmiAnnotation>;
  noteLabels: Map<string, string>;
}

/**
 * Renders a semantic OMI manuscript as NISO JATS 1.4 Article Authoring XML.
 *
 * Article Authoring is used deliberately: Studio manuscripts are portable
 * authoring/submission objects and do not yet contain mandatory journal issue
 * metadata. Publisher-specific JATS can later extend this shared rendering
 * context without changing scholarly source data.
 */
export function renderJatsArticle(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): JatsExportResult {
  const context = buildPublicationRenderingContext(manuscript, profile);
  const diagnostics: JatsDiagnostic[] = context.publicationIssues.map((issue) => ({
    code: `publication-${issue.code}`,
    severity: issue.severity,
    message: issue.detail
      ? `${issue.code}: ${issue.detail}`
      : issue.code,
    targetId: issue.targetId,
  }));

  if (!profileSupportsOutput(profile, 'jats')) {
    diagnostics.push({
      code: 'profile-does-not-support-jats',
      severity: 'error',
      message: `Publication profile ${profile.id}@${profile.version} does not declare JATS output support.`,
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
    annotationMap: new Map(
      manuscript.annotations.map((annotation) => [annotation.id, annotation]),
    ),
    noteLabels: collectNoteLabels(manuscript),
  };

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!DOCTYPE article SYSTEM "${OMI_JATS_DTD_URL}">`,
    `<article article-type="research-article" dtd-version="${OMI_JATS_VERSION}" xml:lang="${escapeAttribute(normalizeLanguage(manuscript.locale))}" xmlns:mml="http://www.w3.org/1998/Math/MathML" xmlns:xlink="http://www.w3.org/1999/xlink">`,
    indent(renderProcessingMeta(state), 1),
    indent(renderFront(state), 1),
    context.sections.length ? indent(renderBody(context.sections, state), 1) : '  <body/>',
    renderBack(state) ? indent(renderBack(state), 1) : '',
    '</article>',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  diagnostics.push(...validateJatsStructure(xml));

  return {
    xml,
    context,
    diagnostics,
    validForExport: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

export function jatsFileName(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  const title = manuscript.title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${title || manuscript.id || 'manuscript'}.jats.xml`;
}

/** Lightweight XML/JATS integrity checks used in browser and CI. */
export function validateJatsStructure(xml: string): JatsDiagnostic[] {
  const diagnostics: JatsDiagnostic[] = [];

  for (const required of ['<article ', '<front>', '<article-meta>', '<title-group>', '<article-title>']) {
    if (!xml.includes(required)) {
      diagnostics.push({
        code: 'jats-required-structure-missing',
        severity: 'error',
        message: `Required JATS structure is missing: ${required}`,
      });
    }
  }

  if (!xml.includes('base-tagset="authoring"')) {
    diagnostics.push({
      code: 'jats-tagset-metadata-missing',
      severity: 'error',
      message: 'JATS processing metadata does not declare the Authoring tag set.',
    });
  }

  const ids = Array.from(xml.matchAll(/\sid="([^"]+)"/g), (match) => match[1] ?? '');
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      diagnostics.push({
        code: 'duplicate-xml-id',
        severity: 'error',
        message: `Duplicate XML id: ${id}`,
        targetId: id,
      });
    }
    seen.add(id);
  }

  for (const match of xml.matchAll(/<xref\b[^>]*\brid="([^"]+)"[^>]*>/g)) {
    const rid = match[1] ?? '';
    for (const target of rid.split(/\s+/).filter(Boolean)) {
      if (!seen.has(target)) {
        diagnostics.push({
          code: 'unresolved-jats-rid',
          severity: 'error',
          message: `JATS xref points to missing XML id: ${target}`,
          targetId: target,
        });
      }
    }
  }

  return diagnostics;
}

function renderProcessingMeta(state: RenderState): string {
  const { context } = state;
  const metadata = [
    ['omi-renderer', `open-manuscript-studio-jats@${OMI_JATS_RENDERER_VERSION}`],
    ['omi-rendering-context', context.model],
    ['omi-manuscript-id', context.manuscriptId],
    ['omi-manuscript-version', context.manuscriptVersion],
    ['omi-head-revision', context.headRevisionId],
    ['omi-publication-profile', `${context.profile.id}@${context.profile.version}`],
  ];

  return `<processing-meta tagset-family="jats" base-tagset="authoring" mathml-version="3.0" table-model="xhtml">\n${indent(
    `<custom-meta-group>\n${indent(
      metadata
        .map(
          ([name, value]) =>
            `<custom-meta><meta-name>${escapeXml(name ?? '')}</meta-name><meta-value>${escapeXml(value ?? '')}</meta-value></custom-meta>`,
        )
        .join('\n'),
      1,
    )}\n</custom-meta-group>`,
    1,
  )}\n</processing-meta>`;
}

function renderFront(state: RenderState): string {
  const { manuscript, context } = state;
  const titleGroup = [
    `<article-title>${escapeXml(context.title)}</article-title>`,
    context.subtitle ? `<subtitle>${escapeXml(context.subtitle)}</subtitle>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const contributors = renderContributors(state);
  const affiliations = renderAffiliations(context);
  const abstract = context.abstract
    ? `<abstract><p>${escapeXml(context.abstract)}</p></abstract>`
    : '';
  const keywords = context.keywords.length
    ? `<kwd-group kwd-group-type="author-generated">${context.keywords
        .map((keyword) => `<kwd>${escapeXml(keyword)}</kwd>`)
        .join('')}</kwd-group>`
    : '';
  const customMeta = renderArticleCustomMeta(state);

  const articleMeta = [
    `<article-id pub-id-type="publisher-id">${escapeXml(manuscript.id)}</article-id>`,
    `<title-group>\n${indent(titleGroup, 1)}\n</title-group>`,
    contributors,
    affiliations,
    abstract,
    keywords,
    customMeta,
  ]
    .filter(Boolean)
    .join('\n');

  return `<front>\n${indent(`<article-meta>\n${indent(articleMeta, 1)}\n</article-meta>`, 1)}\n</front>`;
}

function renderArticleCustomMeta(state: RenderState): string {
  const { context } = state;
  const items: Array<[string, string]> = [];

  if (context.motto) {
    items.push(['omi-motto', context.motto]);
    items.push(['omi-motto-position', context.frontMatterRules.motto.position]);
    items.push(['omi-motto-style', context.frontMatterRules.motto.style]);
    items.push(['omi-motto-alignment', context.frontMatterRules.motto.alignment]);
  }

  if (!items.length) return '';

  return `<custom-meta-group>\n${indent(
    items
      .map(
        ([name, value]) =>
          `<custom-meta><meta-name>${escapeXml(name)}</meta-name><meta-value>${escapeXml(value)}</meta-value></custom-meta>`,
      )
      .join('\n'),
    1,
  )}\n</custom-meta-group>`;
}

function renderContributors(state: RenderState): string {
  const { context } = state;
  if (!context.contributors.length) return '';

  return `<contrib-group content-type="authors">\n${indent(
    context.contributors
      .map((contributor) => {
        const name =
          contributor.familyName || contributor.givenName
            ? `<name name-style="western">${
                contributor.familyName
                  ? `<surname>${escapeXml(contributor.familyName)}</surname>`
                  : ''
              }${
                contributor.givenName
                  ? `<given-names>${escapeXml(contributor.givenName)}</given-names>`
                  : ''
              }</name>`
            : `<string-name>${escapeXml(contributor.displayName)}</string-name>`;
        const identifiers = contributor.orcid
          ? `<contrib-id contrib-id-type="orcid">${escapeXml(contributor.orcid)}</contrib-id>`
          : '';
        const affiliationRids = contributor.affiliations
          .map((affiliation) => xmlId('aff', affiliation.id))
          .join(' ');
        const affXref = affiliationRids
          ? `<xref ref-type="aff" rid="${escapeAttribute(affiliationRids)}"/>`
          : '';
        const roles = contributor.roles
          .filter((role) => role !== 'author')
          .map((role) => `<role>${escapeXml(role)}</role>`)
          .join('');
        const corresponding = contributor.corresponding
          ? '<role content-type="corresponding-author">corresponding author</role>'
          : '';

        return `<contrib contrib-type="author" id="${xmlId('contrib', contributor.contributionId)}">${name}${identifiers}${affXref}${roles}${corresponding}</contrib>`;
      })
      .join('\n'),
    1,
  )}\n</contrib-group>`;
}

function renderAffiliations(context: OmiPublicationRenderingContext): string {
  const seen = new Set<string>();
  const affiliations = context.contributors.flatMap((contributor) => contributor.affiliations);

  return affiliations
    .filter((affiliation) => {
      if (seen.has(affiliation.id)) return false;
      seen.add(affiliation.id);
      return true;
    })
    .map((affiliation) => {
      const institutionId = affiliation.organizationIdentifier
        ? `<institution-id institution-id-type="ror">${escapeXml(affiliation.organizationIdentifier)}</institution-id>`
        : '';
      const department = affiliation.department
        ? `<institution content-type="department">${escapeXml(affiliation.department)}</institution>`
        : '';
      const institution = `<institution>${escapeXml(affiliation.organizationName)}</institution>`;
      const position = affiliation.position
        ? `<named-content content-type="position">${escapeXml(affiliation.position)}</named-content>`
        : '';

      return `<aff id="${xmlId('aff', affiliation.id)}"><institution-wrap>${institutionId}${department}${institution}</institution-wrap>${position}</aff>`;
    })
    .join('\n');
}

function renderBody(
  sections: readonly OmiRenderedSection[],
  state: RenderState,
): string {
  return `<body>\n${indent(sections.map((section) => renderSection(section, state)).join('\n'), 1)}\n</body>`;
}

function renderSection(section: OmiRenderedSection, state: RenderState): string {
  const heading = [
    section.number ? `<label>${escapeXml(section.number)}</label>` : '',
    `<title>${escapeXml(section.title)}</title>`,
  ]
    .filter(Boolean)
    .join('\n');
  const blocks = section.blocks
    .map((block) => renderBlock(block, state))
    .filter(Boolean)
    .join('\n');
  const children = section.children
    .map((child) => renderSection(child, state))
    .join('\n');
  const content = [heading, blocks, children].filter(Boolean).join('\n');

  return `<sec id="${xmlId('sec', section.id)}">\n${indent(content, 1)}\n</sec>`;
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
    return `<p id="${xmlId('block', block.id)}">${escapeXml(block.content)}</p>`;
  }

  const nodes = root.type === 'doc' ? root.content ?? [] : [root];
  if (!nodes.length) return `<p id="${xmlId('block', block.id)}"/>`;

  return nodes
    .map((node, index) => renderBlockNode(node, state, block.id, index))
    .join('\n');
}

function renderBlockNode(
  node: JsonNode,
  state: RenderState,
  blockId: string,
  index: number,
): string {
  const id = index === 0 ? ` id="${xmlId('block', blockId)}"` : '';

  switch (node.type) {
    case 'paragraph':
      return `<p${id}>${renderInlineChildren(node.content ?? [], state)}</p>`;
    case 'blockquote':
      return `<disp-quote${id}>${(node.content ?? [])
        .map((child) => renderBlockNode(child, state, `${blockId}-quote`, 1))
        .join('')}</disp-quote>`;
    case 'bulletList':
      return `<list${id} list-type="bullet">${(node.content ?? [])
        .map((child) => renderListItem(child, state))
        .join('')}</list>`;
    case 'orderedList':
      return `<list${id} list-type="order">${(node.content ?? [])
        .map((child) => renderListItem(child, state))
        .join('')}</list>`;
    case 'codeBlock':
      return `<preformat${id} preformat-type="code">${escapeXml(textContent(node))}</preformat>`;
    case 'text':
      return `<p${id}>${renderInlineNode(node, state)}</p>`;
    default:
      state.diagnostics.push({
        code: 'unsupported-rich-text-block',
        severity: 'warning',
        message: `Unsupported rich-text block was flattened: ${node.type ?? 'unknown'}`,
        targetId: blockId,
      });
      return `<p${id}>${renderInlineChildren(node.content ?? [], state) || escapeXml(textContent(node))}</p>`;
  }
}

function renderListItem(node: JsonNode, state: RenderState): string {
  const children = node.content ?? [];
  const rendered = children
    .map((child) => {
      if (child.type === 'paragraph') {
        return `<p>${renderInlineChildren(child.content ?? [], state)}</p>`;
      }
      if (child.type === 'bulletList') {
        return `<list list-type="bullet">${(child.content ?? [])
          .map((item) => renderListItem(item, state))
          .join('')}</list>`;
      }
      if (child.type === 'orderedList') {
        return `<list list-type="order">${(child.content ?? [])
          .map((item) => renderListItem(item, state))
          .join('')}</list>`;
      }
      return `<p>${renderInlineChildren(child.content ?? [], state) || escapeXml(textContent(child))}</p>`;
    })
    .join('');
  return `<list-item>${rendered || '<p/>'}</list-item>`;
}

function renderInlineChildren(nodes: readonly JsonNode[], state: RenderState): string {
  return nodes.map((node) => renderInlineNode(node, state)).join('');
}

function renderInlineNode(node: JsonNode, state: RenderState): string {
  switch (node.type) {
    case 'text':
      return applyMarks(escapeXml(node.text ?? ''), node.marks ?? []);
    case 'hardBreak':
      return '\n';
    case 'omiCitation':
      return renderCitationMarker(node, state);
    case 'omiCrossReference':
      return renderCrossReferenceMarker(node, state);
    case 'omiNote':
      return renderNoteMarker(node, state);
    default:
      return renderInlineChildren(node.content ?? [], state);
  }
}

function applyMarks(
  input: string,
  marks: readonly { type?: string; attrs?: Record<string, unknown> }[],
): string {
  let output = input;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        output = `<bold>${output}</bold>`;
        break;
      case 'italic':
        output = `<italic>${output}</italic>`;
        break;
      case 'strike':
        output = `<strike>${output}</strike>`;
        break;
      case 'code':
        output = `<monospace>${output}</monospace>`;
        break;
      case 'omiSuperscript':
        output = `<sup>${output}</sup>`;
        break;
      case 'omiSubscript':
        output = `<sub>${output}</sub>`;
        break;
      case 'omiLanguage': {
        const lang = stringAttr(mark.attrs, 'lang');
        if (lang) output = `<named-content xml:lang="${escapeAttribute(lang)}">${output}</named-content>`;
        break;
      }
      case 'omiLink': {
        const href = stringAttr(mark.attrs, 'href');
        if (href && /^(https?:|mailto:)/i.test(href)) {
          output = `<ext-link ext-link-type="uri" xlink:href="${escapeAttribute(href)}">${output}</ext-link>`;
        }
        break;
      }
    }
  }

  return output;
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
      code: 'unresolved-citation-marker',
      severity: 'error',
      message: 'Inline citation marker does not resolve to a semantic citation occurrence.',
      targetId: fallbackId,
    });
    return '<named-content content-type="unresolved-citation">[unresolved citation]</named-content>';
  }

  const recordIds = citations
    .map((citation) => citation.target)
    .filter((id) => state.recordMap.has(id));
  if (!recordIds.length) {
    state.diagnostics.push({
      code: 'unresolved-citation-target',
      severity: 'error',
      message: 'Citation occurrence does not resolve to a bibliographic record.',
      targetId: citations[0]?.id,
    });
    return '<named-content content-type="unresolved-citation">[unresolved citation]</named-content>';
  }

  const label = renderCitationCluster(
    citations,
    Array.from(state.recordMap.values()),
    state.context.profile.rules.citations.style,
    state.context.locale,
  );
  const rid = recordIds.map((id) => xmlId('ref', id)).join(' ');
  return `<xref ref-type="bibr" rid="${escapeAttribute(rid)}">${escapeXml(label)}</xref>`;
}

function renderCrossReferenceMarker(node: JsonNode, state: RenderState): string {
  const crossReferenceId = stringAttr(node.attrs, 'crossReferenceId');
  const reference = crossReferenceId
    ? state.crossReferenceMap.get(crossReferenceId)
    : undefined;

  if (!reference) {
    state.diagnostics.push({
      code: 'unresolved-cross-reference-marker',
      severity: 'error',
      message: 'Inline cross-reference marker does not resolve to a semantic cross-reference.',
      targetId: crossReferenceId,
    });
    return '<named-content content-type="unresolved-cross-reference">[unresolved reference]</named-content>';
  }

  const target = state.targetMap.get(reference.targetId);
  if (!target) {
    state.diagnostics.push({
      code: 'unresolved-cross-reference-target',
      severity: 'error',
      message: 'Cross-reference target is missing from the manuscript.',
      targetId: reference.targetId,
    });
    return '<named-content content-type="unresolved-cross-reference">[unresolved reference]</named-content>';
  }

  const label = formatCrossReferenceLabel(reference, target, state.context.locale);
  return `<xref ref-type="${xrefType(target.kind)}" rid="${xmlIdForTarget(target)}">${escapeXml(label)}</xref>`;
}

function renderNoteMarker(node: JsonNode, state: RenderState): string {
  const noteId = stringAttr(node.attrs, 'noteId');
  const annotation = noteId ? state.annotationMap.get(noteId) : undefined;
  if (!annotation) {
    state.diagnostics.push({
      code: 'unresolved-note-marker',
      severity: 'warning',
      message: 'Inline note marker does not resolve to an annotation.',
      targetId: noteId,
    });
    return '<named-content content-type="unresolved-note">[note]</named-content>';
  }

  const label = stringAttr(node.attrs, 'label') || state.noteLabels.get(annotation.id) || '';
  return `<xref ref-type="fn" rid="${xmlId('fn', annotation.id)}">${escapeXml(label)}</xref>`;
}

function renderImage(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'image') return '';
  const target = state.targetMap.get(block.id);
  const label = target ? objectLabel(target, state) : '';
  const caption = block.visual.caption?.trim();
  const graphic = `<graphic xlink:href="${escapeAttribute(block.visual.src)}" mimetype="image"${mimeSubtypeAttribute(block.visual.mediaType)}>${
    block.visual.alt.trim()
      ? `<alt-text>${escapeXml(block.visual.alt.trim())}</alt-text>`
      : ''
  }</graphic>`;

  if (block.visual.src.startsWith('data:')) {
    state.diagnostics.push({
      code: 'embedded-image-data-uri',
      severity: 'warning',
      message: 'Image is preserved as a data URI; a future JATS package exporter should externalize binary assets.',
      targetId: block.id,
    });
  }

  return `<fig id="${xmlId('fig', block.id)}">${
    label ? `<label>${escapeXml(label)}</label>` : ''
  }${caption ? `<caption><p>${escapeXml(caption)}</p></caption>` : ''}${graphic}</fig>`;
}

function renderChart(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'chart') return '';
  const target = state.targetMap.get(block.id);
  const label = target ? objectLabel(target, state) : '';
  const caption = block.visual.caption?.trim() || block.visual.title?.trim();
  const chartPayload = JSON.stringify({
    chartType: block.visual.chartType,
    cells: block.visual.cells,
  });
  const dataUri = `data:application/vnd.omi.chart+json,${encodeURIComponent(chartPayload)}`;

  state.diagnostics.push({
    code: 'chart-semantic-media',
    severity: 'warning',
    message: 'Chart source data is preserved as OMI JSON media; a publication renderer still needs to generate the final chart graphic.',
    targetId: block.id,
  });

  return `<fig id="${xmlId('fig', block.id)}" fig-type="chart">${
    label ? `<label>${escapeXml(label)}</label>` : ''
  }${caption ? `<caption><p>${escapeXml(caption)}</p></caption>` : ''}<media mimetype="application" mime-subtype="vnd.omi.chart+json" xlink:href="${escapeAttribute(dataUri)}"/></fig>`;
}

function renderTable(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'table') return '';
  const target = state.targetMap.get(block.id);
  const label = target ? objectLabel(target, state) : '';
  const caption = block.visual.caption?.trim();
  const headerRows = Math.max(0, block.visual.headerRows ?? 0);
  const head = block.visual.cells.slice(0, headerRows);
  const body = block.visual.cells.slice(headerRows);
  const renderRow = (row: string[], cellTag: 'th' | 'td') =>
    `<tr>${row.map((cell) => `<${cellTag}>${escapeXml(cell)}</${cellTag}>`).join('')}</tr>`;
  const table = `<table>${
    head.length ? `<thead>${head.map((row) => renderRow(row, 'th')).join('')}</thead>` : ''
  }${body.length ? `<tbody>${body.map((row) => renderRow(row, 'td')).join('')}</tbody>` : ''}</table>`;

  return `<table-wrap id="${xmlId('tbl', block.id)}">${
    label ? `<label>${escapeXml(label)}</label>` : ''
  }${caption ? `<caption><p>${escapeXml(caption)}</p></caption>` : ''}${table}</table-wrap>`;
}

function renderEquation(block: OmiBlock, state: RenderState): string {
  if (block.visual?.kind !== 'equation') return '';
  const target = state.targetMap.get(block.id);
  const label = target ? objectLabel(target, state) : '';
  const latex = block.visual.latex?.trim() ||
    (block.visual.notation === 'latex' ? block.visual.source.trim() : '');
  let math = '';

  if (latex) {
    math = prefixMathMl(latexToMathMl(latex));
  } else if (block.visual.notation === 'mathml') {
    math = normalizeStoredMathMl(block.visual.source, state, block.id);
  } else {
    state.diagnostics.push({
      code: 'equation-representation-fallback',
      severity: 'warning',
      message: 'Equation has no LaTeX/MathML representation; original source is preserved as plain formula text.',
      targetId: block.id,
    });
    math = `<mml:math display="block"><mml:mtext>${escapeXml(stripTags(block.visual.source))}</mml:mtext></mml:math>`;
  }

  return `<disp-formula id="${xmlId('eq', block.id)}">${
    label ? `<label>${escapeXml(label)}</label>` : ''
  }${math}</disp-formula>`;
}

function renderBack(state: RenderState): string {
  const references = renderReferenceList(state);
  const notes = renderFootnoteGroup(state);
  if (!references && !notes) return '';
  return `<back>\n${indent([notes, references].filter(Boolean).join('\n'), 1)}\n</back>`;
}

function renderFootnoteGroup(state: RenderState): string {
  if (!state.manuscript.annotations.length) return '';

  return `<fn-group>\n${indent(
    state.manuscript.annotations
      .map((annotation, index) => {
        const label = state.noteLabels.get(annotation.id) || String(index + 1);
        const fnType = annotation.noteKind === 'author-note' ? 'author' : 'other';
        return `<fn id="${xmlId('fn', annotation.id)}" fn-type="${fnType}"><label>${escapeXml(label)}</label><p>${escapeXml(annotation.body)}</p></fn>`;
      })
      .join('\n'),
    1,
  )}\n</fn-group>`;
}

function renderReferenceList(state: RenderState): string {
  const citedRecordIds = new Set(
    state.manuscript.citations.map((citation) => citation.target),
  );
  const citedRecords = (state.manuscript.bibliographicRecords ?? []).filter((record) =>
    citedRecordIds.has(record.id),
  );
  if (!citedRecords.length) return '';

  const order = renderBibliography(
    citedRecords,
    state.context.profile.rules.citations.style,
    state.context.locale,
  ).map((entry) => entry.recordId);
  const recordMap = new Map(citedRecords.map((record) => [record.id, record]));
  const references = order
    .map((recordId, index) => {
      const record = recordMap.get(recordId);
      return record ? renderReference(record, index + 1) : '';
    })
    .filter(Boolean)
    .join('\n');

  return `<ref-list>\n${indent(`<title>References</title>\n${references}`, 1)}\n</ref-list>`;
}

function renderReference(record: OmiBibliographicRecord, number: number): string {
  const publicationType = jatsPublicationType(record.type);
  const contributors = renderReferenceContributors(record.contributors);
  const title = [record.title, record.subtitle].filter(Boolean).join(': ');
  const titleMarkup =
    record.type === 'journal-article' ||
    record.type === 'book-chapter' ||
    record.type === 'conference-paper'
      ? `<article-title>${escapeXml(title)}</article-title>`
      : `<source>${escapeXml(title)}</source>`;
  const source =
    record.containerTitle && titleMarkup.startsWith('<article-title>')
      ? `<source>${escapeXml(record.containerTitle)}</source>`
      : '';
  const year = record.issued?.match(/\b(\d{4})\b/)?.[1];
  const yearMarkup = year ? `<year>${year}</year>` : '';
  const publisher = record.publisher
    ? `<publisher-name>${escapeXml(record.publisher)}</publisher-name>`
    : '';
  const place = record.place
    ? `<publisher-loc>${escapeXml(record.place)}</publisher-loc>`
    : '';
  const volume = record.volume ? `<volume>${escapeXml(record.volume)}</volume>` : '';
  const issue = record.issue ? `<issue>${escapeXml(record.issue)}</issue>` : '';
  const pages = renderPages(record.pages);
  const identifiers = record.identifiers
    .map((identifier) => {
      const scheme = identifier.scheme.trim().toLowerCase();
      if (!identifier.value.trim()) return '';
      return `<pub-id pub-id-type="${escapeAttribute(scheme)}">${escapeXml(identifier.value.trim())}</pub-id>`;
    })
    .join('');
  const url = record.url?.trim()
    ? `<ext-link ext-link-type="uri" xlink:href="${escapeAttribute(record.url.trim())}">${escapeXml(record.url.trim())}</ext-link>`
    : '';
  const citation = [
    contributors,
    titleMarkup,
    source,
    yearMarkup,
    volume,
    issue,
    pages,
    place,
    publisher,
    identifiers,
    url,
  ]
    .filter(Boolean)
    .join('');

  return `<ref id="${xmlId('ref', record.id)}"><label>${number}</label><element-citation publication-type="${escapeAttribute(publicationType)}">${citation}</element-citation></ref>`;
}

function renderReferenceContributors(
  contributors: readonly OmiBibliographicContributor[],
): string {
  const authors = contributors.filter((contributor) => contributor.role === 'author');
  if (!authors.length) return '';

  return `<person-group person-group-type="author">${authors
    .map((author) => {
      if (author.literalName?.trim()) {
        return `<string-name>${escapeXml(author.literalName.trim())}</string-name>`;
      }
      return `<name>${
        author.familyName?.trim()
          ? `<surname>${escapeXml(author.familyName.trim())}</surname>`
          : ''
      }${
        author.givenName?.trim()
          ? `<given-names>${escapeXml(author.givenName.trim())}</given-names>`
          : ''
      }</name>`;
    })
    .join('')}</person-group>`;
}

function renderPages(pages: string | undefined): string {
  const value = pages?.trim();
  if (!value) return '';
  const parts = value.split(/\s*[-–—]\s*/);
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `<fpage>${escapeXml(parts[0])}</fpage><lpage>${escapeXml(parts[1])}</lpage>`;
  }
  return `<page-range>${escapeXml(value)}</page-range>`;
}

function objectLabel(target: OmiCrossReferenceTarget, state: RenderState): string {
  return formatCrossReferenceLabel(
    { targetId: target.id, displayStyle: 'label-number' },
    target,
    state.context.locale,
  );
}

function xrefType(kind: OmiCrossReferenceTarget['kind']): string {
  if (kind === 'section') return 'sec';
  if (kind === 'table') return 'table';
  if (kind === 'equation') return 'disp-formula';
  return 'fig';
}

function xmlIdForTarget(target: OmiCrossReferenceTarget): string {
  if (target.kind === 'section') return xmlId('sec', target.id);
  if (target.kind === 'table') return xmlId('tbl', target.id);
  if (target.kind === 'equation') return xmlId('eq', target.id);
  return xmlId('fig', target.id);
}

function collectNoteLabels(manuscript: OmiManuscript): Map<string, string> {
  const labels = new Map<string, string>();

  for (const block of manuscript.sections.flatMap((section) => section.blocks)) {
    const root = parseStructuredContent(block.content);
    if (!root) continue;
    walkJson(root, (node) => {
      if (node.type !== 'omiNote') return;
      const noteId = stringAttr(node.attrs, 'noteId');
      const label = stringAttr(node.attrs, 'label');
      if (noteId && label && !labels.has(noteId)) labels.set(noteId, label);
    });
  }

  return labels;
}

function parseStructuredContent(content: string): JsonNode | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? (parsed as JsonNode) : undefined;
  } catch {
    return undefined;
  }
}

function walkJson(node: JsonNode, visitor: (node: JsonNode) => void): void {
  visitor(node);
  for (const child of node.content ?? []) walkJson(child, visitor);
}

function textContent(node: JsonNode): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(textContent).join('');
}

function normalizeStoredMathMl(
  source: string,
  state: RenderState,
  blockId: string,
): string {
  const trimmed = source.trim().replace(/^<\?xml[^>]*>\s*/i, '');
  if (
    !/^<(?:mml:)?math\b/i.test(trimmed) ||
    /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|\son\w+\s*=|\b(?:href|src)\s*=/i.test(trimmed)
  ) {
    state.diagnostics.push({
      code: 'unsafe-or-unsupported-mathml',
      severity: 'warning',
      message: 'Stored MathML could not be emitted directly and was reduced to text.',
      targetId: blockId,
    });
    return `<mml:math display="block"><mml:mtext>${escapeXml(stripTags(source))}</mml:mtext></mml:math>`;
  }
  return prefixMathMl(trimmed);
}

function prefixMathMl(source: string): string {
  const withoutDefaultNamespace = source.replace(
    /\sxmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"/g,
    '',
  );
  return withoutDefaultNamespace.replace(
    /<(\/?)((?:math|mrow|mi|mn|mo|mtext|mspace|mfrac|msqrt|mroot|msup|msub|msubsup|munder|mover|munderover|mmultiscripts|mprescripts|none|mtable|mtr|mtd|mfenced|menclose|mstyle|semantics|annotation))\b/g,
    '<$1mml:$2',
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mimeSubtypeAttribute(mediaType: string): string {
  const subtype = mediaType.split('/')[1]?.split(';')[0]?.trim();
  return subtype ? ` mime-subtype="${escapeAttribute(subtype)}"` : '';
}

function jatsPublicationType(type: string): string {
  switch (type) {
    case 'journal-article':
      return 'journal';
    case 'book':
    case 'book-chapter':
      return 'book';
    case 'conference-paper':
      return 'confproc';
    case 'thesis':
    case 'dissertation':
      return 'thesis';
    case 'report':
      return 'report';
    case 'dataset':
      return 'data';
    case 'software':
      return 'software';
    case 'web-page':
      return 'web';
    default:
      return 'other';
  }
}

function normalizeLanguage(locale: string): string {
  const trimmed = locale.trim();
  return trimmed || 'en';
}

function xmlId(prefix: string, value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${normalized || 'object'}`;
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
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttribute(value: string): string {
  return escapeXml(value).replace(/[\r\n\t]+/g, ' ');
}

function indent(value: string, level: number): string {
  const padding = '  '.repeat(level);
  return value
    .split('\n')
    .map((line) => (line ? `${padding}${line}` : line))
    .join('\n');
}
