import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { env } from '../config/env.js';

export const VIVLIOSTYLE_PDF_RENDERER = 'vivliostyle-cli' as const;
export const VIVLIOSTYLE_PDF_RENDERER_VERSION = '11.0.4' as const;
export const MAX_VIVLIOSTYLE_HTML_BYTES = 48 * 1024 * 1024;
export const MAX_VIVLIOSTYLE_PDF_BYTES = 96 * 1024 * 1024;

const MAX_PROCESS_OUTPUT_CHARS = 64 * 1024;
let rendererVersionPromise: Promise<string> | undefined;

export type VivliostylePdfErrorCode =
  | 'PDF_INPUT_UNSAFE'
  | 'PDF_RENDERER_UNAVAILABLE'
  | 'PDF_RENDER_FAILED';

export class VivliostylePdfError extends Error {
  readonly code: VivliostylePdfErrorCode;

  constructor(code: VivliostylePdfErrorCode, message: string) {
    super(message);
    this.name = 'VivliostylePdfError';
    this.code = code;
  }
}

export interface VivliostylePdfArtifact {
  bytes: Uint8Array;
  renderer: typeof VIVLIOSTYLE_PDF_RENDERER;
  rendererVersion: typeof VIVLIOSTYLE_PDF_RENDERER_VERSION;
}

/**
 * Render one self-contained, script-free HTML publication to PDF.
 *
 * Vivliostyle CLI is intentionally executed as an external tool instead of
 * being linked into Studio. The server accepts no remote subresources, so a
 * render cannot turn into an SSRF-capable web fetcher. Interactive <a> links
 * are allowed because they become PDF annotations and are not fetched during
 * rendering.
 */
