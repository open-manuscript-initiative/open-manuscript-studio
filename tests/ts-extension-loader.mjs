const RELATIVE_SPECIFIER = /^(?:\.\.?\/)/;
const EXPLICIT_EXTENSION = /\.[cm]?[jt]sx?(?:[?#].*)?$/i;
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

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
    // Server NodeNext source uses emitted .js specifiers even in .ts files.
    // In source-only tests, fall back to the corresponding .ts module. Keep
    // this restricted to imports made by server/src to avoid masking missing
    // production JavaScript or changing test fixture resolution elsewhere.
    if (
      context.parentURL?.includes('/server/src/') &&
      RELATIVE_SPECIFIER.test(specifier) &&
      specifier.endsWith('.js')
    ) {
      try {
        return await nextResolve(specifier.slice(0, -3) + '.ts', context);
      } catch {
        // Preserve original error below.
      }
    }
    if (
      RELATIVE_SPECIFIER.test(specifier) &&
      !EXPLICIT_EXTENSION.test(specifier)
    ) {
      for (const extension of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        try {
          return await nextResolve(`${specifier}${extension}`, context);
        } catch {
          // Preserve Node's original resolution error below.
        }
      }
    }

    throw error;
  }
}

export async function load(url, context, nextLoad) {
  // Collaboration initialization imports the real visual-node extension. Node
  // strips TypeScript but cannot parse its JSX, so compile only TSX modules in
  // this test loader, using the same React JSX mode as the production tsconfig.
  if (url.endsWith('.tsx')) {
    const source = await readFile(new URL(url), 'utf8');
    return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(source, { fileName: new URL(url).pathname,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
  }
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default {};',
    };
  }
  return nextLoad(url, context);
}
