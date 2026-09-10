import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const DEFAULT_CONFIG = 'docs/release/readiness.config.json';

export async function evaluateLocalReadiness(
  root = DEFAULT_ROOT,
  configOverride,
) {
  const config = configOverride ?? JSON.parse(
    await readFile(resolve(root, DEFAULT_CONFIG), 'utf8'),
  );
  const gates = [];

  gates.push(gate(
    'scope-route',
    config.route === 'A',
    `Release route is ${config.route ?? 'unset'}; Route A is required by the accepted scope.`,
  ));

  const missingFiles = [];
  for (const path of config.requiredFiles ?? []) {
    try {
      await access(resolve(root, path));
    } catch {
      missingFiles.push(path);
    }
  }
  gates.push(gate(
    'required-files',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? `${config.requiredFiles.length} required release files are present.`
      : `Missing: ${missingFiles.join(', ')}`,
  ));

  const markerFailures = [];
  for (const [path, markers] of Object.entries(config.workflowMarkers ?? {})) {
    let content = '';
    try {
      content = await readFile(resolve(root, path), 'utf8');
    } catch {
      markerFailures.push(`${path}: unreadable`);
      continue;
    }
    const missing = markers.filter((marker) => !content.includes(marker));
    if (missing.length > 0) markerFailures.push(`${path}: ${missing.join(', ')}`);
  }
  gates.push(gate(
    'workflow-markers',
    markerFailures.length === 0,
    markerFailures.length === 0
      ? 'Required CI, PKP, security, package, and readiness markers are present.'
      : `Missing workflow markers: ${markerFailures.join('; ')}`,
  ));

  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  const cargoToml = await readFile(resolve(root, 'src-tauri/Cargo.toml'), 'utf8');
  const tauriConfig = JSON.parse(
    await readFile(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'),
  );
  const versions = {
    package: packageJson.version,
    packageLock: packageLock.packages?.['']?.version,
    cargo: cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    tauri: tauriConfig.version,
  };
  const uniqueVersions = new Set(Object.values(versions));
  gates.push(gate(
    'version-parity',
    !Object.values(versions).includes(undefined) && uniqueVersions.size === 1,
    `Version sources: ${Object.entries(versions).map(([key, value]) => `${key}=${value ?? 'missing'}`).join(', ')}`,
  ));

  const scope = await readFile(resolve(root, 'docs/release/1.0-scope.md'), 'utf8');
  gates.push(gate(
    'private-fixture-policy',
    scope.includes('Real manuscripts used for acceptance testing stay outside Git')
      && (await readFile(resolve(root, '.gitignore'), 'utf8')).includes('tests/private-fixtures/'),
    'Private manuscript exclusion and content-free benchmark reporting are documented.',
  ));
  gates.push(gate(
    'feature-freeze',
    scope.includes('Feature freeze')
      && scope.includes('Reclassifying a failed gate to preserve a date is not'),
    'The RC feature freeze and non-waivable mandatory gates are documented.',
  ));

  const git = gitMetadata(root);
  return {
    schemaVersion: config.schemaVersion,
    generatedAt: new Date().toISOString(),
    targetVersion: config.targetVersion,
    route: config.route,
    minimumScore: config.minimumScore,
    source: git,
    local: {
      passed: gates.every((item) => item.status === 'pass'),
      gates,
    },
  };
}

export function summarizeGitHubIssues(issues, redGateLabels) {
  const openIssues = issues.filter((item) => !item.pull_request);
  const blockers = openIssues.filter((item) => {
    const labels = (item.labels ?? []).map((label) =>
      typeof label === 'string' ? label : label.name,
    );
    return redGateLabels.some((label) => labels.includes(label));
  });
  return {
    openIssues: openIssues.length,
    openPullRequests: issues.length - openIssues.length,
    blockers: blockers.map((item) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
    })),
  };
}