export async function renderVivliostylePdf(
  html: string,
): Promise<VivliostylePdfArtifact> {
  const inputError = validateVivliostyleHtmlInput(html);
  if (inputError) {
    throw new VivliostylePdfError('PDF_INPUT_UNSAFE', inputError);
  }

  const rendererVersion = await resolveRendererVersion();
  const directory = await mkdtemp(join(tmpdir(), 'omi-vivliostyle-'));
  const inputPath = join(directory, 'article.html');
  const outputPath = join(directory, 'article.pdf');

  try {
    await writeFile(inputPath, html, { encoding: 'utf8', mode: 0o600 });

    const args = [
      'build',
      inputPath,
      '--single-doc',
      '--output',
      outputPath,
      '--timeout',
      String(env.VIVLIOSTYLE_TIMEOUT_SECONDS),
      '--log-level',
      'silent',
      '--no-vite-config-file',
    ];
    if (env.VIVLIOSTYLE_EXECUTABLE_BROWSER) {
      args.push('--executable-browser', env.VIVLIOSTYLE_EXECUTABLE_BROWSER);
    }

    const result = await runCommand(
      env.VIVLIOSTYLE_BIN,
      args,
      env.VIVLIOSTYLE_TIMEOUT_SECONDS * 1000 + 15_000,
      directory,
    );
    if (result.exitCode !== 0) {
      throw new VivliostylePdfError(
        'PDF_RENDER_FAILED',
        boundedMessage(
          result.stderr || result.stdout || `Vivliostyle exited with code ${result.exitCode}.`,
        ),
      );
    }

    const buffer = await readFile(outputPath).catch(() => undefined);
    if (!buffer || buffer.byteLength < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new VivliostylePdfError(
        'PDF_RENDER_FAILED',
        'Vivliostyle did not produce a valid PDF artifact.',
      );
    }
    if (buffer.byteLength > MAX_VIVLIOSTYLE_PDF_BYTES) {
      throw new VivliostylePdfError(
        'PDF_RENDER_FAILED',
        'The generated PDF exceeds the configured artifact size limit.',
      );
    }

    return {
      bytes: new Uint8Array(buffer),
      renderer: VIVLIOSTYLE_PDF_RENDERER,
      rendererVersion,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Returns an error message when input is unsuitable for the isolated renderer.
 */
export function validateVivliostyleHtmlInput(html: string): string | undefined {
  if (!html.trim()) return 'PDF source HTML must not be empty.';
  if (Buffer.byteLength(html, 'utf8') > MAX_VIVLIOSTYLE_HTML_BYTES) {
    return `PDF source HTML exceeds the ${MAX_VIVLIOSTYLE_HTML_BYTES / 1024 / 1024} MiB limit.`;
  }

  if (/<\s*(?:script|iframe|frame|object|embed|base|form)\b/i.test(html)) {
    return 'PDF source HTML contains an active or navigation-capable element.';
  }
  if (/<\s*link\b/i.test(html)) {
    return 'PDF source HTML must not load external link resources.';
  }
  if (/<\s*meta\b[^>]*http-equiv\s*=\s*(["'])?refresh\1?/i.test(html)) {
    return 'PDF source HTML must not contain refresh navigation.';
  }
  if (/@import\b/i.test(html)) {
    return 'PDF source CSS must not import external stylesheets.';
  }

  for (const match of html.matchAll(/\b(?:src|poster|data|xlink:href)\s*=\s*(["'])(.*?)\1/gi)) {
    const value = (match[2] ?? '').trim();
    if (!isEmbeddedResource(value)) {
      return `PDF source contains a non-embedded resource: ${safeExcerpt(value)}.`;
    }
  }

  for (const match of html.matchAll(/<\s*(?:image|use)\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    const value = (match[2] ?? '').trim();
    if (!isEmbeddedResource(value)) {
      return `PDF source SVG contains a non-embedded resource: ${safeExcerpt(value)}.`;
    }
  }

  for (const match of html.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) {
    const candidates = (match[2] ?? '')
      .split(',')
      .map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
      .filter(Boolean);
    if (candidates.some((candidate) => !isEmbeddedResource(candidate))) {
      return 'PDF source contains a non-embedded srcset resource.';
    }
  }

  for (const match of html.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)/gi)) {
    const value = (match[2] ?? match[3] ?? '').trim();
    if (!isEmbeddedResource(value)) {
      return `PDF source CSS contains a non-embedded resource: ${safeExcerpt(value)}.`;
    }
  }

  return undefined;
}

async function resolveRendererVersion(): Promise<typeof VIVLIOSTYLE_PDF_RENDERER_VERSION> {
  rendererVersionPromise ??= (async () => {
    const result = await runCommand(
      env.VIVLIOSTYLE_BIN,
      ['--version'],
      15_000,
      process.cwd(),
    );
    if (result.exitCode !== 0) {
      throw new VivliostylePdfError(
        'PDF_RENDERER_UNAVAILABLE',
        boundedMessage(result.stderr || result.stdout || 'Vivliostyle is unavailable.'),
      );
    }
    const match = `${result.stdout}\n${result.stderr}`.match(/\b(\d+\.\d+\.\d+)\b/);
    const version = match?.[1];
    if (version !== VIVLIOSTYLE_PDF_RENDERER_VERSION) {
      throw new VivliostylePdfError(
        'PDF_RENDERER_UNAVAILABLE',
        `Studio requires Vivliostyle CLI ${VIVLIOSTYLE_PDF_RENDERER_VERSION}; found ${version ?? 'an unknown version'}.`,
      );
    }
    return version;
  })();

  try {
    return await rendererVersionPromise as typeof VIVLIOSTYLE_PDF_RENDERER_VERSION;
  } catch (error) {
    rendererVersionPromise = undefined;
    throw error;
  }
}

function isEmbeddedResource(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('data:') || normalized.startsWith('#');
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCommand(
  command: string,
  args: readonly string[],
  timeoutMs: number,
  cwd: string,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(command, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        reject(
          new VivliostylePdfError(
            'PDF_RENDER_FAILED',
            'Vivliostyle PDF rendering timed out.',
          ),
        );
      }
    }, timeoutMs);
    timer.unref();

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk.toString('utf8'));
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk.toString('utf8'));
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const code = error.code === 'ENOENT'
        ? 'PDF_RENDERER_UNAVAILABLE'
        : 'PDF_RENDER_FAILED';
      reject(
        new VivliostylePdfError(
          code,
          error.code === 'ENOENT'
            ? `Vivliostyle executable was not found: ${command}.`
            : boundedMessage(error.message),
        ),
      );
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function appendBounded(current: string, next: string): string {
  const combined = current + next;
  return combined.length <= MAX_PROCESS_OUTPUT_CHARS
    ? combined
    : combined.slice(combined.length - MAX_PROCESS_OUTPUT_CHARS);
}

function boundedMessage(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 2000) || 'Vivliostyle PDF rendering failed.';
}

function safeExcerpt(value: string): string {
  return value.replace(/[\r\n\t]/g, ' ').slice(0, 120);
}
