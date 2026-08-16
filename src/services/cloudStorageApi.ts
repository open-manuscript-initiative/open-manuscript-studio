export type CloudProviderType = 'webdav' | 'nextcloud';
export type CloudConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface CloudConnection {
  id: string;
  providerType: CloudProviderType;
  displayName: string;
  status: CloudConnectionStatus;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface CloudBackup {
  id: string;
  manuscriptId: string;
  userId: string;
  connectionId: string;
  providerObjectId: string;
  providerPath: string;
  packageVersion: string;
  checksum: string;
  sizeBytes: string;
  status: string;
  createdAt: string;
}

export interface CreateCloudConnectionInput {
  providerType: CloudProviderType;
  displayName: string;
  baseUrl: string;
  username: string;
  password: string;
  rootPath: string;
}

export async function listCloudConnections(): Promise<CloudConnection[]> {
  const response = await fetch('/api/cloud/connections', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const data = await readJson<{ connections: CloudConnection[] }>(response);
  return data.connections;
}

export async function createCloudConnection(
  input: CreateCloudConnectionInput,
): Promise<CloudConnection> {
  const response = await fetch('/api/cloud/connections', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ connection: CloudConnection }>(response);
  return data.connection;
}

export async function testCloudConnection(
  connectionId: string,
): Promise<CloudConnection> {
  const response = await fetch(
    `/api/cloud/connections/${encodeURIComponent(connectionId)}/test`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );
  const data = await readJson<{ connection: CloudConnection }>(response);
  return data.connection;
}

export async function deleteCloudConnection(
  connectionId: string,
): Promise<void> {
  const response = await fetch(
    `/api/cloud/connections/${encodeURIComponent(connectionId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
    },
  );
  await ensureSuccess(response);
}

export async function uploadCloudBackup(input: {
  manuscriptId: string;
  connectionId: string;
  packageVersion: string;
  bytes: Uint8Array;
}): Promise<CloudBackup> {
  const response = await fetch(
    `/api/manuscripts/${encodeURIComponent(input.manuscriptId)}/backups?connectionId=${encodeURIComponent(input.connectionId)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/vnd.openmanuscript.package+zip',
        Accept: 'application/json',
        'X-OMI-Package-Version': input.packageVersion,
      },
      body: input.bytes,
    },
  );
  const data = await readJson<{ backup: CloudBackup }>(response);
  return data.backup;
}

export async function listCloudBackups(
  manuscriptId: string,
): Promise<CloudBackup[]> {
  const response = await fetch(
    `/api/manuscripts/${encodeURIComponent(manuscriptId)}/backups`,
    {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );
  const data = await readJson<{ backups: CloudBackup[] }>(response);
  return data.backups;
}

export async function downloadCloudBackup(backupId: string): Promise<Uint8Array> {
  const response = await fetch(
    `/api/backups/${encodeURIComponent(backupId)}/content`,
    {
      credentials: 'include',
      headers: { Accept: 'application/vnd.openmanuscript.package+zip' },
    },
  );
  await ensureSuccess(response);
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteCloudBackup(backupId: string): Promise<void> {
  const response = await fetch(`/api/backups/${encodeURIComponent(backupId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await ensureSuccess(response);
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) return;
  throw await responseError(response);
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as unknown;
  if (!response.ok) throw responseErrorFromData(response, data);
  return data as T;
}

async function responseError(response: Response): Promise<Error> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return new Error(`Request failed with HTTP ${response.status}.`);
  }
  return responseErrorFromData(response, data);
}

function responseErrorFromData(response: Response, data: unknown): Error {
  const record = data && typeof data === 'object'
    ? data as Record<string, unknown>
    : {};
  const error = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : {};
  return new Error(
    typeof error.message === 'string'
      ? error.message
      : `Request failed with HTTP ${response.status}.`,
  );
}
