const RELATIVE_SPECIFIER = /^(?:\.\.?\/)/;
const EXPLICIT_EXTENSION = /\.[cm]?[jt]sx?(?:[?#].*)?$/i;

/**
 * Node's native ESM resolver does not infer `.ts` for the extensionless source
 * imports that Vite/TypeScript already support in Studio. Tests run against the
 * real source modules, so this narrowly scoped fallback appends `.ts` only when
 * ordinary ESM resolution has failed for a relative extensionless specifier.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      RELATIVE_SPECIFIER.test(specifier) &&
      !EXPLICIT_EXTENSION.test(specifier)
    ) {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch {
        // Preserve Node's original resolution error below.
      }
    }

    throw error;
  }
}
