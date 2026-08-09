import {
  extractOmiInlineRuns,
  type OmiInlineRun,
  type OmiInlineSemanticKind,
} from '../model/inlineSemantics';
import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { createStoreZip, textZipEntry } from './simpleZip';

export interface DocxExportResult {
  blob: Blob;
  bytes: Uint8Array;
  fileName: string;
  warnings: string[];
}

/**
 * Produces a portable WordprocessingML DOCX from the shared publication view.
 * Headings use real Word Heading styles and inline OMI semantics use named
 * Word character styles instead of direct font formatting.
 */
export function buildDocxExport(manuscript: OmiManuscript): DocxExportResult {
  const profile = resolvePublicationProfile(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const warnings: string[] = [];
  const body: string[] = [];

  body.push(paragraph(context.title, 'Title'));
  if (context.subtitle) body.push(paragraph(context.subtitle, 'Subtitle'));
  if (context.contributors.length) {
    body.push(paragraph(context.contributors.map((item) => item.displayName).join(', '), 'Author'));
  }
  if (context.abstract) {
    body.push(paragraph(localizedLabel(context.locale, 'abstract'), 'Heading1'));
    body.push(paragraph(context.abstract));
  }
  if (context.keywords.length) {
    body.push(paragraph(`${localizedLabel(context.locale, 'keywords')}: ${context.keywords.join('; ')}`));
  }

  const renderSections = (sections: typeof context.sections) => {
    for (const section of sections) {
      const level = Math.min(6, section.depth + 1);
      const heading = section.number ? `${section.number} ${section.title}` : section.title;
      body.push(paragraph(heading, `Heading${level}`));
      for (const block of section.blocks) {
        if (block.visual) {
          const text = blockPlainText(block);
          if (text) body.push(paragraph(text));
          warnings.push(`Structured ${block.visual.kind} object ${block.id} was exported as descriptive text in DOCX.`);
          continue;
        }
        const runs = extractOmiInlineRuns(block.content);
        if (runs.length) body.push(richParagraph(runs));
        else {
          const text = blockPlainText(block);
          if (text) body.push(paragraph(text));
        }
      }
      renderSections(section.children);
    }
  };
  renderSections(context.sections);

  if (manuscript.annotations.length) {
    body.push(paragraph(localizedLabel(context.locale, 'notes'), 'Heading1'));
    manuscript.annotations.forEach((note, index) => {
      body.push(paragraph(`${index + 1}. ${note.body}`));
    });
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
${style('Title', 'Title', 32, true)}${style('Subtitle', 'Subtitle', 24, false)}${style('Author', 'Author', 22, false)}
${[1,2,3,4,5,6].map((level) => headingStyle(level)).join('')}
${characterStylesXml()}
</w:styles>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(context.title)}</dc:title><dc:language>${xml(context.locale)}</dc:language><cp:lastModifiedBy>Open Manuscript Studio</cp:lastModifiedBy><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`;

  const entries = [
    textZipEntry('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    textZipEntry('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    textZipEntry('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    textZipEntry('word/document.xml', documentXml),
    textZipEntry('word/styles.xml', stylesXml),
    textZipEntry('docProps/core.xml', core),
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return {
    bytes,
    blob: new Blob([copy.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    fileName: `${fileStem(manuscript)}.docx`,
    warnings,
  };
}

function paragraph(value: string, styleId?: string): string {
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${xml(styleId)}"/></w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
}

function richParagraph(runs: readonly OmiInlineRun[]): string {
  const rendered = runs.map(wordRun).join('');
  return `<w:p>${rendered}</w:p>`;
}

function wordRun(run: OmiInlineRun): string {
  if (run.text === '\n') return '<w:r><w:br/></w:r>';
  const styleId = wordCharacterStyleId(run.semantics);
  const lang = run.language
    ? `<w:lang w:val="${xml(run.language)}"/>`
    : '';
  const rPr = styleId || lang
    ? `<w:rPr>${styleId ? `<w:rStyle w:val="${styleId}"/>` : ''}${lang}</w:rPr>`
    : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xml(run.text)}</w:t></w:r>`;
}

function wordCharacterStyleId(semantics: readonly OmiInlineSemanticKind[]): string | undefined {
  if (semantics.includes('strong') && semantics.includes('emphasis')) return 'OMIStrongEmphasis';
  const priority: OmiInlineSemanticKind[] = [
    'emphasis', 'strong', 'small-caps', 'superscript', 'subscript', 'underline', 'strike', 'code',
  ];
  const selected = priority.find((kind) => semantics.includes(kind));
  return selected ? WORD_STYLE_IDS[selected] : undefined;
}

const WORD_STYLE_IDS: Record<OmiInlineSemanticKind, string> = {
  emphasis: 'OMIEmphasis',
  strong: 'OMIStrong',
  strike: 'OMIStrike',
  underline: 'OMIUnderline',
  'small-caps': 'OMISmallCaps',
  superscript: 'OMISuperscript',
  subscript: 'OMISubscript',
  code: 'OMICode',
};

function characterStylesXml(): string {
  return [
    characterStyle('OMIEmphasis', 'OMI Emphasis', '<w:i/>'),
    characterStyle('OMIStrong', 'OMI Strong', '<w:b/>'),
    characterStyle('OMIStrongEmphasis', 'OMI Strong Emphasis', '<w:b/><w:i/>'),
    characterStyle('OMIStrike', 'OMI Strike', '<w:strike/>'),
    characterStyle('OMIUnderline', 'OMI Underline', '<w:u w:val="single"/>'),
    characterStyle('OMISmallCaps', 'OMI Small Caps', '<w:smallCaps/>'),
    characterStyle('OMISuperscript', 'OMI Superscript', '<w:vertAlign w:val="superscript"/>'),
    characterStyle('OMISubscript', 'OMI Subscript', '<w:vertAlign w:val="subscript"/>'),
    characterStyle('OMICode', 'OMI Code', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>'),
  ].join('');
}

function characterStyle(id: string, name: string, properties: string): string {
  return `<w:style w:type="character" w:customStyle="1" w:styleId="${id}"><w:name w:val="${xml(name)}"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="10"/><w:qFormat/><w:rPr>${properties}</w:rPr></w:style>`;
}

function style(id: string, name: string, size: number, bold: boolean): string {
  return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr></w:style>`;
}

function headingStyle(level: number): string {
  const size = Math.max(22, 32 - (level - 1) * 2);
  return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="${level - 1}"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
}

function blockPlainText(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    const label = block.visual.kind.charAt(0).toUpperCase() + block.visual.kind.slice(1);
    return caption?.trim() ? `[${label}: ${caption.trim()}]` : `[${label}]`;
  }
  const runs = extractOmiInlineRuns(block.content);
  if (runs.length) return runs.map((run) => run.text).join('').replace(/\s+/g, ' ').trim();
  return block.content.trim();
}

function localizedLabel(locale: string, key: 'abstract' | 'keywords' | 'notes'): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const labels = language === 'hu'
    ? { abstract: 'Absztrakt', keywords: 'Kulcsszavak', notes: 'Jegyzetek' }
    : language === 'de'
      ? { abstract: 'Zusammenfassung', keywords: 'Schlüsselwörter', notes: 'Anmerkungen' }
      : { abstract: 'Abstract', keywords: 'Keywords', notes: 'Notes' };
  return labels[key];
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  return manuscript.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || manuscript.id || 'manuscript';
}
