import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreExtensionCases, extensionSpecifications, runCoreExtensionCases } from '../tests/coreExtensionCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/verify-core-extensions.ts', 'tests/coreExtensionCases.ts',
  'tests/core-extension.test.ts', 'tests/testManuscriptFixture.ts',
  'src/model/scholarlyMetadata.ts', 'src/model/metadataConversion.ts',
  'src/model/publicationFrames.ts', 'src/model/translation.ts',
  'src/model/coreSnapshotValidator.mjs', 'src/model/validation.ts',
  'src/model/versioning.ts', 'src/model/workingState.ts',
  'src/app/scholarlyMetadataActions.ts', 'src/app/useStudioStore.ts',
  'src/integrations/ojs/importOjsLaunchLocalized.ts', 'src/integrations/ojs/importOjsLaunch.ts',
  'src/services/exportDocx.ts', 'src/services/exportOdt.ts',
  'src/services/coreModelReview.ts', 'src/services/manuscriptValidation.ts',
  'src/services/exchangeSession.ts', 'src/services/omiPortableFormat.ts',
  'src/services/exportOmi.ts',
];

export async function verifyCoreExtensions() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  const results = await runCoreExtensionCases();
  const ids = [...new Set(coreExtensionCases.flatMap(item => item.requirements))].sort();
  if (new Set(results.map(item => item.id)).size !== results.length || results.length !== 12) throw new Error('Incomplete extension suite.');
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0',
    suite: 'studio-core-extensions-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    sourceCommit, sourceFiles, specifications: extensionSpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial',
      cases: results.filter(item => item.requirements.includes(id)).map(item => item.id),
    })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    exclusions: ['all-extension-profiles-and-vocabularies', 'semantic-interpretation-of-foreign-extensions',
      'complete-metadata-profile-and-cardinality-coverage', 'all-import-export-adapters',
      'external-profile-resolution', 'all-server-authorization-paths',
      'independent-interoperability', 'stable-conformance'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreExtensions();
  console.log(`Core extension evidence: ${report.results.length} cases pass; ${report.requirements.length} partially evidenced requirements; normative outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const path = resolve(process.argv[index + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
}
