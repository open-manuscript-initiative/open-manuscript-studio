import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

import {
  ParseOption,
  XmlBufferInputProvider,
  XmlDocument,
  XmlParseError,
  xmlRegisterInputProvider,
  type ErrorDetail,
} from 'libxml2-wasm';

export const JATS_VALIDATION_VERSION = '1.4' as const;
export const JATS_VALIDATION_TAG_SET = 'articleauthoring' as const;
export const JATS_VALIDATION_SCHEMA = 'DTD' as const;
export const JATS_VALIDATION_VARIANT = 'MathML3' as const;
export const JATS_VALIDATION_DTD_FILE =
  'JATS-articleauthoring1-4-mathml3.dtd' as const;
export const JATS_VALIDATION_SCHEMA_PACKAGE = '@jats4r/dtds@0.0.10' as const;
export const JATS_VALIDATION_ENGINE = 'libxml2-wasm@0.7.2' as const;
export const MAX_JATS_VALIDATION_BYTES = 6 * 1024 * 1024;

export interface JatsSchemaDiagnostic {
  code: 'dtd-validity-error' | 'unsafe-xml' | 'invalid-request';
  severity: 'error';
  message: string;
  line?: number;
}

export interface JatsSchemaValidationResult {
  standard: 'NISO JATS';
  version: typeof JATS_VALIDATION_VERSION;
  tagSet: typeof JATS_VALIDATION_TAG_SET;
  schema: typeof JATS_VALIDATION_SCHEMA;
  schemaVariant: typeof JATS_VALIDATION_VARIANT;
  schemaPackage: typeof JATS_VALIDATION_SCHEMA_PACKAGE;
  engine: typeof JATS_VALIDATION_ENGINE;
  valid: boolean;
  diagnostics: JatsSchemaDiagnostic[];
}

interface SchemaFile {
  fileName: string;
  contents: string;
}

let schemaProviderPromise: Promise<void> | undefined;

/**
 * Validates JATS 1.4 Article Authoring XML against the pinned MathML 3 DTD.
 *
 * The submitted document never controls the DTD used for validation.
 * Input-side entity declarations/internal subsets are rejected, any submitted
 * external DOCTYPE is replaced, and libxml2 validates against the trusted JATS
 * DTD loaded from the local @jats4r/dtds package through an in-memory provider.
 */
export async function validateJats14ArticleAuthoring(
  xml: string,
): Promise<JatsSchemaValidationResult> {
  const bytes = Buffer.byteLength(xml, 'utf8');
  if (!xml.trim()) {
    return invalid('invalid-request', 'JATS XML must not be empty.');
  }
  if (bytes > MAX_JATS_VALIDATION_BYTES) {
    return invalid(
      'invalid-request',
      `JATS XML exceeds the ${MAX_JATS_VALIDATION_BYTES / 1024 / 1024} MiB validation limit.`,
    );
  }

  const unsafe = unsafeXmlReason(xml);
  if (unsafe) return invalid('unsafe-xml', unsafe);

  await ensurePinnedSchemaProvider();

  let document: XmlDocument | undefined;
  try {
    document = XmlDocument.fromString(usePinnedDoctype(xml), {
      url: 'article.xml',
      option:
        ParseOption.XML_PARSE_DTDLOAD |
        ParseOption.XML_PARSE_DTDVALID |
        ParseOption.XML_PARSE_NONET |
        ParseOption.XML_PARSE_NO_SYS_CATALOG |
        ParseOption.XML_PARSE_BIG_LINES,
    });
  } catch (error) {
    if (error instanceof XmlParseError) {
      return {
        ...baseResult(),
        valid: false,
        diagnostics: diagnosticsFromError(error.details, error.message),
      };
    }
    throw error;
  } finally {
    document?.dispose();
  }

  return {
    ...baseResult(),
    valid: true,
    diagnostics: [],
  };
}

function baseResult(): Omit<JatsSchemaValidationResult, 'valid' | 'diagnostics'> {
  return {
    standard: 'NISO JATS',
    version: JATS_VALIDATION_VERSION,
    tagSet: JATS_VALIDATION_TAG_SET,
    schema: JATS_VALIDATION_SCHEMA,
    schemaVariant: JATS_VALIDATION_VARIANT,
    schemaPackage: JATS_VALIDATION_SCHEMA_PACKAGE,
    engine: JATS_VALIDATION_ENGINE,
  };
}

function invalid(
  code: JatsSchemaDiagnostic['code'],
  message: string,
): JatsSchemaValidationResult {
  return {
    ...baseResult(),
    valid: false,
    diagnostics: [{ code, severity: 'error', message }],
  };
}

