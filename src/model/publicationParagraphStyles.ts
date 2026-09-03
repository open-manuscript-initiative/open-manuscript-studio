export type PublicationParagraphAlignment = 'left' | 'center' | 'right' | 'justify';
export type PublicationParagraphFontStyle = 'normal' | 'italic';

export interface PublicationParagraphStyleProperties {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: number;
  fontStyle?: PublicationParagraphFontStyle;
  alignment?: PublicationParagraphAlignment;
  firstLineIndent?: number;
  leftIndent?: number;
  rightIndent?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  hyphenation?: boolean;
  keepTogether?: boolean;
  keepWithNext?: boolean;
  widows?: number;
  orphans?: number;
}

export interface PublicationParagraphStyleDefinition {
  id: string;
  name: string;
  basedOnId: string | null;
  nextStyleId: string | null;
  properties: PublicationParagraphStyleProperties;
}

export interface PublicationParagraphStyleCollection {
  defaultStyleId: string;
  items: PublicationParagraphStyleDefinition[];
}

export type ResolvedPublicationParagraphStyle = Required<PublicationParagraphStyleProperties>;

export function normalizePublicationParagraphStyleCollection(
  value: PublicationParagraphStyleCollection | undefined,
  fallback: PublicationParagraphStyleCollection,
): PublicationParagraphStyleCollection {
  const sourceItems = Array.isArray(value?.items) ? value.items : [];
  const fallbackItems = fallback.items.map(normalizeDefinition).filter(isDefinition);
  const items = sourceItems.map(normalizeDefinition).filter(isDefinition);
  const normalizedItems = items.length ? items : fallbackItems;
  const availableIds = new Set(normalizedItems.map((item) => item.id));
  const requestedDefault = cleanText(value?.defaultStyleId);
  const fallbackDefault = cleanText(fallback.defaultStyleId);
  const defaultStyleId = availableIds.has(requestedDefault)
    ? requestedDefault
    : availableIds.has(fallbackDefault)
      ? fallbackDefault
      : normalizedItems[0]?.id ?? 'body';

  return {
    defaultStyleId,
    items: normalizedItems.map((item) => ({
      ...item,
      basedOnId: item.basedOnId && availableIds.has(item.basedOnId)
        ? item.basedOnId
        : null,
      nextStyleId: item.nextStyleId && availableIds.has(item.nextStyleId)
        ? item.nextStyleId
        : defaultStyleId,
    })),
  };
}

export function resolvePublicationParagraphStyle(
  collection: PublicationParagraphStyleCollection,
  styleId: string | null | undefined,
  defaults: ResolvedPublicationParagraphStyle,
): ResolvedPublicationParagraphStyle {
  const byId = new Map(collection.items.map((item) => [item.id, item]));
  const requested = cleanText(styleId);
  const start = byId.get(requested) ?? byId.get(collection.defaultStyleId);
  if (!start) return { ...defaults };

  const chain: PublicationParagraphStyleDefinition[] = [];
  const visited = new Set<string>();
  let current: PublicationParagraphStyleDefinition | undefined = start;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.basedOnId ? byId.get(current.basedOnId) : undefined;
  }

  return chain.reduce(
    (resolved, definition) => ({ ...resolved, ...definition.properties }),
    { ...defaults },
  );
}

export function paragraphStyleWouldCreateCycle(
  collection: PublicationParagraphStyleCollection,
  styleId: string,
  candidateBaseId: string | null,
): boolean {
  if (!candidateBaseId) return false;
  if (candidateBaseId === styleId) return true;
  const byId = new Map(collection.items.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let currentId: string | null = candidateBaseId;
  while (currentId && !visited.has(currentId)) {
    if (currentId === styleId) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.basedOnId ?? null;
  }
  return false;
}

function normalizeDefinition(
  value: PublicationParagraphStyleDefinition | undefined,
): PublicationParagraphStyleDefinition | null {
  const id = cleanText(value?.id);
  if (!id) return null;
  return {
    id,
    name: cleanText(value?.name) || id,
    basedOnId: cleanText(value?.basedOnId) || null,
    nextStyleId: cleanText(value?.nextStyleId) || null,
    properties: normalizeProperties(value?.properties),
  };
}

function normalizeProperties(
  value: PublicationParagraphStyleProperties | undefined,
): PublicationParagraphStyleProperties {
  if (!value || typeof value !== 'object') return {};
  const result: PublicationParagraphStyleProperties = {};
  const fontFamily = cleanText(value.fontFamily);
  if (fontFamily) result.fontFamily = fontFamily;
  if (finite(value.fontSize) && Number(value.fontSize) > 0) result.fontSize = Number(value.fontSize);
  if (finite(value.lineHeight) && Number(value.lineHeight) > 0) result.lineHeight = Number(value.lineHeight);
  if (finite(value.fontWeight)) result.fontWeight = Math.max(100, Math.min(900, Number(value.fontWeight)));
  if (value.fontStyle === 'normal' || value.fontStyle === 'italic') result.fontStyle = value.fontStyle;
  if (
    value.alignment === 'left'
    || value.alignment === 'center'
    || value.alignment === 'right'
    || value.alignment === 'justify'
  ) result.alignment = value.alignment;
  for (const property of [
    'firstLineIndent',
    'leftIndent',
    'rightIndent',
    'spaceBefore',
    'spaceAfter',
  ] as const) {
    if (finite(value[property])) result[property] = Number(value[property]);
  }
  if (typeof value.hyphenation === 'boolean') result.hyphenation = value.hyphenation;
  if (typeof value.keepTogether === 'boolean') result.keepTogether = value.keepTogether;
  if (typeof value.keepWithNext === 'boolean') result.keepWithNext = value.keepWithNext;
  if (finite(value.widows)) result.widows = Math.max(1, Math.trunc(Number(value.widows)));
  if (finite(value.orphans)) result.orphans = Math.max(1, Math.trunc(Number(value.orphans)));
  return result;
}

function isDefinition(
  value: PublicationParagraphStyleDefinition | null,
): value is PublicationParagraphStyleDefinition {
  return value !== null;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}
