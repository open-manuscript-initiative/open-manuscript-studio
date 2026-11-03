#!/usr/bin/env node
// Staging-only: test the deployed process-group executor in a new systemd
// cgroup/namespace as omi-pdf-worker, never through the production socket.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

if (process.platform !== 'linux' || process.getuid?.() === 0) {
  throw new Error('Linux non-root staging unit required');
}
const { runPdfSubprocess, PdfSubprocessTimeoutError } =
  await import('file:///opt/omi-pdf-worker/security/pdfSubprocess.js');
const dir = mkdtempSync(join(tmpdir(), 'omi-pdf-stage-'));
const options = (timeoutMs) => ({
  cwd: dir, timeoutMs, maxOutputChars: 4096,
  env: { PATH: '/opt/plesk/node/24/bin:/usr/bin:/bin' },
});
function running(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 1);
  let stat;
  try { stat = readFileSync('/proc/' + pid + '/stat', 'utf8'); }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
  const state = stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3);
  return state !== 'Z' && state !== 'X';
}
async function waitStopped(pid) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!running(pid)) return;
    await pause(100);
  }
  throw new Error('Synthetic child still running after process group timeout');
}
try {
  const marker = join(dir, 'children.json');
  const code = [
    "const {spawn}=require('node:child_process');",
    "const {writeFileSync}=require('node:fs');",
    "const child=spawn(process.execPath,['-e','setInterval(()=>{},10000)'],{stdio:'ignore'});",
    "writeFileSync(process.argv[1],JSON.stringify({parent:process.pid,grandchild:child.pid}));",
    "setInterval(()=>{},10000);",
  ].join('');
  await assert.rejects(
    runPdfSubprocess(process.execPath, ['-e', code, marker], options(1500)),
    PdfSubprocessTimeoutError,
  );
  const pids = JSON.parse(readFileSync(marker, 'utf8'));
  await waitStopped(pids.parent);
  await waitStopped(pids.grandchild);
  const recovered = await runPdfSubprocess(
    process.execPath, ['-e', 'process.stdout.write("recovered")'],
    options(3000),
  );
  assert.equal(recovered.exitCode, 0);
  assert.equal(recovered.stdout, 'recovered');
  console.log(JSON.stringify({
    deployedModuleTimeoutAndGrandchild: 'PASS',
    subsequentJobRecovery: 'PASS',
    result: 'PASS',
  }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
