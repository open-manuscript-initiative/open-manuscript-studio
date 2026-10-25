import { BUILTIN_PUBLICATION_PROFILES, OMI_PUBLICATION_PROFILE_MODEL } from './publicationProfile';
import type { ProtectablePublicationProfile } from './publisherProfileProtection';
import { CITATION_STYLE_IDS, parseCustomCitationStyleId } from './cslRendering';
import styleTemplate from '../document/publicationStyles/egyhaztorteneti-szemle.json' with { type: 'json' };

export async function readPublisherProfileBytes(bytes: Uint8Array, expectedSha256?: string) {
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error('Publisher profile exceeds 2 MB.');
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) throw new Error('Publisher profile checksum mismatch.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { profile: validatePublisherProfile(JSON.parse(text)), sha256 };
}

/** Untrusted profile data must pass this boundary before storage or activation. */
export function validatePublisherProfile(value: unknown): ProtectablePublicationProfile {
  const fail = (path: string): never => { throw new Error(`Invalid publisher profile at ${path}`); };
  function object(v: unknown, path: string): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(path);
    return v as Record<string, unknown>;
  }
  function shape(v: unknown, template: unknown, path: string): void {
    if (Array.isArray(template)) {
      if (!Array.isArray(v) || !v.length || v.some(item => !template.includes(item))) fail(path);
    } else if (template && typeof template === 'object') {
      const record = object(v, path);
      for (const [key, sample] of Object.entries(template)) shape(record[key], sample, `${path}/${key}`);
    } else if (typeof v !== typeof template || (typeof v === 'number' && !Number.isFinite(v))) fail(path);
  }
  const profile = object(value, '/');
  if (profile.model !== OMI_PUBLICATION_PROFILE_MODEL) fail('/model');
  for (const key of ['id', 'version', 'name', 'description']) {
    if (typeof profile[key] !== 'string' || (key !== 'description' && !String(profile[key]).trim())) fail(`/${key}`);
  }
  // Optional citation rules are checked separately, allowing older profile files.
  const template = JSON.parse(JSON.stringify(BUILTIN_PUBLICATION_PROFILES[0]!.rules));
  delete template.citations.bibliographyStyle;
  delete template.citations.noteFirstStyle;
  delete template.citations.noteSubsequentStyle;
  shape(profile.rules, template, '/rules');
  const rules = object(profile.rules, '/rules');
  const layout = object(rules.layout, '/rules/layout');
  const choices: Array<[unknown, readonly unknown[], string]> = [
    [layout.pageSize, ['A4', 'Letter'], 'pageSize'], [layout.columns, [1, 2], 'columns'],
    [layout.fontFamily, ['serif', 'sans-serif'], 'fontFamily'], [layout.textAlign, ['left', 'justified'], 'textAlign'],
  ];
  for (const [v, allowed, path] of choices) if (!allowed.includes(v)) fail(`/rules/layout/${path}`);
  for (const key of ['baseFontSizePt', 'lineHeight']) if (Number(layout[key]) <= 0 || Number(layout[key]) > 1000) fail(`/rules/layout/${key}`);
  for (const margin of Object.values(object(layout.marginMm, '/rules/layout/marginMm'))) if (Number(margin) < 0 || Number(margin) > 1000) fail('/rules/layout/marginMm');
  const enums: Record<string, Record<string, string[]>> = {
    sections: { numberingStyle: ['none', 'decimal', 'upper-roman', 'lower-roman', 'upper-alpha', 'lower-alpha'] },
    notes: { placement: ['footnotes', 'endnotes', 'interactive'], restartNumbering: ['document', 'section'] },
    objects: { numbering: ['document', 'section'], figureCaptionPosition: ['above', 'below'], tableCaptionPosition: ['above', 'below'], equationNumbering: ['document', 'section'] },
    contributors: { affiliationMode: ['inline', 'markers'] },
    metadata: { affiliation: ['off', 'recommended', 'required'], orcid: ['off', 'recommended', 'required'] },
    accessibility: { figureAltText: ['off', 'recommended', 'required'], tableHeaders: ['off', 'recommended', 'required'], semanticHeadings: ['off', 'recommended', 'required'] },
  };
  for (const [group, fields] of Object.entries(enums)) for (const [key, allowed] of Object.entries(fields)) {
    if (!allowed.includes(String(object(rules[group], group)[key]))) fail(`/rules/${group}/${key}`);
  }
  // Bound arbitrary extension data and reject prototype keys before downstream use.
  let nodes = 0;
  function safe(v: unknown, depth = 0): void {
    if (++nodes > 50000 || depth > 32) fail('/limits');
    if (typeof v === 'number' && !Number.isFinite(v)) fail('/number');
    if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('/unsafe-key');
      safe(child, depth + 1);
    }
  }
  safe(profile);
  const citations = object(rules.citations, '/rules/citations');
  for (const key of ['style', 'bibliographyStyle', 'noteFirstStyle', 'noteSubsequentStyle']) {
    const id = citations[key];
    if (id === undefined && key !== 'style') continue;
    if (typeof id !== 'string' || (!CITATION_STYLE_IDS.includes(id as never) && !parseCustomCitationStyleId(id))) fail(`/rules/citations/${key}`);
  }
  for (const [v, path] of [[object(rules.sections, 'sections').maxNumberedDepth, 'maxNumberedDepth'], [object(rules.metadata, 'metadata').minimumKeywords, 'minimumKeywords']] as const) {
    if (!Number.isInteger(v) || Number(v) < 0 || Number(v) > 1000) fail(path);
  }
  if (profile.publicationStyle !== undefined) {
    const style = object(profile.publicationStyle, '/publicationStyle');
    const { paragraphStyles: _paragraphStyles, ...requiredStyle } = styleTemplate;
    shape(style, requiredStyle, '/publicationStyle');
    const paragraphs = object(style.paragraphStyles, '/publicationStyle/paragraphStyles');
    if (typeof paragraphs.defaultStyleId !== 'string' || !Array.isArray(paragraphs.items)) fail('/publicationStyle/paragraphStyles');
    for (const item of paragraphs.items as unknown[]) {
      const p = object(item, '/publicationStyle/paragraphStyles/items');
      if (typeof p.id !== 'string' || typeof p.name !== 'string') fail('/publicationStyle/paragraphStyles/items');
      object(p.properties, '/publicationStyle/paragraphStyles/properties');
    }
  }
  if (profile.branding !== undefined) {
    const branding = object(profile.branding, '/branding');
    for (const [key, v] of Object.entries(branding)) if (typeof v !== 'string') fail(`/branding/${key}`);
    if (branding.logoDataUrl && !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(String(branding.logoDataUrl))) fail('/branding/logoDataUrl');
    for (const key of ['primaryColor', 'accentColor']) if (branding[key] && !/^#[a-f0-9]{3,8}$/i.test(String(branding[key]))) fail(`/branding/${key}`);
  }
  if (profile.protection !== undefined) {
    const protection = object(profile.protection, '/protection');
    if (protection.readOnly !== true) fail('/protection/readOnly');
    for (const key of ['lockedAt', 'lockedByUserId', 'lockedByEmail', 'lockedByName', 'identityMethod']) if (typeof protection[key] !== 'string' || !String(protection[key]).trim()) fail(`/protection/${key}`);
    if (!Number.isFinite(Date.parse(String(protection.lockedAt)))) fail('/protection/lockedAt');
    if (!['authenticated-account', 'verified-email', 'ror-affiliation', 'institutional-identity'].includes(String(protection.identityMethod))) fail('/protection/identityMethod');
  }
  return profile as unknown as ProtectablePublicationProfile;
}
