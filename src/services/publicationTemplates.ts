import { createPublicationMatter, getPublicationMatter, validatePublicationMatter, PUBLICATION_MATTER_EXTENSION } from '../model/publicationMatter';
import { BUILTIN_PUBLICATION_PROFILES, resolvePublicationProfile } from '../model/publicationProfile';
import { validatePublisherProfile } from '../model/publisherProfileImport';
import { applyPublicationTemplate, capturePublicationMatter, publicationTemplatePageToken, recurringPublicationMetadata, TEMPLATE_DEFAULT_FIELDS, templateMatterAssetIds, type PublicationTemplate } from '../model/publicationTemplates';
import { createAssetMetadata, sha256Hex } from '../model/assets';
import { clonePublicationStyleTemplate, normalizePublicationStyle, type PublicationStyle } from './publicationStyleExport';
import { getAssetPayload, putAssetPayload } from './assetRepository';
import type { OmiManuscriptState } from '../types/omi';

export const PUBLICATION_TEMPLATES_EVENT = 'omi:publication-templates-changed';
const MAX_TEMPLATE_BYTES = 24 * 1024 * 1024;
const DATABASE = 'omi-publication-templates-v1';

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
function bytes(value: string): Uint8Array { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }

export function builtinPublicationTemplates(): PublicationTemplate[] {
  return (['volume', 'journal-issue'] as const).map((kind) => {
    const style = clonePublicationStyleTemplate();
    const volume = kind === 'volume';
    const id = volume ? 'omi-series-a5' : 'omi-journal-150-240';
    style.id = id; style.name = volume ? 'Book series — A5' : 'Journal — 150 × 240 mm';
    style.description = 'Editable publication template for volumes or journal issues.';
    style.page.width = volume ? 148 : 150; style.page.height = volume ? 210 : 240;
    style.page.margins = { ...style.page.margins, top: 20, bottom: 20, inner: 20, outer: 15 };
    const profile = structuredClone(BUILTIN_PUBLICATION_PROFILES[0]!);
    profile.publicationStyle = normalizePublicationStyle(style);
    const placeholderState = { title: '{{title}}' } as OmiManuscriptState;
    const matter = createPublicationMatter(placeholderState);
    for (const page of matter.pages) {
      if (page.kind === 'imprint-page') page.content = publicationTemplatePageToken('imprint');
      if (['title-page', 'front-cover'].includes(page.kind)) page.content = publicationTemplatePageToken('titlePage');
    }
    matter.publicationKind = kind;
    matter.pages.forEach((page) => { page.enabled = ['half-title', 'title-page', 'imprint-page'].includes(page.kind); });
    return { model: 'omi-publication-template', version: 1, id, name: style.name, association: '', kind, profile, defaults: {}, matter, assets: [] };
  });
}

export function isBuiltinPublicationTemplate(id: string): boolean { return ['omi-series-a5', 'omi-journal-150-240'].includes(id); }

/** Validate every imported image, including its exact payload digest. */
export async function validatePublicationTemplate(value: unknown): Promise<PublicationTemplate> {
  const fail = (): never => { throw new Error('Invalid publication template.'); };
  if (!value || typeof value !== 'object') return fail();
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_TEMPLATE_BYTES) return fail();
  const template = value as PublicationTemplate;
  if (template.model !== 'omi-publication-template' || template.version !== 1
    || typeof template.id !== 'string' || !template.id.trim() || template.id.length > 128
    || typeof template.name !== 'string' || !template.name.trim() || template.name.length > 200
    || typeof template.association !== 'string' || template.association.length > 256
    || !['volume', 'journal-issue'].includes(template.kind)
    || !template.defaults || typeof template.defaults !== 'object' || Array.isArray(template.defaults)
    || Object.entries(template.defaults).some(([key, text]) => !TEMPLATE_DEFAULT_FIELDS.includes(key as typeof TEMPLATE_DEFAULT_FIELDS[number]) || typeof text !== 'string' || text.length > 10000)
    || !Array.isArray(template.assets) || template.assets.length > 128) return fail();
  const profile = validatePublisherProfile(template.profile);
  if (!profile.publicationStyle) return fail();
  validatePublicationMatter(template.matter);
  if (template.matter.publicationKind !== template.kind) return fail();
  const ids = new Set<string>();
  let totalBytes = 0;
  for (const item of template.assets) {
    const asset = item?.metadata;
    if (!asset || typeof asset.id !== 'string' || !asset.id || asset.id.length > 128 || ids.has(asset.id)
      || typeof asset.fileName !== 'string' || asset.fileName.length > 256
      || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mediaType)
      || asset.modelVersion !== '0.1.0-alpha.1' || asset.role !== 'figure'
      || asset.checksum?.algorithm !== 'sha256' || asset.checksum.scope !== 'raw-bytes'
      || !/^[a-f0-9]{64}$/.test(asset.checksum.value)
      || typeof item.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.base64)) return fail();
    if ((totalBytes += item.base64.length) > MAX_TEMPLATE_BYTES) return fail();
    const payload = bytes(item.base64);
    if (!payload.length || payload.length !== asset.size || await sha256Hex(payload) !== asset.checksum.value) return fail();
    ids.add(asset.id);
  }
  const referenced = new Set(templateMatterAssetIds(template));
  if ([...referenced].some((id) => !ids.has(id)) || [...ids].some((id) => !referenced.has(id))) return fail();
  return structuredClone(template);
}

