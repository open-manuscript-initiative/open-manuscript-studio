/**
 * Remove Studio API secrets from inherited PDF parsing/rendering process
 * environments. This reduces accidental credential disclosure in diagnostics
 * and any parser process compromise. It is NOT a filesystem/network sandbox:
 * a child still runs with the same OS user until #774 / #765 are deployed.
 *
 * The allowed variables supply executable lookup, OS basics, language/font
 * discovery and (for Vivliostyle/Chromium) local cache/runtime directories.
 */
const BASE_RUNTIME_KEYS = [
  'PATH', 'Path', 'PATHEXT',
  'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'LC_MESSAGES',
  'TZ',
  'TMP', 'TEMP', 'TMPDIR',
  'SystemRoot', 'SYSTEMROOT', 'WINDIR',
] as const;

const RENDERER_RUNTIME_KEYS = [
  'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
  'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
  'XDG_RUNTIME_DIR', 'XDG_DATA_DIRS', 'XDG_CONFIG_DIRS',
  'FONTCONFIG_FILE', 'FONTCONFIG_PATH',
] as const;

const BASE_ALLOWED = new Set<string>(BASE_RUNTIME_KEYS);
const RENDERER_ALLOWED = new Set<string>([...BASE_RUNTIME_KEYS, ...RENDERER_RUNTIME_KEYS]);

export type PdfWorkerKind = 'poppler' | 'vivliostyle';

export function buildPdfWorkerEnvironment(
  kind: PdfWorkerKind,
  source: Readonly<NodeJS.ProcessEnv> = process.env,
): NodeJS.ProcessEnv {
  const allowed = kind === 'poppler' ? BASE_ALLOWED : RENDERER_ALLOWED;
  const result: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string') continue;
    if (allowed.has(key)) result[key] = value;
  }
  return result;
}
