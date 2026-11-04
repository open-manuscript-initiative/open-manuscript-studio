import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreExportPrivacyCases, exportPrivacySpecifications, runCoreExportPrivacyCases } from '../tests/coreExportPrivacyCases.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/verify-core-export-privacy.ts', 'tests/coreExportPrivacyCases.ts',
  'tests/core-export-privacy.test.ts', 'tests/testManuscriptFixture.ts',
  'src/services/omiPortableFormat.ts', 'src/services/omiContainer.ts',
  'src/services/exportOmi.ts', 'src/services/exportCustom.ts',
  'src/services/exportHtml.ts', 'src/services/exportJats.ts', 'src/services/exportPdf.ts',
  'src/services/exportDocx.ts', 'src/services/exportOdt.ts', 'src/services/exportIdml.ts',
  'src/services/exportEpub.ts', 'src/services/exportLatex.ts', 'src/services/exportMif.ts',
  'src/services/exportSla.ts', 'src/services/exportXtg.ts',
  'src/services/exportStandaloneHtml.ts', 'src/services/exportPublisherHtmlPackage.ts',
  'src/model/publicationAnnotations.ts', 'src/model/publicationRendering.ts',
];

export async function verifyCoreExportPrivacy() {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) throw new Error('Commit the tested source files before generating pinned implementation evidence.');
  const results = await runCoreExportPrivacyCases();
  const ids = [...new Set(coreExportPrivacyCases.flatMap(item => item.requirements))].sort();
  if (new Set(results.map(item => item.id)).size !== results.length || results.length !== 12) throw new Error('Incomplete export/privacy suite.');
  const sourceFiles = await Promise.all(paths.map(async path => ({ path,
    sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
  })));
  return {
    format: 'omi-studio-core-implementation-evidence', version: '0.1.0',
    suite: 'studio-core-export-privacy-0.1.0',
    repository: 'https://github.com/open-manuscript-initiative/open-manuscript-studio',
    sourceCommit, sourceFiles, specifications: exportPrivacySpecifications,
    environment: `${process.version}/${process.platform}/${process.arch}`, createdAt: new Date().toISOString(),
    results, requirements: ids.map(id => ({ id, status: 'partial',
      cases: results.filter(item => item.requirements.includes(id)).map(item => item.id),
    })),
    approved: false, independent: false, coverage: 'incomplete', outcome: 'indeterminate',
    exclusions: ['all-credential-encodings', 'opaque-string-and-binary-secrets',
      'all-extension-audience-policies', 'server-side-pdf-bytes',
      'browser-native-ui-acceptance', 'independent-interoperability', 'stable-conformance'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyCoreExportPrivacy();
  console.log(`Core export/privacy evidence: ${report.results.length} cases pass; ${report.requirements.length} partially evidenced requirements; normative outcome remains ${report.outcome}.`);
  const index = process.argv.indexOf('--report');
  if (index !== -1) {
    if (!process.argv[index + 1]) throw new Error('Missing --report destination.');
    const path = resolve(process.argv[index + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  }
}
