import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreRelationshipCases, relationshipSpecifications, runCoreRelationshipCases } from '../tests/coreRelationshipCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  "scripts/verify-core-relationships.ts",
  "tests/coreRelationshipCases.ts",
  "tests/core-relationships.test.ts",
  "tests/testManuscriptFixture.ts",
  "tests/ts-extension-loader.mjs",
  "tests/register-ts-extension-loader.mjs",
  "src/model/publicationSemanticLoss.ts",
  "src/model/sourceAttributionExport.ts",
  "src/model/publicationAnnotations.ts",
  "src/model/manuscriptTreeTraversal.ts",
  "src/model/notes.ts",
  "src/model/inlineSemantics.ts",
  "src/model/versioning.ts",
  "src/model/metadataConversion.ts",
  "src/model/publicationRendering.ts",
  "src/model/publicationProfile.ts",
  "src/services/exportOmi.ts",
  "src/services/omiPortableFormat.ts",
  "src/services/exportHtml.ts",
  "src/services/exportJats.ts",
  "src/services/exportDocx.ts",
  "src/services/exportOdt.ts",
  "src/services/exportIdml.ts",
  "src/services/exportXtg.ts",
  "src/services/exportMif.ts",
  "src/services/exportSla.ts",
  "src/services/exportLatex.ts",
  "src/services/exportEpub.ts",
  "src/services/exportTextUtils.ts",
  "src/services/simpleZip.ts",
  "src/services/exchangeSession.ts"
];

export async function verifyCoreRelationships() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  const results = await runCoreRelationshipCases();
  const ids = [...new Set(coreRelationshipCases.flatMap(item => item.requirements))].sort();
  if (new Set(results.map(item => item.id)).size !== results.length || results.length !== 12) throw new Error('Incomplete relationship suite.');
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0',
    suite: 'studio-core-relationships-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    observationProfile: 'studio-semantic-relationships-0.1',
    sourceCommit, sourceFiles, specifications: relationshipSpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial',
      cases: results.filter(item => item.requirements.includes(id)).map(item => item.id),
    })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    exclusions: ['all-format-semantic-equivalence', 'all-malformed-or-orphan-relationships',
      'complete-epub-note-implementation', 'external-editor-rendering-and-roundtrip',
      'all-nested-object-roles', 'browser-and-native-ui-acceptance',
      'independent-interoperability', 'stable-conformance'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreRelationships();
  console.log(`Core relationship evidence: ${report.results.length} cases pass; ${report.requirements.length} partially evidenced requirements; normative outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const path = resolve(process.argv[index + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
}
