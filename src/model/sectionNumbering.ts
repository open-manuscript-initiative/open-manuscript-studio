import type {
  OmiSection,
  OmiSectionNumberingStyle,
} from '../types/omi';
import { getParentSectionId } from './sectionStructure.ts';

export const SECTION_NUMBERING_STYLES: OmiSectionNumberingStyle[] = [
  'none',
  'decimal',
  'upper-roman',
  'lower-roman',
  'upper-alpha',
  'lower-alpha',
];

export function normalizeSectionNumberingStyle(
  style: OmiSectionNumberingStyle | undefined,
): OmiSectionNumberingStyle {
  return style && SECTION_NUMBERING_STYLES.includes(style)
    ? style
    : 'none';
}

/**
 * Backward-compatible single-level formatter.
 */
export function formatSectionNumber(
  zeroBasedIndex: number,
  style: OmiSectionNumberingStyle | undefined,
): string {
  const normalizedStyle = normalizeSectionNumberingStyle(style);

  if (normalizedStyle === 'none' || zeroBasedIndex < 0) {
    return '';
  }

  return `${formatOrdinal(zeroBasedIndex + 1, normalizedStyle)}.`;
}

/**
 * Returns the structural ordinal path of a section, for example [2, 1, 3].
 * The path is derived from sibling order and parent relationships rather than
 * stored as mutable numbering metadata.
 */
export function getSectionOrdinalPath(
  sections: readonly OmiSection[],
  sectionId: string,
): number[] {
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const target = sectionMap.get(sectionId);
  if (!target) return [];

  const chain: OmiSection[] = [];
  let current: OmiSection | undefined = target;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) return [];
    visited.add(current.id);
    chain.unshift(current);
    const parentId = getParentSectionId(current);
    current = parentId ? sectionMap.get(parentId) : undefined;
  }

  return chain.map((section) => {
    const parentId = getParentSectionId(section);
    const siblings = sections.filter(
      (candidate) => getParentSectionId(candidate) === parentId,
    );
    return siblings.findIndex((candidate) => candidate.id === section.id) + 1;
  });
}

/**
 * Returns a punctuation-free hierarchical token such as `2.1.3` or `II.I`.
 */
export function getSectionNumberToken(
  sections: readonly OmiSection[],
  sectionId: string,
  style: OmiSectionNumberingStyle | undefined = 'decimal',
): string {
  const normalizedStyle = normalizeSectionNumberingStyle(style);
  if (normalizedStyle === 'none') return '';

  const path = getSectionOrdinalPath(sections, sectionId);
  if (path.length === 0) return '';

  return path
    .map((ordinal) => formatOrdinal(ordinal, normalizedStyle))
    .join('.');
}

export function formatHierarchicalSectionNumber(
  sections: readonly OmiSection[],
  sectionId: string,
  style: OmiSectionNumberingStyle | undefined,
): string {
  const token = getSectionNumberToken(sections, sectionId, style);
  if (!token) return '';

  // Imported DOCX headings may already contain their visible section number
  // (for example "4. Notes" or "4 Notes"). The Studio normally renders its
  // structural number separately, which would otherwise produce "5. 4. Notes"
  // when the imported document contains an unnumbered introductory section or
  // its source numbering differs from the current structural ordinal. Treat a
  // leading source number as presentation-owned by the title and do not render
  // a second generated number beside it. The stored title remains untouched so
  // round-trip fidelity is preserved.
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (section && hasLeadingSectionNumber(section.title)) return '';

  return `${token}.`;
}

function hasLeadingSectionNumber(title: string): boolean {
  const text = title.trim();
  if (!text) return false;

  return (
    /^\d+(?:\.\d+){0,5}[.)]?\s+\S/.test(text) ||
    /^(?:[IVXLCDM]{1,8})[.)]\s+\S/i.test(text) ||
    /^[A-Z][.)]\s+\S/.test(text)
  );
}

export function formatSectionHeading(
  title: string,
  zeroBasedIndex: number,
  style: OmiSectionNumberingStyle | undefined,
): string {
  const number = formatSectionNumber(zeroBasedIndex, style);
  return number ? `${number} ${title}` : title;
}

export function formatHierarchicalSectionHeading(
  title: string,
  sections: readonly OmiSection[],
  sectionId: string,
  style: OmiSectionNumberingStyle | undefined,
): string {
  const number = formatHierarchicalSectionNumber(sections, sectionId, style);
  return number ? `${number} ${title}` : title;
}

export function buildSectionNumberMap(
  sections: readonly OmiSection[],
  style: OmiSectionNumberingStyle | undefined,
): Map<string, string> {
  return new Map(
    sections.map((section) => [
      section.id,
      formatHierarchicalSectionNumber(sections, section.id, style),
    ]),
  );
}

export function sectionNumberingStyleExample(
  style: OmiSectionNumberingStyle,
): string {
  switch (style) {
    case 'none':
      return '—';
    case 'decimal':
      return '1. 1.1. 1.1.1.';
    case 'upper-roman':
      return 'I. I.I. I.I.I.';
    case 'lower-roman':
      return 'i. i.i. i.i.i.';
    case 'upper-alpha':
      return 'A. A.A. A.A.A.';
    case 'lower-alpha':
      return 'a. a.a. a.a.a.';
  }
}

function formatOrdinal(
  ordinal: number,
  style: Exclude<OmiSectionNumberingStyle, 'none'>,
): string {
  switch (style) {
    case 'decimal':
      return String(ordinal);
    case 'upper-roman':
      return toRoman(ordinal);
    case 'lower-roman':
      return toRoman(ordinal).toLowerCase();
    case 'upper-alpha':
      return toAlphabetic(ordinal);
    case 'lower-alpha':
      return toAlphabetic(ordinal).toLowerCase();
  }
}

function toRoman(value: number): string {
  if (!Number.isInteger(value) || value <= 0) {
    return '';
  }

  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = value;
  let result = '';

  for (const [amount, symbol] of numerals) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }

  return result;
}

function toAlphabetic(value: number): string {
  if (!Number.isInteger(value) || value <= 0) {
    return '';
  }

  let remaining = value;
  let result = '';

  while (remaining > 0) {
    remaining -= 1;
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }

  return result;
}
