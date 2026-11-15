import { DOMParser } from '@xmldom/xmldom';
import { GraphError } from './model';

/**
 * Strict XML entry point for imported network files.
 * Do not permit DTDs or entity declarations, and do not let XML library
 * parser errors leak as a different error type to the import UI.
 */
export function parseGraphXml(raw: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new GraphError('invalid');
  try {
    const doc = new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message);
      },
    }).parseFromString(raw, 'application/xml') as unknown as Document;
    if (doc.getElementsByTagName('parsererror').length) throw new GraphError('invalid');
    return doc;
  } catch {
    throw new GraphError('invalid');
  }
}
