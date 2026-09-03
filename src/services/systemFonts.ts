export type SystemFontCssStyle = 'normal' | 'italic';

export interface SystemFontFace {
  family: string;
  fullName: string;
  postscriptName?: string;
  style: string;
  weight: number;
  fontStyle: SystemFontCssStyle;
}

export interface SystemFontFamily {
  family: string;
  faces: SystemFontFace[];
}

interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

interface LocalFontWindow extends Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
}

const FALLBACK_FAMILIES = [
  'Arial',
  'Aptos',
  'Calibri',
  'Cambria',
  'Charter',
  'EB Garamond',
  'Georgia',
  'Helvetica Neue',
  'Liberation Sans',
  'Liberation Serif',
  'Noto Sans',
  'Noto Serif',
  'Times New Roman',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
] as const;

const FALLBACK_FACES = [
  ['Thin', 100, 'normal'],
  ['Thin Italic', 100, 'italic'],
  ['Extra Light', 200, 'normal'],
  ['Extra Light Italic', 200, 'italic'],
  ['Light', 300, 'normal'],
  ['Light Italic', 300, 'italic'],
  ['Regular', 400, 'normal'],
  ['Italic', 400, 'italic'],
  ['Medium', 500, 'normal'],
  ['Medium Italic', 500, 'italic'],
  ['Semi Bold', 600, 'normal'],
  ['Semi Bold Italic', 600, 'italic'],
  ['Bold', 700, 'normal'],
  ['Bold Italic', 700, 'italic'],
  ['Extra Bold', 800, 'normal'],
  ['Extra Bold Italic', 800, 'italic'],
  ['Black', 900, 'normal'],
  ['Black Italic', 900, 'italic'],
] as const satisfies readonly (readonly [string, number, SystemFontCssStyle])[];

export function inferSystemFontFaceStyle(
  styleName: string,
  explicitWeight?: number,
  explicitStyle?: SystemFontCssStyle,
): Pick<SystemFontFace, 'weight' | 'fontStyle'> {
  const descriptor = styleName
    .normalize('NFKD')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const compact = descriptor.replace(/\s+/g, '');
  const inferredWeight = /(?:extra|ultra)light|extralight|ultralight/.test(compact)
    ? 200
    : /thin|hairline/.test(descriptor)
      ? 100
      : /(?:semi|demi)bold|semibold|demibold/.test(compact)
        ? 600
        : /(?:extra|ultra)bold|extrabold|ultrabold/.test(compact)
          ? 800
          : /black|heavy/.test(descriptor)
            ? 900
            : /medium/.test(descriptor)
              ? 500
              : /light/.test(descriptor)
                ? 300
                : /bold/.test(descriptor)
                  ? 700
                  : 400;
  const weight = Number.isFinite(explicitWeight)
    ? Math.max(100, Math.min(900, Math.round(explicitWeight!)))
    : inferredWeight;
  const fontStyle = explicitStyle
    ?? (/italic|oblique|kursiv/.test(descriptor) ? 'italic' : 'normal');
  return { weight, fontStyle };
}

export function groupSystemFontFaces(
  records: readonly Partial<SystemFontFace>[],
): SystemFontFamily[] {
  const grouped = new Map<string, { family: string; faces: Map<string, SystemFontFace> }>();

  for (const record of records) {
    const family = cleanText(record.family);
    if (!family) continue;
    const style = cleanText(record.style) || 'Regular';
    const inferred = inferSystemFontFaceStyle(
      style,
      finiteNumber(record.weight),
      record.fontStyle === 'italic' || record.fontStyle === 'normal'
        ? record.fontStyle
        : undefined,
    );
    const face: SystemFontFace = {
      family,
      fullName: cleanText(record.fullName) || `${family} ${style}`.trim(),
      postscriptName: cleanText(record.postscriptName) || undefined,
      style,
      ...inferred,
    };
    const familyKey = family.toLocaleLowerCase();
    const entry = grouped.get(familyKey) ?? { family, faces: new Map() };
    // CSS can faithfully distinguish these combinations. Duplicate files and
    // localized aliases are intentionally collapsed to one InDesign-like face.
    const faceKey = systemFontFaceValue(face.weight, face.fontStyle);
    const existing = entry.faces.get(faceKey);
    if (!existing || face.style.length < existing.style.length) {
      entry.faces.set(faceKey, face);
    }
    grouped.set(familyKey, entry);
  }

  return [...grouped.values()]
    .map(({ family, faces }) => ({
      family,
      faces: [...faces.values()].sort(compareFaces),
    }))
    .sort((left, right) => left.family.localeCompare(right.family, undefined, {
      sensitivity: 'base',
      numeric: true,
    }));
}