export async function capturePublicationTemplate(state: OmiManuscriptState, style: PublicationStyle, name: string, association: string, id: string = crypto.randomUUID()): Promise<PublicationTemplate> {
  const source = getPublicationMatter(state) ? state : { ...state, extensions: { ...state.extensions, [PUBLICATION_MATTER_EXTENSION]: createPublicationMatter(state) } };
  const matter = capturePublicationMatter(source);
  const profile = structuredClone(resolvePublicationProfile(state));
  // A local template is an independent editable snapshot of a profile.
  delete profile.distribution;
  delete (profile as typeof profile & { protection?: unknown }).protection;
  profile.publicationStyle = normalizePublicationStyle(structuredClone(style));
  const template: PublicationTemplate = { model: 'omi-publication-template', version: 1, id, name: name.trim(), association: association.trim(), kind: matter.publicationKind,
    profile, defaults: recurringPublicationMetadata(state.titleMatter), matter, assets: [] };
  const remap = new Map<string, string>();
  for (const assetId of new Set(templateMatterAssetIds(template))) {
    const sourceAsset = state.assets?.find((asset) => asset.id === assetId);
    const payload = await getAssetPayload(state.id, assetId);
    if (!sourceAsset || !payload) throw new Error('A template image is unavailable.');
    const metadata = await createAssetMetadata(payload, { mediaType: sourceAsset.mediaType, fileName: sourceAsset.fileName, role: 'figure' });
    remap.set(assetId, metadata.id);
    template.assets.push({ metadata, base64: base64(payload) });
  }
  for (const page of matter.pages) {
    if (page.image) page.image.assetId = remap.get(page.image.assetId)!;
    for (const frame of page.frames ?? []) if (frame.image) frame.image.assetId = remap.get(frame.image.assetId)!;
  }
  return validatePublicationTemplate(template);
}

export async function hydratePublicationTemplateAssets(manuscriptId: string, template: PublicationTemplate): Promise<void> {
  for (const item of template.assets) await putAssetPayload(manuscriptId, item.metadata.id, bytes(item.base64));
}

export async function prepareTemplatedPublication(state: OmiManuscriptState, template: PublicationTemplate): Promise<OmiManuscriptState> {
  const validated = await validatePublicationTemplate(template);
  const next = applyPublicationTemplate(state, validated);
  await hydratePublicationTemplateAssets(state.id, validated);
  return next;
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('templates', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storedTemplates(): Promise<PublicationTemplate[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('templates').objectStore('templates').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function loadPublicationTemplates(): Promise<PublicationTemplate[]> {
  const saved = await storedTemplates();
  return [...builtinPublicationTemplates(), ...saved.filter((template) => !isBuiltinPublicationTemplate(template.id))];
}
async function mutateTemplates(change: (store: IDBObjectStore) => void): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      change(transaction.objectStore('templates'));
    });
  } finally { db.close(); }
  window.dispatchEvent(new Event(PUBLICATION_TEMPLATES_EVENT));
}
export async function savePublicationTemplate(template: PublicationTemplate): Promise<void> {
  const validated = await validatePublicationTemplate(template);
  if (isBuiltinPublicationTemplate(template.id)) throw new Error('Built-in templates cannot be overwritten.');
  await mutateTemplates((store) => { store.put(validated); });
}
export async function deletePublicationTemplate(id: string): Promise<void> {
  if (isBuiltinPublicationTemplate(id)) throw new Error('Built-in templates cannot be deleted.');
  await mutateTemplates((store) => { store.delete(id); });
}
export async function importPublicationTemplate(file: File): Promise<PublicationTemplate> {
  if (file.size > MAX_TEMPLATE_BYTES) throw new Error('Publication template exceeds 24 MiB.');
  const template = await validatePublicationTemplate(JSON.parse(await file.text()));
  template.id = crypto.randomUUID();
  await savePublicationTemplate(template);
  return template;
}
