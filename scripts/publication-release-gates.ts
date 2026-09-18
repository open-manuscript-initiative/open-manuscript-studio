import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OMI_JATS_CONFORMANCE_DTD,
  OMI_JATS_CONFORMANCE_MATRIX,
  OMI_JATS_CONFORMANCE_MATRIX_VERSION,
  OMI_JATS_CONFORMANCE_RENDERER_VERSION,
  OMI_JATS_CONFORMANCE_STANDARD,
  OMI_JATS_CONFORMANCE_TAG_SET,
  OMI_JATS_CONFORMANCE_VERSION,
  OMI_JATS_RELEASE_BLOCKING_DIAGNOSTICS,
} from '../src/model/jatsConformance.ts';
import {
  getJatsPublicationProfile,
  OMI_JATS4R_PROFILE_SCOPE,
  OMI_JATS4R_PROFILE_VERSION,
  OMI_JATS4R_UPSTREAM_REPOSITORY,
  OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
} from '../src/model/jatsPublicationProfiles.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface GateResult {
  id: string;
  status: 'pass' | 'fail';
  detail: string;
}

interface PublicationReleaseGateReport {
  schemaVersion: 1;
  generatedAt: string;
  target: {
    standard: string;
    version: string;
    tagSet: string;
    dtd: string;
    rendererVersion: string;
    matrixVersion: string;
    publicationProfile: {
      id: string;
      profileVersion: string;
      scope: string;
      upstreamRepository: string;
      upstreamSchematronVersion: string;
    };
  };
  capabilities: {
    total: number;
    stable: number;
    conditional: number;
    fallback: number;
    unsupported: number;
  };
  blockingDiagnostics: string[];
  passed: boolean;
  gates: GateResult[];
}

