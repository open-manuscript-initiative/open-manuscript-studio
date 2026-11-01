import { spawn, type ChildProcess } from 'node:child_process';

const MAX_TERMINATION_WAIT_MS = 5_000;

export interface PdfSubprocessOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxOutputChars: number;
}

export interface PdfSubprocessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class PdfSubprocessTimeoutError extends Error {
  constructor() {
    super('PDF subprocess timed out and its process group was terminated.');
    this.name = 'PdfSubprocessTimeoutError';
  }
}

function terminatePdfProcessTree(child: ChildProcess): void {
  // Only POSIX children launched detached are session/process-group leaders.
  // A negative PID is NEVER safe for a non-detached child.
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
      return;
    } catch {
      // The process group may already be gone; try the direct child below.
    }
  }
  try { child.kill('SIGKILL'); } catch { /* child already exited */ }
}

/**
 * The Linux PDF worker launches Poppler/Vivliostyle in a private process group.
 * On timeout or parent exit, signal the whole group, including Chrome children.
 * Windows remains a direct-child fallback (no negative-PID group signals).
 * The group is still contained by systemd's KillMode=control-group on shutdown.
 */
export function runPdfSubprocess(
  command: string,
  args: readonly string[],
  options: PdfSubprocessOptions,
): Promise<PdfSubprocessResult> {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0
    || !Number.isSafeInteger(options.maxOutputChars) || options.maxOutputChars < 1) {
    throw new Error('Invalid PDF subprocess limits.');
  }

  return new Promise<PdfSubprocessResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const appendBounded = (current: string, next: string) =>
      (current + next).slice(-options.maxOutputChars);

    const child = spawn(command, [...args], {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      // setsid() on POSIX; direct and descendant processes share this PGID
      // unless they deliberately create their own session.
      detached: process.platform !== 'win32',
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (error?: Error, result?: PdfSubprocessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error('PDF subprocess completed without a result.'));
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      terminatePdfProcessTree(child);
      // An escaped descendant may keep stdout/stderr pipes open. Bound the
      // post-SIGKILL wait instead of allowing one request to hang forever.
      cleanupTimer = setTimeout(() => finish(new PdfSubprocessTimeoutError()), MAX_TERMINATION_WAIT_MS);
      cleanupTimer.unref();
    }, options.timeoutMs);
    timeout.unref();

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk.toString('utf8'));
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk.toString('utf8'));
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      terminatePdfProcessTree(child);
      finish(error);
    });
    child.once('exit', () => {
      // 'close' waits for stdout/stderr: an orphaned browser may still hold
      // inherited pipe descriptors. Kill descendants at parent exit first.
      if (process.platform !== 'win32') terminatePdfProcessTree(child);
    });
    child.once('close', (exitCode) => {
      // A CLI may exit 0 while leaving a background Chrome descendant.
      if (process.platform !== 'win32') terminatePdfProcessTree(child);
      if (timedOut) finish(new PdfSubprocessTimeoutError());
      else finish(undefined, { exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}
