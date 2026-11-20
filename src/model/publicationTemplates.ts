import { applyPublicationProfileDefaults, BUILTIN_PUBLICATION_PROFILES, type OmiPublicationProfile } from './publicationProfile';
import { validatePublisherProfile } from './publisherProfileImport';
import { getDocumentStructureProfile } from './documentProfile';
import { getPublicationMatter, PUBLICATION_MATTER_EXTENSION, publicationMatterAssetIds, publicationMatterTemplate, type PublicationMatter } from './publicationMatter';
import { synchronizeCrossReferenceLabels } from './crossReferences';
import { withPublicationSpineWidth, calculatedSpineWidthMm } from './publicationSpine';
import type { OmiTitleMatter } from './frontMatter';
import type { OmiManuscriptState } from '../types/omi';
import type { OmiAsset } from '../types/assets';
import type { PublicationStyle } from '../services/publicationStyleExport';

export const PUBLICATION_TEMPLATE_EXTENSION = 'urn:omi:studio:publication-template:1';
export interface PublicationTemplate {
  model: 'omi-publication-template';
  version: 1;
  id: string;
  name: string;
  association: string;
  kind: 'volume' | 'journal-issue';
  profile: OmiPublicationProfile;
  defaults: OmiTitleMatter;
  matter: PublicationMatter;
  assets: { metadata: OmiAsset; base64: string }[];
}
export interface AppliedPublicationTemplate {
  version: 1;
  /** A working format keeps the existing publisher identity; actual templates own theirs. */
  source?: 'publication-template' | 'document-style';
  id: string;
  name: string;
  association?: string;
  style: PublicationStyle;
}

export function validateAppliedPublicationTemplate(value: unknown): asserts value is AppliedPublicationTemplate {
  const applied = value as AppliedPublicationTemplate;
  if (!applied || applied.version !== 1 || typeof applied.id !== 'string' || !applied.id || applied.id.length > 128
    || (applied.source !== undefined && !['publication-template', 'document-style'].includes(applied.source))
    || typeof applied.name !== 'string' || !applied.name.trim() || applied.name.length > 200 || !applied.style
    || (applied.association !== undefined && (typeof applied.association !== 'string' || applied.association.length > 256))) {
    throw new Error('Invalid applied publication template.');
  }
  validatePublisherProfile({ ...BUILTIN_PUBLICATION_PROFILES[0], publicationStyle: applied.style });
}

/** Only recurring publisher/serial metadata belongs in a format template. */
export const TEMPLATE_DEFAULT_FIELDS = ['publisherName', 'publicationPlace', 'issn', 'eissn', 'copyrightStatement', 'colophon'] as const;

export function recurringPublicationMetadata(source: OmiTitleMatter = {}): OmiTitleMatter {
  return Object.fromEntries(TEMPLATE_DEFAULT_FIELDS.flatMap((key) => source[key] ? [[key, source[key]]] : []));
}

export function getAppliedPublicationTemplate(state: Pick<OmiManuscriptState, 'extensions'>): AppliedPublicationTemplate | undefined {
  return state.extensions?.[PUBLICATION_TEMPLATE_EXTENSION] as AppliedPublicationTemplate | undefined;
}

/** Replace text nodes only, preserving rich text marks and frame geometry. */
export function mapPublicationMatterText(matter: PublicationMatter, transform: (text: string) => string): PublicationMatter {
  const next = structuredClone(matter);
  function richText(value: string): string {
    const doc = JSON.parse(value);
    function visit(node: { type?: string; text?: string; content?: typeof node[] }) {
      if (typeof node.text === 'string') node.text = transform(node.text);
      node.content?.forEach(visit);
      if (node.content) node.content = node.content.filter((child) => child.type !== 'text' || child.text);
    }
    visit(doc);
    return JSON.stringify(doc);
  }
  for (const page of next.pages) {
    page.content = richText(page.content);
    for (const frame of page.frames ?? []) if (frame.content) frame.content = richText(frame.content);
  }
  return next;
}

export function publicationTemplateValues(state: OmiManuscriptState): Record<string, string> {
  return { title: state.title, subtitle: state.subtitle ?? '', ...state.titleMatter, halfTitle: state.titleMatter?.halfTitle || state.title };
}

