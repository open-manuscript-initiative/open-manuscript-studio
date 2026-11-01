import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as pause } from 'node:timers/promises';
import { PdfSubprocessTimeoutError, runPdfSubprocess } from './pdfSubprocess.js';

const options = (cwd: string, timeoutMs = 2_000) => ({
  cwd,
  timeoutMs,
  maxOutputChars: 64 * 1024,
  env: process.env,
});

// Linux /proc state Z indicates a terminated zombie waiting for reaping:
// it cannot run or keep a CPU/memory-consuming Chrome child alive.
async function isExecuting(pid: number): Promise<boolean> {
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (stat === null) return false;
  const state = stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3);
  return state !== 'Z' && state !== 'X';
}

async function waitForStopped(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!(await isExecuting(pid))) return;
    await pause(100);
  }
  assert.fail(`PDF subprocess descendant ${pid} remained alive after SIGKILL`);
}

test('PDF subprocess preserves bounded output and direct-process exit codes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'omi-pdf-process-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const result = await runPdfSubprocess(process.execPath, ['-e', 'process.stdout.write("abcdefgh");process.exit(17)'], {
    ...options(directory),
    maxOutputChars: 4,
  });
  assert.equal(result.exitCode, 17);
  assert.equal(result.stdout, 'efgh');

  await assert.rejects(
    runPdfSubprocess('omi-pdf-nonexistent-command-for-test', [], options(directory)),
    (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT',
  );
});

test('timed-out PDF renderer kills its entire Linux process group and recovers', async (t) => {
  if (process.platform !== 'linux') return t.skip('POSIX group and /proc verification is Linux-specific');
  const directory = await mkdtemp(join(tmpdir(), 'omi-pdf-timeout-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = join(directory, 'pids.json');
  const script = [
    "const {spawn}=require('node:child_process');",
    "const {writeFileSync}=require('node:fs');",
    "const grandchild=spawn(process.execPath,['-e','setInterval(()=>{},10000)'],{stdio:'ignore'});",
    "writeFileSync(process.argv[1],JSON.stringify({parent:process.pid,grandchild:grandchild.pid}));",
    "setInterval(()=>{},10000);",
  ].join('');

  await assert.rejects(
    runPdfSubprocess(process.execPath, ['-e', script, marker], options(directory, 1_500)),
    PdfSubprocessTimeoutError,
  );

  const pids = JSON.parse(await readFile(marker, 'utf8')) as { parent: number; grandchild: number };
  assert.ok(pids.parent > 1 && pids.grandchild > 1);
  await waitForStopped(pids.parent);
  await waitForStopped(pids.grandchild);

  const recovered = await runPdfSubprocess(
    process.execPath,
    ['-e', 'process.stdout.write("recovered")'],
    options(directory),
  );
  assert.equal(recovered.exitCode, 0);
  assert.equal(recovered.stdout, 'recovered');
});

test('normal CLI exit also cleans up a background Linux grandchild', async (t) => {
  if (process.platform !== 'linux') return t.skip('POSIX group and /proc verification is Linux-specific');
  const directory = await mkdtemp(join(tmpdir(), 'omi-pdf-exit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = join(directory, 'pid');
  const script = [
    "const {spawn}=require('node:child_process');",
    "const {writeFileSync}=require('node:fs');",
    "const grandchild=spawn(process.execPath,['-e','setInterval(()=>{},10000)'],{stdio:'ignore'});",
    "grandchild.unref();writeFileSync(process.argv[1],String(grandchild.pid));",
  ].join('');

  const result = await runPdfSubprocess(process.execPath, ['-e', script, marker], options(directory));
  assert.equal(result.exitCode, 0);
  const grandchildPid = Number(await readFile(marker, 'utf8'));
  assert.ok(grandchildPid > 1);
  await waitForStopped(grandchildPid);
});