async function fetchGitHubEvidence(config) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    return {
      available: false,
      reason: 'GITHUB_TOKEN or GITHUB_REPOSITORY is unavailable.',
    };
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'open-manuscript-studio-readiness',
  };
  const [issuesResponse, labelsResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, { headers }),
    fetch(`https://api.github.com/repos/${repository}/labels?per_page=100`, { headers }),
  ]);
  if (!issuesResponse.ok || !labelsResponse.ok) {
    return {
      available: false,
      reason: `GitHub API failed: issues=${issuesResponse.status}, labels=${labelsResponse.status}.`,
    };
  }
  const issues = await issuesResponse.json();
  const labels = await labelsResponse.json();
  const issueSummary = summarizeGitHubIssues(issues, config.redGateLabels ?? []);
  const labelNames = new Set(labels.map((label) => label.name));
  const missingLabels = (config.requiredIssueLabels ?? []).filter(
    (label) => !labelNames.has(label),
  );
  return {
    available: true,
    ...issueSummary,
    missingLabels,
    passed: issueSummary.blockers.length === 0 && missingLabels.length === 0,
  };
}

function gate(id, passed, detail) {
  return { id, status: passed ? 'pass' : 'fail', detail };
}

function gitMetadata(root) {
  const run = (arguments_) => {
    try {
      return execFileSync('git', arguments_, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return '';
    }
  };
  const status = run(['status', '--porcelain']);
  return {
    commit: process.env.GITHUB_SHA || run(['rev-parse', 'HEAD']) || null,
    branch: process.env.GITHUB_REF_NAME || run(['branch', '--show-current']) || null,
    dirty: Boolean(status),
  };
}

function readArguments(arguments_) {
  const options = {
    root: DEFAULT_ROOT,
    config: DEFAULT_CONFIG,
    github: false,
    strictLocal: false,
    jsonOutput: '',
    markdownOutput: '',
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--github') {
      options.github = true;
      continue;
    }
    if (argument === '--strict-local') {
      options.strictLocal = true;
      continue;
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`);
    if (argument === '--root') options.root = resolve(value);
    else if (argument === '--config') options.config = value;
    else if (argument === '--json') options.jsonOutput = value;
    else if (argument === '--markdown') options.markdownOutput = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  return options;
}

function markdownReport(result) {
  const rows = result.local.gates.map(
    (item) => `| ${item.id} | ${item.status.toUpperCase()} | ${item.detail.replaceAll('|', '\\|')} |`,
  );
  const githubRows = result.github?.available
    ? [
        '',
        '## GitHub state',
        '',
        `- Open issues: ${result.github.openIssues}`,
        `- Open pull requests: ${result.github.openPullRequests}`,
        `- Red blockers: ${result.github.blockers.length}`,
        `- Missing readiness labels: ${result.github.missingLabels.join(', ') || 'none'}`,
      ]
    : result.github
      ? ['', '## GitHub state', '', `Unavailable: ${result.github.reason}`]
      : [];
  return [
    '# Open Manuscript Studio 1.0 readiness',
    '',
    `Generated: ${result.generatedAt}`,
    `Source commit: ${result.source.commit ?? 'unknown'}`,
    `Route: ${result.route}`,
    '',
    '| Gate | Status | Evidence |',
    '| --- | --- | --- |',
    ...rows,
    ...githubRows,
    '',
  ].join('\n');
}

async function writeOutput(path, content) {
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, content);
}

async function main() {
  const options = readArguments(process.argv.slice(2));
  const config = JSON.parse(
    await readFile(resolve(options.root, options.config), 'utf8'),
  );
  const result = await evaluateLocalReadiness(options.root, config);
  if (options.github) result.github = await fetchGitHubEvidence(config);

  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.jsonOutput) await writeOutput(options.jsonOutput, json);
  if (options.markdownOutput) {
    await writeOutput(options.markdownOutput, markdownReport(result));
  }
  process.stdout.write(json);

  if (options.strictLocal && !result.local.passed) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
