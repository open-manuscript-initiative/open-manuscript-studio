import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPdfSubprocess } from '../security/pdfSubprocess.js';
import { MAX_EPUB_CHECK_BYTES } from '../security/pdfWorkerTransport.js';

/** Invoked ONLY inside the isolated, network-denied worker. No API secrets. */
export async function executeEpubCheck(bytes: Buffer): Promise<Buffer> {
  if (bytes.length < 4 || bytes.length > MAX_EPUB_CHECK_BYTES || bytes.readUInt32LE(0) !== 0x04034b50)
    throw new Error('Invalid EPUB envelope.');
  const directory = await mkdtemp(join(tmpdir(), 'omi-epubcheck-'));
  try {
    const input = join(directory, 'input.epub'), report = join(directory, 'report.json');
    await writeFile(input, bytes, { flag: 'wx', mode: 0o600 });
    const result = await runPdfSubprocess('/usr/bin/java', [
      '-Xmx512m', '-Djava.io.tmpdir=' + directory, '-Duser.home=' + directory,
      '-jar', '/opt/epubcheck/epubcheck.jar', '--json', report, '--failonwarnings', input,
    ], { cwd: directory, timeoutMs: 90_000, maxOutputChars: 8192,
      env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', HOME: directory, TMPDIR: directory } });
    if (![0, 1].includes(result.exitCode)) throw new Error('EPUBCheck runtime failed.');
    const info = await stat(report);
    if (!info.isFile() || info.size < 1 || info.size > 4 * 1024 * 1024) throw new Error('Invalid EPUBCheck report.');
    return parseEpubCheckReport(JSON.parse(await readFile(report, 'utf8')), bytes, result.exitCode);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** EPUBCheck 5.x serializes CheckerMetadata.checkerVersion, not version. */
export function parseEpubCheckReport(raw: unknown, bytes: Buffer, exitCode: number): Buffer {
  if (![0, 1].includes(exitCode)) throw new Error('EPUBCheck runtime failed.');
  if (!raw || typeof raw !== 'object') throw new Error('Unsupported EPUBCheck report.');
  const parsed = raw as { checker?: { checkerVersion?: unknown }; messages?: unknown };
  const version = parsed.checker?.checkerVersion;
  if (typeof version !== 'string' || !/^5\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/.test(version) || !Array.isArray(parsed.messages))
    throw new Error('Unsupported EPUBCheck report.');
  // Only bounded codes; never return input text, file paths or raw subprocess logs.
  const codes = [...new Set(parsed.messages.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const message = entry as { ID?: unknown; id?: unknown };
    const code = message.ID ?? message.id;
    return typeof code === 'string' && /^[A-Z]{2,5}-[0-9]{3}[a-z]?$/.test(code) ? [code] : [];
  }))].slice(0, 50);
  return Buffer.from(JSON.stringify({ protocol: 'omi-epubcheck/1', version,
    sha256: createHash('sha256').update(bytes).digest('hex'), valid: exitCode === 0, codes }));
}
