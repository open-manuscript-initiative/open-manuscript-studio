import type { OmiSectionNumberingStyle } from '../types/omi';

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

export function formatSectionNumber(
  zeroBasedIndex: number,
  style: OmiSectionNumberingStyle | undefined,
): string {
  const normalizedStyle = normalizeSectionNumberingStyle(style);

  if (normalizedStyle === 'none' || zeroBasedIndex < 0) {
    return '';
  }

  const ordinal = zeroBasedIndex + 1;

  switch (normalizedStyle) {
    case 'decimal':
      return `${ordinal}.`;
    case 'upper-roman':
      return `${toRoman(ordinal)}.`;
    case 'lower-roman':
      return `${toRoman(ordinal).toLowerCase()}.`;
    case 'upper-alpha':
      return `${toAlphabetic(ordinal)}.`;
    case 'lower-alpha':
      return `${toAlphabetic(ordinal).toLowerCase()}.`;
    case 'none':
      return '';
  }
}

export function formatSectionHeading(
  title: string,
  zeroBasedIndex: number,
  style: OmiSectionNumberingStyle | undefined,
): string {
  const number = formatSectionNumber(zeroBasedIndex, style);

  return number ? `${number} ${title}` : title;
}

export function sectionNumberingStyleExample(
  style: OmiSectionNumberingStyle,
): string {
  switch (style) {
    case 'none':
      return '—';
    case 'decimal':
      return '1. 2. 3.';
    case 'upper-roman':
      return 'I. II. III.';
    case 'lower-roman':
      return 'i. ii. iii.';
    case 'upper-alpha':
      return 'A. B. C.';
    case 'lower-alpha':
      return 'a. b. c.';
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
