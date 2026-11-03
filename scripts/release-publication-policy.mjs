import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This selects an attempt, never approves a release. The publication job
// still verifies the reviewed SHA, owner receipt, E02 and strict blockers.
export function shouldAttemptPublication({ version, eventName, ref, releaseTag = '', candidateOnly = false }) {
  if (candidateOnly || eventName === 'pull_request') return false;
  if (/^1\.0\.0(?:-rc\.\d+)?$/.test(version)) {
    return eventName === 'workflow_dispatch' && ref === 'refs/heads/main'
      && releaseTag === `v${version}`;
  }
  return ref.startsWith('refs/tags/v') || ref === 'refs/heads/main' || releaseTag !== '';
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const allowed = shouldAttemptPublication({
    version, eventName: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF ?? '',
    releaseTag: process.env.INPUT_TAG ?? '', candidateOnly: process.env.INPUT_CANDIDATE_ONLY === 'true',
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
  appendFileSync(process.env.GITHUB_OUTPUT, `publish=${allowed}\n`);
  console.log(allowed ? 'Publication requested; all release guards still apply.'
    : 'Build evidence only; publication was not requested.');
}