function diagnosticsFromError(
  details: ErrorDetail[],
  fallbackMessage: string,
): JatsSchemaDiagnostic[] {
  if (details.length === 0) {
    return [
      {
        code: 'dtd-validity-error',
        severity: 'error',
        message: sanitizeDiagnosticMessage(fallbackMessage),
      },
    ];
  }

  return details.slice(0, 100).map((detail) => ({
    code: 'dtd-validity-error',
    severity: 'error',
    message: sanitizeDiagnosticMessage(detail.message),
    ...(detail.line > 0 ? { line: detail.line } : {}),
  }));
}

function unsafeXmlReason(xml: string): string | undefined {
  if (/<!ENTITY\b/i.test(xml)) {
    return 'Custom XML entity declarations are not allowed in JATS validation input.';
  }
  if (/<!DOCTYPE[\s\S]*?\[/i.test(xml)) {
    return 'DOCTYPE internal subsets are not allowed in JATS validation input.';
  }
  if ((xml.match(/<!DOCTYPE\b/gi) ?? []).length > 1) {
    return 'Multiple DOCTYPE declarations are not allowed in JATS validation input.';
  }
  return undefined;
}

function usePinnedDoctype(xml: string): string {
  const withoutDoctype = stripDoctypeDeclaration(xml);
  const doctype = `<!DOCTYPE article SYSTEM "${JATS_VALIDATION_DTD_FILE}">`;
  const declaration = /^\s*<\?xml[^>]*\?>/i;
  const match = withoutDoctype.match(declaration);

  if (!match || match.index === undefined) {
    return `${doctype}\n${withoutDoctype}`;
  }

  const offset = match.index + match[0].length;
  return `${withoutDoctype.slice(0, offset)}\n${doctype}${withoutDoctype.slice(offset)}`;
}

function stripDoctypeDeclaration(xml: string): string {
  const match = /<!DOCTYPE\b/i.exec(xml);
  if (!match || match.index === undefined) return xml;

  let quote: '"' | "'" | undefined;
  for (let index = match.index + match[0].length; index < xml.length; index += 1) {
    const character = xml[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') {
      return `${xml.slice(0, match.index)}${xml.slice(index + 1)}`;
    }
  }

  return xml;
}

async function ensurePinnedSchemaProvider(): Promise<void> {
  schemaProviderPromise ??= registerPinnedSchemaProvider();
  return schemaProviderPromise;
}

async function registerPinnedSchemaProvider(): Promise<void> {
  const files = await loadCompleteSchemaSet();
  const resources: Record<string, Uint8Array> = {};
  const encoder = new TextEncoder();

  for (const file of files) {
    const bytes = encoder.encode(file.contents);
    resources[file.fileName] = bytes;
    resources[`./${file.fileName}`] = bytes;
  }

  if (!resources[JATS_VALIDATION_DTD_FILE]) {
    throw new Error(
      `Pinned JATS schema package does not contain ${JATS_VALIDATION_DTD_FILE}.`,
    );
  }

  const provider = new XmlBufferInputProvider(resources);
  if (!xmlRegisterInputProvider(provider)) {
    throw new Error('Unable to register the in-memory JATS DTD resource provider.');
  }
}

/**
 * Loads the complete pinned JATS 1.4 DTD resource tree.
 *
 * The MathML modules use parameter-entity overrides where a generic SYSTEM
 * identifier in one module can be replaced by a JATS-specific local filename
 * in another. Loading the complete local tree lets libxml2 resolve those
 * declarations without network access.
 */
async function loadCompleteSchemaSet(): Promise<SchemaFile[]> {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve('@jats4r/dtds/package.json');
  const root = join(dirname(packageJson), 'schema', JATS_VALIDATION_VERSION);
  const files: SchemaFile[] = [];

  await collectSchemaFiles(root, '', files);
  files.sort((left, right) => left.fileName.localeCompare(right.fileName));

  return files;
}

async function collectSchemaFiles(
  directory: string,
  relativeDirectory: string,
  files: SchemaFile[],
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const absolute = join(directory, entry.name);
    const relativeName = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      await collectSchemaFiles(absolute, relativeName, files);
      continue;
    }

    if (!entry.isFile() || !/\.(?:dtd|ent|mod)$/i.test(entry.name)) {
      continue;
    }

    files.push({
      fileName: relativeName,
      contents: await readFile(absolute, 'utf8'),
    });
  }
}

function sanitizeDiagnosticMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 2000);
}