export function fallbackSystemFontFamilies(
  currentFamilies: readonly string[] = [],
): SystemFontFamily[] {
  const familyNames = uniqueFamilies([...currentFamilies, ...FALLBACK_FAMILIES]);
  return familyNames.map((family) => ({
    family,
    faces: FALLBACK_FACES.map(([style, weight, fontStyle]) => ({
      family,
      fullName: `${family} ${style}`,
      style,
      weight,
      fontStyle,
    })),
  }));
}

export function ensureSystemFontFamilies(
  catalog: readonly SystemFontFamily[],
  currentFamilies: readonly string[],
): SystemFontFamily[] {
  const missing = uniqueFamilies(currentFamilies).filter((family) => (
    !catalog.some((item) => sameFamily(item.family, family))
  ));
  return [...catalog, ...fallbackSystemFontFamilies(missing).filter((item) => (
    missing.some((family) => sameFamily(item.family, family))
  ))].sort((left, right) => left.family.localeCompare(right.family, undefined, {
    sensitivity: 'base',
    numeric: true,
  }));
}

export function systemFontFacesForFamily(
  catalog: readonly SystemFontFamily[],
  family: string,
): SystemFontFace[] {
  return catalog.find((item) => sameFamily(item.family, family))?.faces
    ?? fallbackSystemFontFamilies([family]).find((item) => sameFamily(item.family, family))?.faces
    ?? [];
}

export function preferredSystemFontFace(
  catalog: readonly SystemFontFamily[],
  family: string,
  weight = 400,
  fontStyle: SystemFontCssStyle = 'normal',
): SystemFontFace {
  const faces = systemFontFacesForFamily(catalog, family);
  return faces.find((face) => face.weight === weight && face.fontStyle === fontStyle)
    ?? faces
      .filter((face) => face.fontStyle === fontStyle)
      .sort((left, right) => Math.abs(left.weight - weight) - Math.abs(right.weight - weight))[0]
    ?? faces.find((face) => face.weight === 400 && face.fontStyle === 'normal')
    ?? faces[0]
    ?? {
      family,
      fullName: `${family} Regular`,
      style: 'Regular',
      weight: 400,
      fontStyle: 'normal',
    };
}

export function systemFontFaceValue(
  weight: number,
  fontStyle: SystemFontCssStyle,
): string {
  return `${Math.max(100, Math.min(900, Math.round(weight)))}:${fontStyle}`;
}

export function supportsLocalFontAccess(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as LocalFontWindow).queryLocalFonts === 'function';
}

export async function queryInstalledSystemFonts(): Promise<SystemFontFamily[]> {
  if (!supportsLocalFontAccess()) {
    throw new Error('Local Font Access API is not available.');
  }
  const records = await (window as LocalFontWindow).queryLocalFonts!();
  const families = groupSystemFontFaces(records);
  if (!families.length) throw new Error('No local fonts were returned.');
  return families;
}

export function systemFontFaceCount(catalog: readonly SystemFontFamily[]): number {
  return catalog.reduce((total, family) => total + family.faces.length, 0);
}

function compareFaces(left: SystemFontFace, right: SystemFontFace): number {
  return left.weight - right.weight
    || Number(left.fontStyle === 'italic') - Number(right.fontStyle === 'italic')
    || left.style.localeCompare(right.style, undefined, { sensitivity: 'base' });
}

function uniqueFamilies(families: readonly string[]): string[] {
  const result = new Map<string, string>();
  for (const value of families) {
    const family = cleanText(value);
    if (family && !result.has(family.toLocaleLowerCase())) {
      result.set(family.toLocaleLowerCase(), family);
    }
  }
  return [...result.values()];
}

function sameFamily(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
