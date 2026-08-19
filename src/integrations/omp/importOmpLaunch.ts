import { createSampleManuscript } from '../../document/sampleManuscript';
import type { OmiManuscript } from '../../types/omi';

export interface OmpLaunchPayload {
  protocol: string;
  profile: string;
  status?: string;
  installation?: {
    installationId?: string;
    displayName?: string;
    baseUrl?: string;
  };
  context?: {
    externalId?: string;
    type?: string;
    path?: string;
    name?: string;
  } | null;
  submission?: {
    externalId?: string;
    type?: string;
    title?: string;
  } | null;
  component?: {
    externalId?: string;
    type?: string;
    title?: string;
  } | null;
  actor?: { externalId?: string } | null;
  actorMode?: 'editor' | 'author' | 'review' | null;
  scope?: string[];
  externalBaseUrl?: string | null;
  apiBaseUrl?: string | null;
  expiresAt?: string;
}

export async function fetchOmpHandoff(token: string): Promise<OmpLaunchPayload> {
  const response = await fetch(
    `/integrations/omp/handoff/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      body?.error?.message || `OMP handoff failed with HTTP ${response.status}.`,
    );
  }

  const launch = await response.json() as OmpLaunchPayload;
  if (
    launch.protocol !== 'omi-integration/1' ||
    launch.profile !== 'omi-integration/1/omp'
  ) {
    throw new Error('The OMP handoff returned an invalid launch payload.');
  }
  return launch;
}

export function createManuscriptFromOmpLaunch(
  launch: OmpLaunchPayload,
): OmiManuscript | null {
  const externalId = launch.submission?.externalId;
  if (!externalId) return null;

  const base = createSampleManuscript();
  const now = new Date().toISOString();
  const title = launch.component?.title?.trim()
    || launch.submission?.title?.trim()
    || `OMP monograph ${externalId}`;

  return {
    ...base,
    title,
    sections: [],
    createdAt: now,
    updatedAt: now,
  };
}
