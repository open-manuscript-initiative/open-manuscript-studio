export function resolveCatalogTranslation(
  dictionary: unknown,
  pointer: string,
): string | undefined {
  if (typeof dictionary !== 'object' || dictionary === null || !pointer.startsWith('/')) {
    return undefined;
  }

  const value = pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((current, segment) => {
      if (typeof current === 'object' && current !== null && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, dictionary);

  return typeof value === 'string' ? value : undefined;
}

export function interpolateCatalogTranslation(
  value: string,
  values: Record<string, string | number>,
): string {
  return value.replace(
    /\{([A-Za-z][A-Za-z0-9_]*)\}/g,
    (match, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
