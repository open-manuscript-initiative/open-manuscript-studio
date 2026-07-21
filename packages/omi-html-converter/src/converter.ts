import type {Root as HastRoot} from 'hast';
import rehypeStringify from 'rehype-stringify';
import {unified} from 'unified';

import type {OmiRoot} from './omi-ast.js';
import {
  omiToHast,
  type OmiToHastOptions,
} from './omi-to-hast.js';

/**
 * Újrafelhasználható processor létrehozása.
 *
 * A pipeline:
 *
 * OMI AST
 *   -> omiToHast plugin
 *   -> HAST
 *   -> rehype-stringify
 *   -> HTML
 */
export function createOmiHtmlProcessor(
  options: OmiToHastOptions = {},
) {
  return unified()
    .use(omiToHast, options)
    .use(rehypeStringify, {
      allowDangerousHtml: false,
      closeSelfClosing: true,
      collapseEmptyAttributes: true,
      quote: '"',
      quoteSmart: true,
    });
}

/**
 * OMI dokumentum konvertálása HAST-fává.
 */
export async function convertOmiToHast(
  document: OmiRoot,
  options: OmiToHastOptions = {},
): Promise<HastRoot> {
  validateOmiDocument(document);

  const processor = createOmiHtmlProcessor(options);

  /*
   * Itt nincs parse fázis, mert a bemenet már AST.
   *
   * A run() lefuttatja az OMI -> HAST transzformert,
   * és visszaadja az átalakított fát.
   */
  const transformedTree = await processor.run(document);

  return transformedTree as HastRoot;
}

/**
 * OMI dokumentum konvertálása HTML-fragmentummá.
 */
export async function convertOmiToHtml(
  document: OmiRoot,
  options: OmiToHastOptions = {},
): Promise<string> {
  const processor = createOmiHtmlProcessor(options);
  const hastTree = await convertOmiToHast(document, options);

  /*
   * A stringify() a processorhoz regisztrált fordítót,
   * jelen esetben a rehype-stringify-t használja.
   */
  return processor.stringify(hastTree);
}

/**
 * Minimális futásidejű validáció.
 *
 * Egy valódi OMI implementációban ezt célszerű
 * JSON Schema-, Zod- vagy TypeBox-validációval kiváltani.
 */
function validateOmiDocument(
  value: unknown,
): asserts value is OmiRoot {
  if (!isRecord(value)) {
    throw new TypeError('Az OMI dokumentum nem objektum.');
  }

  if (value.type !== 'root') {
    throw new TypeError(
      'Az OMI dokumentum gyökértípusának "root"-nak kell lennie.',
    );
  }

  if (typeof value.version !== 'string') {
    throw new TypeError(
      'Az OMI dokumentum version mezője kötelező.',
    );
  }

  if (!Array.isArray(value.children)) {
    throw new TypeError(
      'Az OMI dokumentum children mezőjének tömbnek kell lennie.',
    );
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
