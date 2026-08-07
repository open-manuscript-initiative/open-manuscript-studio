export function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function parseKeywordInput(value: string): string[] {
  return normalizeKeywords(
    value
      .split(/[;,\n]+/)
      .map((item) => item.trim()),
  );
}

export function normalizeKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const keyword = normalizeKeyword(rawValue);

    if (!keyword) {
      continue;
    }

    const comparisonKey = keyword.toLocaleLowerCase();

    if (seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    result.push(keyword);
  }

  return result;
}

export function addKeywords(
  currentKeywords: string[],
  input: string,
): string[] {
  return normalizeKeywords([
    ...currentKeywords,
    ...parseKeywordInput(input),
  ]);
}

export function removeKeyword(
  currentKeywords: string[],
  keywordToRemove: string,
): string[] {
  return currentKeywords.filter(
    (keyword) => keyword !== keywordToRemove,
  );
}
