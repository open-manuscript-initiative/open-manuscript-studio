const RELATIVE_SPECIFIER = /^(?:\.\.?\/)/;
const EXPLICIT_EXTENSION = /\.[cm]?[jt]sx?(?:[?#].*)?$/i;

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      RELATIVE_SPECIFIER.test(specifier)
      && !EXPLICIT_EXTENSION.test(specifier)
      && !specifier.endsWith('.css')
    ) {
      for (const extension of ['.ts', '.tsx']) {
        try {
          return await nextResolve(`${specifier}${extension}`, context);
        } catch {
          // Try the next source extension before preserving the original error.
        }
      }
    }

    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default {};',
    };
  }
  return nextLoad(url, context);
}