export async function evaluatePublicationReleaseGates(
  root = ROOT,
): Promise<PublicationReleaseGateReport> {
  const gates: GateResult[] = [];
  const ids = OMI_JATS_CONFORMANCE_MATRIX.map((item) => item.id);
  gates.push(gate(
    'matrix-unique-ids',
    new Set(ids).size === ids.length,
    `${ids.length} JATS conformance capabilities have unique ids.`,
  ));

  const invalidRequired = OMI_JATS_CONFORMANCE_MATRIX.filter(
    (item) =>
      item.releaseGate === 'required' &&
      (item.status === 'fallback' || item.status === 'unsupported'),
  );
  gates.push(gate(
    'required-capability-status',
    invalidRequired.length === 0,
    invalidRequired.length === 0
      ? 'Every mandatory release capability has a stable or conditional mapping.'
      : `Invalid required capabilities: ${invalidRequired.map((item) => item.id).join(', ')}.`,
  ));

  const blockingOwners = new Map<string, string[]>();
  for (const item of OMI_JATS_CONFORMANCE_MATRIX) {
    for (const code of item.blockingDiagnostics ?? []) {
      const owners = blockingOwners.get(code) ?? [];
      owners.push(item.id);
      blockingOwners.set(code, owners);
    }
  }
  const missingBlockingCodes = OMI_JATS_CONFORMANCE_MATRIX
    .filter(
      (item) =>
        item.releaseGate === 'blocks-on-use' &&
        (item.blockingDiagnostics?.length ?? 0) === 0,
    )
    .map((item) => item.id);
  const duplicateBlockingCodes = Array.from(blockingOwners.entries())
    .filter(([, owners]) => owners.length !== 1)
    .map(([code, owners]) => `${code} => ${owners.join(', ')}`);
  gates.push(gate(
    'blocking-diagnostic-ownership',
    missingBlockingCodes.length === 0 && duplicateBlockingCodes.length === 0,
    missingBlockingCodes.length === 0 && duplicateBlockingCodes.length === 0
      ? `${OMI_JATS_RELEASE_BLOCKING_DIAGNOSTICS.length} release-blocking diagnostics have one conformance owner each.`
      : `Missing: ${missingBlockingCodes.join(', ') || 'none'}; duplicates: ${duplicateBlockingCodes.join('; ') || 'none'}.`,
  ));

  const missingEvidence: string[] = [];
  for (const item of OMI_JATS_CONFORMANCE_MATRIX) {
    if (item.evidence.length === 0) {
      missingEvidence.push(`${item.id}: no evidence declared`);
      continue;
    }
    for (const path of item.evidence) {
      try {
        await access(resolve(root, path));
      } catch {
        missingEvidence.push(`${item.id}: ${path}`);
      }
    }
  }
  gates.push(gate(
    'capability-evidence',
    missingEvidence.length === 0,
    missingEvidence.length === 0
      ? 'Every conformance capability names repository test evidence.'
      : `Missing conformance evidence: ${missingEvidence.join('; ')}.`,
  ));

  const requiredFiles = [
    'docs/architecture/jats-1.4-conformance-matrix.md',
    'docs/architecture/jats-1.4-validation.md',
    'src/model/jatsConformance.ts',
    'src/services/jatsReleaseGate.ts',
    'src/services/publicationBuildSidecar.ts',
    'tests/jats-conformance.test.ts',
    'tests/jats-schema-validation.test.ts',
    'docs/architecture/jats4r-publication-profile.md',
    'src/model/jatsPublicationProfiles.ts',
    'src/services/jats4rProfileValidator.ts',
    'tests/jats4r-profile.test.ts',
  ];
  const missingFiles: string[] = [];
  for (const path of requiredFiles) {
    try {
      await access(resolve(root, path));
    } catch {
      missingFiles.push(path);
    }
  }
  gates.push(gate(
    'publication-release-files',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? `${requiredFiles.length} publication-release files are present.`
      : `Missing publication-release files: ${missingFiles.join(', ')}.`,
  ));

  const ci = await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8');
  const readiness = await readFile(
    resolve(root, '.github/workflows/1.0-readiness.yml'),
    'utf8',
  );
  const ciMarkers = [
    'npm run test:jats-validation',
    'npm run test:jats4r-profile',
    'npm run test:vivliostyle-pdf',
    'npm run test:publication-release',
  ];
  const readinessMarkers = [
    'npm run test:jats-validation',
    'npm run test:jats4r-profile',
    'npm run test:publication-release',
    'publication-release.json',
  ];
  const missingWorkflowMarkers = [
    ...ciMarkers
      .filter((marker) => !ci.includes(marker))
      .map((marker) => `ci.yml: ${marker}`),
    ...readinessMarkers
      .filter((marker) => !readiness.includes(marker))
      .map((marker) => `1.0-readiness.yml: ${marker}`),
  ];
  gates.push(gate(
    'workflow-enforcement',
    missingWorkflowMarkers.length === 0,
    missingWorkflowMarkers.length === 0
      ? 'Primary CI and 1.0 readiness both enforce publication-release gates.'
      : `Missing workflow markers: ${missingWorkflowMarkers.join('; ')}.`,
  ));

  const exportPanel = await readFile(
    resolve(root, 'src/components/ExportFormatsPanel.tsx'),
    'utf8',
  );
  const jatsPanel = await readFile(
    resolve(root, 'src/components/JatsExportPanel.tsx'),
    'utf8',
  );
  const exportMarkers = [
    'validateJats4rProfile',
    'evaluateJatsPublicationRelease',
    'savePublicationArtifactWithBuildSidecar',
  ];
  const exportMissing = exportMarkers.flatMap((marker) => [
    ...(exportPanel.includes(marker) ? [] : [`ExportFormatsPanel: ${marker}`]),
    ...(jatsPanel.includes(marker) ? [] : [`JatsExportPanel: ${marker}`]),
  ]);
  gates.push(gate(
    'runtime-release-boundary',
    exportMissing.length === 0,
    exportMissing.length === 0
      ? 'Both JATS export surfaces enforce release policy before provenance delivery.'
      : `Missing runtime release markers: ${exportMissing.join('; ')}.`,
  ));

  const jats4r = getJatsPublicationProfile('jats4r');
  gates.push(gate(
    'jats4r-profile-definition',
    jats4r.implemented &&
      jats4r.releaseBlocking &&
      jats4r.source === OMI_JATS4R_UPSTREAM_REPOSITORY &&
      jats4r.sourceVersion === OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
    jats4r.implemented
      ? `JATS4R profile ${OMI_JATS4R_PROFILE_VERSION} is pinned to ${OMI_JATS4R_UPSTREAM_REPOSITORY}@${OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION}.`
      : 'The JATS4R publication profile is not implemented.',
  ));

  const counts = {
    total: OMI_JATS_CONFORMANCE_MATRIX.length,
    stable: OMI_JATS_CONFORMANCE_MATRIX.filter((item) => item.status === 'stable').length,
    conditional: OMI_JATS_CONFORMANCE_MATRIX.filter((item) => item.status === 'conditional').length,
    fallback: OMI_JATS_CONFORMANCE_MATRIX.filter((item) => item.status === 'fallback').length,
    unsupported: OMI_JATS_CONFORMANCE_MATRIX.filter((item) => item.status === 'unsupported').length,
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: {
      standard: OMI_JATS_CONFORMANCE_STANDARD,
      version: OMI_JATS_CONFORMANCE_VERSION,
      tagSet: OMI_JATS_CONFORMANCE_TAG_SET,
      dtd: OMI_JATS_CONFORMANCE_DTD,
      rendererVersion: OMI_JATS_CONFORMANCE_RENDERER_VERSION,
      matrixVersion: OMI_JATS_CONFORMANCE_MATRIX_VERSION,
      publicationProfile: {
        id: 'jats4r',
        profileVersion: OMI_JATS4R_PROFILE_VERSION,
        scope: OMI_JATS4R_PROFILE_SCOPE,
        upstreamRepository: OMI_JATS4R_UPSTREAM_REPOSITORY,
        upstreamSchematronVersion: OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
      },
    },
    capabilities: counts,
    blockingDiagnostics: [...OMI_JATS_RELEASE_BLOCKING_DIAGNOSTICS],
    passed: gates.every((item) => item.status === 'pass'),
    gates,
  };
}

