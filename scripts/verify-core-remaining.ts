import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreRemainingCases, remainingRequirementIds, remainingSpecifications, runCoreRemainingCases } from '../tests/coreRemainingCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'package.json', 'package-lock.json', '.github/workflows/core-remaining.yml',
  'scripts/verify-core-remaining.ts', 'scripts/check-core-import-boundaries.mjs',
  'tests/coreRemainingCases.ts', 'tests/core-remaining.test.ts', 'tests/testManuscriptFixture.ts',
  'tests/ts-extension-loader.mjs', 'tests/register-ts-extension-loader.mjs',
  'src/model/versioning.ts', 'src/model/workingState.ts', 'src/model/stateDigest.ts',
  'src/model/conformance.ts', 'src/model/coreSnapshotValidator.mjs', 'src/model/omiFormatConstants.ts',
  'src/model/publicationRendering.ts', 'src/model/publicationProfile.ts', 'src/model/translation.ts',
  'src/app/paragraphBlockActions.ts', 'src/app/useStudioStore.ts',
  'src/components/publicationPageLayout.ts', 'src/editor/collaborationDocument.ts',
  'src/editor/continuousManuscriptDocument.ts', 'src/document/migrateVersioningModel.ts',
  'src/services/exportOmi.ts', 'src/services/omiPortableFormat.ts', 'src/services/coreModelReview.ts',
  'src/services/machineTranslationSuggestions.ts', 'src/services/translationCommands.ts',
  'src/services/exportHtml.ts', 'src/services/exportJats.ts', 'src/services/exportXtg.ts',
];
export async function verifyCoreRemaining() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  // A report may only attest committed tested code; its own output stays outside source scope.
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--',
    'src', 'scripts', 'tests', 'package.json', 'package-lock.json', '.github/workflows/core-remaining.yml',
  ], { cwd: root, encoding: 'utf8' }).trim()) {
    throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  }
  const results = await runCoreRemainingCases();
  const ids = [...new Set(coreRemainingCases.flatMap(c => c.requirements))].sort();
  if (results.length !== 22 || new Set(results.map(c => c.id)).size !== 22 || JSON.stringify(ids) !== JSON.stringify(remainingRequirementIds)) {
    throw new Error('The remaining-core suite must cover the exact eleven requirement IDs with 22 distinct cases.');
  }
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0', suite: 'studio-core-remaining-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    observationProfile: 'studio-remaining-core-0.1', sourceCommit, sourceFiles,
    specifications: remainingSpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial', cases: results.filter(c => c.requirements.includes(id)).map(c => c.id) })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    scope: 'Real local model/store operations, production Yjs document initialization and in-memory Yjs transport, selected HTML/JATS/XTG projections, claim gates, and explicitly invoked migration.',
    serviceDoubles: ['DeepL-compatible synthetic response; no remote provider execution', 'Translation checkpoint port; explicit real versioning commit after draft acceptance'],
    exclusions: [
      'independent-implementation-or-cross-vendor-interoperability', 'deployed-release-or-live-network-authorization',
      'all-agent-provider-and-editorial-acceptance-policies', 'all-editor-split-merge-and-replacement-paths',
      'authenticated-collaboration-ui-projection-and-live-persistence', 'all-adapter-accessibility-and-screen-reader-testing',
      'all-legacy-format-migrations', 'stable-conformance-or-lifecycle-promotion',
    ],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreRemaining();
  console.log(`Core remaining evidence: ${report.results.length} cases pass; ${report.requirements.length} requirements partially evidenced; outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const destination = resolve(process.argv[index + 1]);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(report, null, 2)+'\n');
  }
}
