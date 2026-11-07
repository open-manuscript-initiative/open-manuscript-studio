import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REQUIRED_WORKFLOWS } from './aggregate-rc-evidence.mjs';
import { RC_MANUAL_GATES, RC_WORKFLOWS } from './rc-evidence.mjs';
import { checksumManifest, hashReleaseAssets } from './prepare-release-assets.mjs';

export function selectAcceptanceBuild(report, expectedSha) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '') ||
      report?.reviewedSha !== expectedSha || report?.schemaVersion !== 1 ||
      report.kind !== 'studio-1.0-rc-evidence-inventory' ||
      !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(report.repository ?? '') ||
      report.status !== 'ready-for-manual-review' ||
      !Array.isArray(report.failures) || report.failures.length !== 0 ||
      !Array.isArray(report.workflows) || report.workflows.length !== REQUIRED_WORKFLOWS.length ||
      new Set(report.workflows.map(item => item.workflow)).size !== REQUIRED_WORKFLOWS.length ||
      REQUIRED_WORKFLOWS.some(spec => !report.workflows.some(item =>
        item.workflow === spec.id && item.status === 'pass' && item.sha === expectedSha &&
        Number.isSafeInteger(item.runId) && item.runId > 0))) {
    throw new Error('RC_ACCEPTANCE_E02_NOT_READY');
  }
  return report.workflows.find(item => item.workflow === 'tauri-desktop.yml').runId;
}

export function createRcAcceptanceDraft(report, expectedSha, artifacts) {
  const buildRunId = selectAcceptanceBuild(report, expectedSha);
  return {
    format: 'omi-studio-rc-evidence', version: '1', sourceSha: expectedSha, buildRunId,
    owner: '', reviewedAt: '', artifacts,
    workflows: RC_WORKFLOWS.map(path => ({ path,
      runId: report.workflows.find(item => path === '.github/workflows/' + item.workflow).runId })),
    gates: RC_MANUAL_GATES.map(id => ({ id, status: 'pending', sourceSha: expectedSha,
      observedAt: '', evidenceRef: '' })),
  };
}

export async function prepareRcAcceptance(report, expectedSha, assetDirectory, outputDirectory) {
  selectAcceptanceBuild(report, expectedSha);
  const hashes = await hashReleaseAssets(assetDirectory);
  const draft = createRcAcceptanceDraft(report, expectedSha, hashes);
  const rows = draft.gates.map(gate => '| ' + gate.id + ' | PENDING |');
  const instructions = [
    '# RC acceptance: evidence collected, manual decision pending', '',
    'Source SHA: `' + expectedSha + '`',
    'Native build: https://github.com/' + report.repository + '/actions/runs/' + draft.buildRunId, '',
    'The JSON contains all seven actual installer hashes and exact workflow IDs.',
    'SHA256SUMS identifies bytes; it does not verify an installer signature or update channel.',
    'No manual gate, signature, physical-device test or owner decision has been approved.', '',
    '| Manual gate | Status |', '| --- | --- |', ...rows, '',
    'Keep the JSON private while completing owner, reviewedAt, and actual gate observations.',
    'Each pass needs the same source SHA, a real UTC timestamp, and an HTTPS redacted evidence reference.',
    'Do not infer pass from a closed issue, the build result or an old device test.',
    'The existing publication validator deliberately rejects this pending draft.',
    'Follow docs/release/2026-11-04-rc1-final-acceptance.md for platform signature and recovery checks.', '',
  ].join('\n');
  await writeFile(join(outputDirectory, 'acceptance-draft.json'), JSON.stringify(draft, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(outputDirectory, 'SHA256SUMS.txt'), checksumManifest(hashes), { flag: 'wx' });
  await writeFile(join(outputDirectory, 'acceptance-next-steps.md'), instructions, { flag: 'wx' });
  return draft;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--select-build' && args.length === 3) {
    const report = JSON.parse(await readFile(args[1], 'utf8'));
    const runId = selectAcceptanceBuild(report, args[2]);
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
    await appendFile(process.env.GITHUB_OUTPUT, 'build_run_id=' + runId + '\n');
    return;
  }
  if (args.length !== 4) throw new Error('Usage: prepare-rc-acceptance.mjs <report.json> <reviewed-sha> <assets-directory> <existing-output-directory>');
  const report = JSON.parse(await readFile(args[0], 'utf8'));
  await prepareRcAcceptance(report, args[1], resolve(args[2]), resolve(args[3]));
  console.log(`RC acceptance draft prepared; all ${RC_MANUAL_GATES.length} manual gates remain pending.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