export function publicationTemplatePageToken(name: 'imprint' | 'titlePage'): string {
  return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `{{${name}}}` }] }] });
}

export function capturePublicationMatter(state: OmiManuscriptState): PublicationMatter {
  const matter = getPublicationMatter(state);
  if (!matter) throw new Error('Publication matter is required.');
  // Longest values first prevents a short subtitle/year from splitting a title.
  const replacements = Object.entries(publicationTemplateValues(state)).filter(([, value]) => typeof value === 'string' && value.trim())
    .sort((a, b) => b[1].length - a[1].length);
  return mapPublicationMatterText(matter, (text) => {
    if (!replacements.length) return text;
    const escaped = replacements.map(([, value]) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(escaped.join('|'), 'g');
    return text.replace(pattern, (match) => `{{${replacements.find(([, value]) => value === match)![0]}}}`);
  });
}

/** A detached snapshot: later template edits never rewrite existing publications. */
export function applyPublicationTemplate(state: OmiManuscriptState, template: PublicationTemplate): OmiManuscriptState {
  if (getDocumentStructureProfile(state).kind !== 'volume') throw new Error('A publication template requires a volume or journal issue.');
  const kind = getPublicationMatter(state)?.publicationKind ?? 'volume';
  if (kind !== template.kind) throw new Error('Publication template type does not match.');
  const titleMatter = { ...state.titleMatter };
  for (const key of TEMPLATE_DEFAULT_FIELDS) if (!titleMatter[key]?.trim() && template.defaults[key]) titleMatter[key] = template.defaults[key];
  const values = publicationTemplateValues({ ...state, titleMatter });
  const sourceMatter = structuredClone(template.matter);
  for (const page of sourceMatter.pages) {
    // Whole-page metadata blocks can add/remove optional identifier lines.
    if (page.content === publicationTemplatePageToken('imprint')) {
      page.content = publicationMatterTemplate('imprint-page', { ...state, titleMatter });
    }
    if (page.content === publicationTemplatePageToken('titlePage')) page.content = publicationMatterTemplate('title-page', { ...state, titleMatter });
  }
  let matter = mapPublicationMatterText(sourceMatter, (text) => text.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_, key: string) => Object.hasOwn(values, key) ? values[key] ?? '' : ''));
  // Automatic spine settings retain paper stock, but use the new layout's count.
  if (matter.spineCalculation?.mode === 'automatic') {
    const calculation = { ...matter.spineCalculation, pageCountSource: 'layout' as const, pageCount: 1 };
    matter = { ...withPublicationSpineWidth(matter, calculatedSpineWidthMm(calculation)), spineCalculation: calculation };
  }
  const assets = [...(state.assets ?? [])];
  for (const { metadata } of template.assets) {
    const previous = assets.find((asset) => asset.id === metadata.id);
    if (previous && previous.checksum.value !== metadata.checksum.value) throw new Error('Template image identifier collision.');
    if (!previous) assets.push(structuredClone(metadata));
  }
  const profile = structuredClone(template.profile);
  profile.id = `publication-template:${template.id}`;
  profile.version = '1';
  profile.name = template.name;
  profile.publicationStyle = { ...profile.publicationStyle!, id: `publication-template:${template.id}`, name: template.name };
  const applied: AppliedPublicationTemplate = { version: 1, id: template.id, name: template.name, association: template.association, style: structuredClone(profile.publicationStyle!) };
  return {
    ...applyPublicationProfileDefaults(state, profile), titleMatter, assets,
    sections: synchronizeCrossReferenceLabels(state.sections, state.crossReferences ?? [], profile.rules.objects.numbering, state.locale),
    extensions: { ...state.extensions, [PUBLICATION_MATTER_EXTENSION]: matter, [PUBLICATION_TEMPLATE_EXTENSION]: applied },
  };
}

export function templateMatterAssetIds(template: PublicationTemplate): string[] {
  return publicationMatterAssetIds({ extensions: { [PUBLICATION_MATTER_EXTENSION]: template.matter } });
}

