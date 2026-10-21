import { env } from '../config/env.js';
import { createServerRegistryGithubToken } from './githubAppToken.js';

export async function submitGithubRegistration(entry: {
  id: string;
  name: string;
  origin: string;
  softwareVersion: string | null;
  capabilities: unknown;
}): Promise<string> {
  const installationToken = await createServerRegistryGithubToken();

  const body = [
    'A Studio server completed HTTPS domain verification and requested directory registration.',
    '',
    `- Registry ID: ${entry.id}`,
    `- Name: ${entry.name}`,
    `- Origin: ${entry.origin}`,
    `- Studio version: ${entry.softwareVersion ?? 'not supplied'}`,
    `- Capabilities: ${JSON.stringify(entry.capabilities ?? [])}`,
    '',
    'This issue is an audit notification. Live status is stored in the registry database and is not updated here.',
  ].join('\n');

  const response = await fetch(
    `https://api.github.com/repos/${env.OMI_SERVER_REGISTRY_GITHUB_REPOSITORY}/issues`,
    {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${installationToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Studio server directory registration: ${entry.name}`,
        body,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub registration audit failed with HTTP ${response.status}.`);
  }
  const result = await response.json() as { html_url?: string };
  if (!result.html_url) throw new Error('GitHub did not return the registration issue URL.');
  return result.html_url;
}