function gate(id: string, passed: boolean, detail: string): GateResult {
  return { id, status: passed ? 'pass' : 'fail', detail };
}

function markdown(report: PublicationReleaseGateReport): string {
  return [
    '# Publication release gates',
    '',
    `Generated: ${report.generatedAt}`,
    `Target: ${report.target.standard} ${report.target.version} / ${report.target.tagSet} / ${report.target.dtd}`,
    `Conformance matrix: ${report.target.matrixVersion}`,
    `JATS renderer: ${report.target.rendererVersion}`,
    `Publication profile: ${report.target.publicationProfile.id}@${report.target.publicationProfile.profileVersion} (${report.target.publicationProfile.scope})`,
    `Profile source: ${report.target.publicationProfile.upstreamRepository}@${report.target.publicationProfile.upstreamSchematronVersion}`,
    '',
    `Capabilities: ${report.capabilities.total} total; ${report.capabilities.stable} stable; ${report.capabilities.conditional} conditional; ${report.capabilities.fallback} fallback; ${report.capabilities.unsupported} unsupported.`,
    '',
    '| Gate | Status | Evidence |',
    '| --- | --- | --- |',
    ...report.gates.map(
      (item) =>
        `| ${item.id} | ${item.status.toUpperCase()} | ${item.detail.replaceAll('|', '\\|')} |`,
    ),
    '',
    'Release-blocking JATS diagnostics:',
    '',
    ...report.blockingDiagnostics.map((code) => `- \`${code}\``),
    '',
  ].join('\n');
}

async function writeOutput(path: string, content: string): Promise<void> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content);
}

function readArguments(args: string[]) {
  const options = {
    strict: false,
    json: '',
    markdown: '',
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--strict') {
      options.strict = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}.`);
    }
    if (arg === '--json') options.json = value;
    else if (arg === '--markdown') options.markdown = value;
    else throw new Error(`Unknown argument: ${arg}`);
    index += 1;
  }
  return options;
}

async function main(): Promise<void> {
  const options = readArguments(process.argv.slice(2));
  const report = await evaluatePublicationReleaseGates();
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (options.json) await writeOutput(options.json, json);
  if (options.markdown) await writeOutput(options.markdown, markdown(report));
  process.stdout.write(json);

  if (options.strict && !report.passed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
