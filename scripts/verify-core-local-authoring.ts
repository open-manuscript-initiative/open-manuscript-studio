import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreLocalAuthoringCases, localAuthoringSpecifications, runCoreLocalAuthoringCases } from '../tests/coreLocalAuthoringCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/verify-core-local-authoring.ts', 'tests/coreLocalAuthoringCases.ts',
  'tests/core-local-authoring.test.ts', 'tests/testManuscriptFixture.ts',
  'src/document/createBlankManuscript.ts', 'src/editor/emptyHeadingDeletion.ts',
  'src/model/importedDocumentSource.ts', 'src/model/manuscriptImportOrigin.ts',
  'src/model/manuscriptTreeTraversal.ts', 'src/model/versioning.ts', 'src/model/workingState.ts',
  'src/app/scholarlyMetadataActions.ts', 'src/app/useStudioStore.ts', 'src/app/visualBlockActions.ts',
  'src/app/documentSessions.ts', 'src/app/lastSessionPersistence.ts', 'src/app/documentCloseState.ts',
  'src/store/authStore.ts', 'src/services/documentSessionManager.ts',
  'src/services/manuscriptValidation.ts', 'src/services/omiPortableFormat.ts', 'src/services/exportOmi.ts',
];

export async function verifyCoreLocalAuthoring() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  const results = await runCoreLocalAuthoringCases();
  const ids = [...new Set(coreLocalAuthoringCases.flatMap(item => item.requirements))].sort();
  if (new Set(results.map(item => item.id)).size !== results.length || results.length !== 12) throw new Error('Incomplete local authoring suite.');
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0',
    suite: 'studio-core-local-authoring-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    observationProfile: 'studio-local-model-authoring-0.1',
    sourceCommit, sourceFiles, specifications: localAuthoringSpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial',
      cases: results.filter(item => item.requirements.includes(id)).map(item => item.id),
    })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    exclusions: ['complete-offline-app-installation-and-bootstrap', 'browser-and-native-ui-acceptance',
      'device-storage-and-crash-recovery', 'all-transport-apis', 'server-authorization-and-rights-clearance',
      'all-specialized-source-relationship-editors', 'independent-interoperability', 'stable-conformance'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreLocalAuthoring();
  console.log(`Core local authoring evidence: ${report.results.length} cases pass; ${report.requirements.length} partially evidenced requirements; normative outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const path = resolve(process.argv[index + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
}
