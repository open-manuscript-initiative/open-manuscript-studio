import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreAuthorityCases, authoritySpecifications, runCoreAuthorityCases } from '../tests/coreAuthorityCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/verify-core-authority.ts', 'tests/coreAuthorityCases.ts', 'tests/core-authority.test.ts',
  'tests/testManuscriptFixture.ts', 'tests/ts-extension-loader.mjs', 'tests/register-ts-extension-loader.mjs',
  'src/model/identity.ts', 'src/model/versioning.ts', 'src/model/scholarlyMetadata.ts',
  'src/app/useStudioStore.ts', 'src/store/authStore.ts', 'src/services/omiPortableFormat.ts',
  'src/services/exportOmi.ts', 'src/services/exportJats.ts', 'src/services/manuscriptValidation.ts',
  'server/src/services/collaborationPolicy.ts', 'server/src/services/collaborationTicketService.ts',
  'server/src/services/verifiedFederatedIdentity.ts',
];

export async function verifyCoreAuthority() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  const results = await runCoreAuthorityCases();
  const ids = [...new Set(coreAuthorityCases.flatMap(item => item.requirements))].sort();
  if (new Set(results.map(item => item.id)).size !== results.length || results.length !== 12) throw new Error('Incomplete authority suite.');
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0',
    suite: 'studio-core-authority-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    observationProfile: 'studio-authority-boundaries-0.1',
    persistence: 'in-memory-test-double; real service and policy modules',
    sourceCommit, sourceFiles, specifications: authoritySpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial',
      cases: results.filter(item => item.requirements.includes(id)).map(item => item.id),
    })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    exclusions: ['live-database-and-network-route-acceptance', 'all-service-authorization-paths',
      'sso-signature-and-real-world-identity-verification', 'complete-institution-admin-provisioning',
      'legal-rights-clearance', 'browser-and-native-ui-acceptance',
      'independent-interoperability', 'stable-conformance'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreAuthority();
  console.log(`Core authority evidence: ${report.results.length} cases pass; ${report.requirements.length} partially evidenced requirements; normative outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const path = resolve(process.argv[index + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
}
