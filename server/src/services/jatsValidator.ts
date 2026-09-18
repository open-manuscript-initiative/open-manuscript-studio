import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, normalize, relative, sep } from 'node:path';
import { readFile } from 'node:fs/promises';

import { validateXML } from 'xmllint-wasm';

export const JATS_VALIDATION_VERSION = '1.4' as const;
export const JATS_VALIDATION_TAG_SET = 'articleauthoring' as const;
export const JATS_VALIDATION_SCHEMA = 'DTD' as const;
export const JATS_VALIDATION_VARIANT = 'MathML3' as const;
export const JATS_VALIDATION_DTD_FILE =
  'JATS-articleauthoring1-4-mathml3.dtd' as const;
export const JATS_VALIDATION_SCHEMA_PACKAGE = '@jats4r/dtds@0.0.10' as const;
export const JATS_VALIDATION_ENGINE = 'xmllint-wasm@5.3.0' as const;
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

interface PreloadFile {
  fileName: string;
  contents: string;
}

let schemaFilesPromise: Promise<PreloadFile[]> | undefined;

/**
 * Validates JATS 1.4 Article Authoring XML against the official MathML 3 DTD
 * packaged locally with the Studio server.
 *
 * The user-supplied DOCTYPE is never trusted. The validator rejects internal
 * entity declarations and replaces the external subset with the pinned local
 * JATS DTD before invoking libxml2 through WebAssembly with --nonet.
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

  const localXml = usePinnedDoctype(xml);
  const preload = await loadJatsSchemaFiles();

  const result = await validateXML({
    xml: {
      fileName: 'article.xml',
      contents: localXml,
    },
    schema: [],
    preload,
    modifyArguments: () => [
      '--noout',
      '--nonet',
      '--valid',
      'article.xml',
    ],
    initialMemoryPages: 512,
    maxMemoryPages: 4096,
  });

  return {
    standard: 'NISO JATS',
    version: JATS_VALIDATION_VERSION,
    tagSet: JATS_VALIDATION_TAG_SET,
    schema: JATS_VALIDATION_SCHEMA,
    schemaVariant: JATS_VALIDATION_VARIANT,
    schemaPackage: JATS_VALIDATION_SCHEMA_PACKAGE,
    engine: JATS_VALIDATION_ENGINE,
    valid: result.valid,
    diagnostics: result.errors.slice(0, 100).map((error) => ({
      code: 'dtd-validity-error',
      severity: 'error',
      message: sanitizeDiagnosticMessage(error.message),
      line: error.loc?.lineNumber,
    })),
  };
}

function invalid(
  code: JatsSchemaDiagnostic['code'],
  message: string,
): JatsSchemaValidationResult {
  return {
    standard: 'NISO JATS',
    version: JATS_VALIDATION_VERSION,
    tagSet: JATS_VALIDATION_TAG_SET,
    schema: JATS_VALIDATION_SCHEMA,
    schemaVariant: JATS_VALIDATION_VARIANT,
    schemaPackage: JATS_VALIDATION_SCHEMA_PACKAGE,
    engine: JATS_VALIDATION_ENGINE,
    valid: false,
    diagnostics: [{ code, severity: 'error', message }],
  };
}

function unsafeXmlReason(xml: string): string | undefined {
  if (/<!ENTITY\b/i.test(xml)) {
    return 'Custom XML entity declarations are not allowed in JATS validation input.';
  }
  if (/<!DOCTYPE[\s\S]*?\[/i.test(xml)) {
    return 'DOCTYPE internal subsets are not allowed in JATS validation input.';
  }
  return undefined;
}

function usePinnedDoctype(xml: string): string {
  const doctype =
    `<!DOCTYPE article SYSTEM "${JATS_VALIDATION_DTD_FILE}">`;
  const existing = /<!DOCTYPE\s+article\b[^>]*>/i;
  if (existing.test(xml)) return xml.replace(existing, doctype);

  const declaration = /^\s*<\?xml[^>]*\?>/i;
  const match = xml.match(declaration);
  if (!match) return `${doctype}\n${xml}`;
  const offset = match.index! + match[0].length;
  return `${xml.slice(0, offset)}\n${doctype}${xml.slice(offset)}`;
}

async function loadJatsSchemaFiles(): Promise<PreloadFile[]> {
  schemaFilesPromise ??= loadSchemaClosure();
  return schemaFilesPromise;
}

async function loadSchemaClosure(): Promise<PreloadFile[]> {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve('@jats4r/dtds/package.json');
  const root = join(dirname(packageJson), 'schema', JATS_VALIDATION_VERSION);
  const queue = [JATS_VALIDATION_DTD_FILE];
  const visited = new Set<string>();
  const files: PreloadFile[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    const normalized = normalizeRelativeSchemaPath(current);
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    const absolute = join(root, ...normalized.split('/'));
    assertInsideSchemaRoot(root, absolute);
    const contents = await readFile(absolute, 'utf8');
    files.push({ fileName: normalized, contents });

    for (const reference of collectExternalSchemaReferences(contents)) {
      const next = normalizeRelativeSchemaPath(
        join(dirname(normalized), reference).split(sep).join('/'),
      );
      if (!visited.has(next)) queue.push(next);
    }
  }

  return files;
}

function collectExternalSchemaReferences(contents: string): string[] {
  const references = new Set<string>();
  const pattern = /["']([^"'<>]+\.(?:dtd|ent|mod))["']/gi;
  for (const match of contents.matchAll(pattern)) {
    const reference = match[1]?.trim();
    if (
      reference &&
      !reference.includes('://') &&
      !isAbsolute(reference)
    ) {
      references.add(reference);
    }
  }
  return [...references];
}

function normalizeRelativeSchemaPath(value: string): string {
  const normalized = normalize(value).split(sep).join('/').replace(/^\.\//, '');
  if (
    !normalized ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new Error('JATS schema package contains an unsafe relative reference.');
  }
  return normalized;
}

function assertInsideSchemaRoot(root: string, target: string): void {
  const child = relative(root, target);
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    if (child) {
      throw new Error('JATS schema reference escaped the pinned schema directory.');
    }
  }
}

function sanitizeDiagnosticMessage(message: string): string {
  return message
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}
