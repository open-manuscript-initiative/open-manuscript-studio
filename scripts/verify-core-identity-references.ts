import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreIdentityReferenceCases, identityReferenceSpecifications, runCoreIdentityReferenceCases } from '../tests/coreIdentityReferenceCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/verify-core-identity-references.ts', 'tests/coreIdentityReferenceCases.ts',
  'tests/core-identity-reference.test.ts', 'tests/testManuscriptFixture.ts',
  'src/app/useStudioStore.ts', 'src/app/sectionActions.ts', 'src/app/visualBlockActions.ts',
  'src/model/crossReferences.ts', 'src/model/sectionStructure.ts', 'src/model/tombstone.ts',
  'src/model/versioning.ts', 'src/model/workingState.ts', 'src/types/omi.ts',
  'src/services/omiPortableFormat.ts', 'src/services/manuscriptValidation.ts',
];

export async function verifyCoreIdentityReferences() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  const results = await runCoreIdentityReferenceCases();
  const ids = [...new Set(coreIdentityReferenceCases.flatMap(item => item.requirements))].sort();
  if (new Set(results.map(item => item.id)).size !== results.length || results.length !== 12) throw new Error('Incomplete identity/reference suite.');
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0',
    suite: 'studio-core-identity-reference-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    sourceCommit, sourceFiles, specifications: identityReferenceSpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial',
      cases: results.filter(item => item.requirements.includes(id)).map(item => item.id),
    })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    exclusions: ['all-editing-paths', 'all-specialized-relationships', 'split-merge-equivalence',
      'browser-native-ui-acceptance', 'independent-interoperability', 'stable-conformance'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreIdentityReferences();
  console.log(`Core identity/reference evidence: ${report.results.length} cases pass; ${report.requirements.length} partially evidenced requirements; normative outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const path = resolve(process.argv[index + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
}
