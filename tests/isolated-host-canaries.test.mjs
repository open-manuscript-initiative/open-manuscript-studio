import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const folder = new URL('../scripts/acceptance/', import.meta.url);
const path = (name) => new URL(name, folder).pathname;
const read = (name) => readFileSync(path(name), 'utf8');

test('host canary shell is syntactically valid and leaves real services untouched', () => {
  const result = spawnSync('bash', ['-n', path('run-isolated-host-probes.sh')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const source = read('run-isolated-host-probes.sh');
  assert.match(source, /--wait --pipe --collect/);
  assert.match(source, /PrivateNetwork=yes/);
  assert.match(source, /omi-egress-base-/);
  assert.match(source, /omi-egress-filter-/);
  assert.match(source, /omi-pdf-canary-/);
  assert.match(source, /suffix="\$\(date -u \+%s\)-\$\{BASHPID\}"/);
  assert.doesNotMatch(source, /suffix="\$\(date -u \+%s\)-\$"/);
  assert.match(source, /IPAddressDeny=\$deny/);
  assert.doesNotMatch(source, /\bsystemctl\s+(?:stop|start|restart|enable|disable)\b/);
  assert.doesNotMatch(source, /\bnft\s+(?:add|delete|flush)\b/);
});

test('network canary validates its own namespace and uses synthetic listeners', () => {
  const source = read('probe-private-net.py');
  assert.match(source, /\/proc\/self\/ns\/net/);
  assert.match(read('run-isolated-host-probes.sh'), /\/proc\/1\/ns\/net/);
  assert.match(read('run-isolated-host-probes.sh'), /OMI_HOST_NETNS_INODE/);
  assert.match(source, /OMI_HOST_NETNS_INODE/);
  assert.match(source, /mode == "baseline"/);
  assert.match(source, /rfc1918_v4/);
  assert.match(source, /ula_v6/);
  assert.doesNotMatch(source, /169\.254\.169\.254/);
  const result = spawnSync('python3', [
    '-c', 'import ast,sys;ast.parse(open(sys.argv[1]).read())',
    path('probe-private-net.py'),
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('PDF stage probe checks timeout and process recovery with deployed executor', () => {
  const source = read('probe-pdf-timeout.mjs');
  assert.match(source, /\/opt\/omi-pdf-worker\/security\/pdfSubprocess\.js/);
  assert.match(source, /PdfSubprocessTimeoutError/);
  assert.match(source, /waitStopped/);
  assert.match(source, /subsequentJobRecovery/);
  const result = spawnSync(process.execPath, ['--check', path('probe-pdf-timeout.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});


test('network namespace canary requires a trusted host inode and refuses host namespace', () => {
  const script = [
    'import importlib.util, os, sys',
    'from unittest.mock import patch',
    'from types import SimpleNamespace',
    'spec = importlib.util.spec_from_file_location("omi_probe", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'with patch.dict(module.os.environ, {"OMI_HOST_NETNS_INODE": "222"}), patch.object(module.os, "stat", return_value=SimpleNamespace(st_ino=111)), patch.object(module.socket, "if_nameindex", return_value=[(1, "lo")]):',
    '    module.verify_namespace()',
    'with patch.dict(module.os.environ, {}, clear=True), patch.object(module.os, "stat", return_value=SimpleNamespace(st_ino=111)), patch.object(module.socket, "if_nameindex", return_value=[(1, "lo")]):',
    '    try: module.verify_namespace(); assert False, "missing host inode accepted"',
    '    except RuntimeError: pass',
    'with patch.dict(module.os.environ, {"OMI_HOST_NETNS_INODE": "111"}), patch.object(module.os, "stat", return_value=SimpleNamespace(st_ino=111)), patch.object(module.socket, "if_nameindex", return_value=[(1, "lo")]):',
    '    try: module.verify_namespace(); assert False, "same host namespace accepted"',
    '    except RuntimeError: pass',
    'with patch.dict(module.os.environ, {"OMI_HOST_NETNS_INODE": "222"}), patch.object(module.os, "stat", return_value=SimpleNamespace(st_ino=111)), patch.object(module.socket, "if_nameindex", return_value=[(1, "lo"), (2, "ens6")]):',
    '    try: module.verify_namespace(); assert False, "host-like interfaces accepted"',
    '    except RuntimeError: pass',
  ].join('\n');
  const result = spawnSync('python3', ['-c', script, path('probe-private-net.py')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('network canary errors include a fixed stage and never claim PASS', () => {
  const result = spawnSync('python3', [path('probe-private-net.py'), 'invalid-mode'], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  const data = JSON.parse(result.stdout.trim());
  assert.deepEqual(data, {
    result: 'INCONCLUSIVE',
    stage: 'argument-validation',
    reason: 'ValueError',
  });
});
