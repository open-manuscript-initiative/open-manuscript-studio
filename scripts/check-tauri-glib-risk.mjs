import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * RUSTSEC-2024-0429 is an upstream GTK3/gtk-rs dependency constraint in Tauri
 * v2. This script does NOT suppress the advisory, edit Cargo.lock, or claim
 * that the vulnerable GLib binary is fixed. It records its status and fails
 * closed if the dependency chain changes unexpectedly.
 *
 * Report from src-tauri/Cargo.lock only; CI additionally runs cargo metadata
 * --locked, while the Linux Tauri workflow prints the actual cargo tree.
 */
export const ADVISORY = 'RUSTSEC-2024-0429';
export const GHSA = 'GHSA-wrw7-89jp-8q8g';
export const ISSUE = 'https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271';

export function lockedPackages(lockfile) {
  const packages = [];
  for (const part of lockfile.split('[[package]]').slice(1)) {
    const name = part.match(/(?:^|\n)name = "([^"]+)"(?:\r?\n|$)/)?.[1];
    const version = part.match(/(?:^|\n)version = "([^"]+)"(?:\r?\n|$)/)?.[1];
    if (name && version) packages.push({ name, version });
  }
  return packages;
}

export function glibVersionAffected(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  // Do not certify an unreleased 0.20.0 prerelease as security-fixed.
  if (major === 0 && minor === 20 && Number(match[3]) === 0 && match[4]) return null;
  // Advisory: introduced at glib 0.15.0; fixed in glib 0.20.0.
  // All 0.15/0.16/0.17/0.18/0.19 releases are affected.
  return major === 0 && minor >= 15 && minor < 20;
}

export function evaluateGlibRisk(lockfile) {
  const packages = lockedPackages(lockfile);
  const versions = (name) => packages.filter(p => p.name === name).map(p => p.version);
  const graph = Object.fromEntries(
    ['tauri','tauri-runtime-wry','wry','gtk','webkit2gtk','glib']
      .map(name => [name, versions(name)]),
  );
  const glib = graph.glib;
  const invalid = glib.some(v => glibVersionAffected(v) === null);
  const affected = glib.filter(v => glibVersionAffected(v) === true);
  const gtk3 = graph.gtk.some(v => /^0\.18\./.test(v));
  const webkitGtk4 = graph.webkit2gtk.some(v => /^2\./.test(v));
  const tauri2 = graph.tauri.some(v => /^2\./.test(v));
  const runtime2 = graph['tauri-runtime-wry'].some(v => /^2\./.test(v));
  const wryPresent = graph.wry.length > 0;

  let status;
  if (invalid || !tauri2 || !runtime2 || !wryPresent || (glib.length === 0 && gtk3)) {
    status = 'review-required';
  } else if (affected.length === 0) {
    // A candidate state, NOT an accepted fix: first verify the target-specific
    // tree and native Linux smoke tests before closing the Dependabot alert.
    status = 'candidate-fixed';
  } else if (gtk3 && webkitGtk4) {
    status = 'unresolved-upstream';
  } else {
    // E.g. a partial GTK4 migration retained an old glib transitive dep.
    status = 'review-required';
  }
  return { advisory: ADVISORY, ghsa: GHSA, issue: ISSUE,
    status, affected, graph, linuxGtk3Stack: gtk3 && webkitGtk4 };
}

export function renderGlibRisk(report) {
  const graph = report.graph;
  const rows = Object.entries(graph).map(([name, values]) =>
    '| ' + name + ' | ' + (values.length ? values.join(', ') : 'not locked') + ' |');
  const meaning = report.status === 'unresolved-upstream'
    ? 'OPEN: vulnerable glib remains in the Linux Tauri GTK3/WebKitGTK stack. Only the upstream transition can remove it safely. Do not dismiss Dependabot or mark the issue resolved.'
    : report.status === 'candidate-fixed'
      ? 'CANDIDATE: no affected glib version appears in this lockfile. Verify cargo tree, Linux native builds and integration tests before closing the issue.'
      : 'REVIEW REQUIRED: Tauri/GTK/glib graph is different from the documented upstream blocker. Review before merging; do not accept an unknown vulnerable path.';
  return [
    '### Tauri Linux glib dependency risk — ' + report.advisory,
    '',
    '**Status:** ' + report.status,
    '',
    meaning,
    '',
    '| Locked crate | Version |',
    '|---|---|',
    ...rows,
    '',
    'Issue: ' + ISSUE,
    'Advisory: https://osv.dev/vulnerability/' + ADVISORY,
    'Upstream GTK4 migration: https://github.com/tauri-apps/tauri/pull/14684',
    '',
    'This is a dependency inventory, **not** a security clearance for Linux binaries.',
    '',
  ].join('\n');
}

export function runGlibRiskCli(args = process.argv.slice(2), env = process.env) {
  const fileArg = args.indexOf('--lockfile');
  const source = fileArg < 0
    ? new URL('../src-tauri/Cargo.lock', import.meta.url)
    : args[fileArg + 1];
  if (!source) throw new Error('--lockfile must specify a file');
  const report = evaluateGlibRisk(readFileSync(source, 'utf8'));
  const markdown = renderGlibRisk(report);
  console.log(markdown);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, markdown + '\n');
  if (env.GITHUB_ACTIONS === 'true' && report.status !== 'candidate-fixed') {
    const annotation = report.status === 'unresolved-upstream' ? 'warning' : 'error';
    console.log('::' + annotation + ' file=src-tauri/Cargo.lock,title=' +
      ADVISORY + '::' + (report.status === 'unresolved-upstream'
        ? 'Known unresolved Linux glib ' + report.affected.join(', ') + '; issue #271 remains open.'
        : 'Tauri GTK/glib graph changed; security review required.'));
  }
  if (report.status === 'review-required') return 2;
  if (args.includes('--strict') && report.status !== 'candidate-fixed') return 3;
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runGlibRiskCli();
}
