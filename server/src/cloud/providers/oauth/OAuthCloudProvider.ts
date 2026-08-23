import type { CloudStorageProvider } from '../../CloudStorageProvider.js';
import { CloudStorageError } from '../../errors/CloudStorageError.js';
import type {
  CloudConnectionStatus,
  CloudListRequest,
  CloudObject,
  CloudProviderType,
  CloudUploadRequest,
  OAuthCloudCredentials,
} from '../../types.js';
import { refreshCloudOAuthCredentials } from '../../oauth/cloudOAuth.js';

type PersistCredentials = (credentials: OAuthCloudCredentials) => Promise<void>;

interface JsonRecord {
  [key: string]: unknown;
}

function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter((part) => part && part !== '.');
  if (parts.some((part) => part === '..')) {
    throw new CloudStorageError('CLOUD_PERMISSION_DENIED', 'Cloud storage paths must not contain parent-directory traversal.');
  }
  return parts.join('/');
}

function encodePath(path: string): string {
  return normalizePath(path).split('/').map(encodeURIComponent).join('/');
}

export class OAuthCloudProvider implements CloudStorageProvider {
  readonly type: CloudProviderType;
  private credentials: OAuthCloudCredentials;

  constructor(
    credentials: OAuthCloudCredentials,
    private readonly persistCredentials?: PersistCredentials,
  ) {
    this.credentials = credentials;
    this.type = credentials.provider;
  }

  async getStatus(): Promise<CloudConnectionStatus> {
    try {
      if (this.type === 'google-drive') {
        await this.authorizedFetch('https://www.googleapis.com/drive/v3/about?fields=user');
      } else if (this.type === 'onedrive') {
        await this.authorizedFetch('https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType');
      } else if (this.type === 'dropbox') {
        await this.authorizedFetch('https://api.dropboxapi.com/2/users/get_current_account', { method: 'POST' });
      }
      return { state: 'connected' };
    } catch (error) {
      return { state: 'error', message: error instanceof Error ? error.message : 'OAuth cloud connection test failed.' };
    }
  }

  async upload(request: CloudUploadRequest): Promise<CloudObject> {
    const path = normalizePath(request.path);
    if (!path || !Buffer.isBuffer(request.data)) {
      throw new CloudStorageError('CLOUD_UPLOAD_FAILED', 'The cloud upload path and binary data are invalid.');
    }
    if (this.type === 'google-drive') return this.uploadGoogle(path, request);
    if (this.type === 'onedrive') return this.uploadOneDrive(path, request);
    if (this.type === 'dropbox') return this.uploadDropbox(path, request);
    throw new CloudStorageError('CLOUD_UPLOAD_FAILED', 'Unsupported OAuth cloud provider.');
  }

  async download(objectId: string): Promise<Buffer> {
    if (this.type === 'google-drive') {
      const response = await this.authorizedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(objectId)}?alt=media`);
      return Buffer.from(await response.arrayBuffer());
    }
    if (this.type === 'onedrive') {
      const response = await this.authorizedFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(objectId)}/content`);
      return Buffer.from(await response.arrayBuffer());
    }
    if (this.type === 'dropbox') {
      const response = await this.authorizedFetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: { 'Dropbox-API-Arg': JSON.stringify({ path: objectId }) },
      });
      return Buffer.from(await response.arrayBuffer());
    }
    throw new CloudStorageError('CLOUD_DOWNLOAD_FAILED', 'Unsupported OAuth cloud provider.');
  }

  async list(request: CloudListRequest = {}): Promise<CloudObject[]> {
    const path = normalizePath(request.path ?? '');
    if (this.type === 'google-drive') return this.listGoogle(path);
    if (this.type === 'onedrive') return this.listOneDrive(path);
    if (this.type === 'dropbox') return this.listDropbox(path);
    return [];
  }

  async delete(objectId: string): Promise<void> {
    if (this.type === 'google-drive') {
      await this.authorizedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(objectId)}`, { method: 'DELETE' }, [204]);
      return;
    }
    if (this.type === 'onedrive') {
      await this.authorizedFetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(objectId)}`, { method: 'DELETE' }, [204]);
      return;
    }
    if (this.type === 'dropbox') {
      await this.authorizedJson('https://api.dropboxapi.com/2/files/delete_v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: objectId }),
      });
      return;
    }
    throw new CloudStorageError('CLOUD_DELETE_FAILED', 'Unsupported OAuth cloud provider.');
  }

  private async uploadGoogle(path: string, request: CloudUploadRequest): Promise<CloudObject> {
    const parts = [this.credentials.rootPath, path].flatMap((part) => normalizePath(part).split('/')).filter(Boolean);
    const fileName = parts.pop()!;
    let parentId = 'root';
    for (const folder of parts) parentId = await this.ensureGoogleFolder(parentId, folder);

    const boundary = `omi_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const metadata = Buffer.from(JSON.stringify({ name: fileName, parents: [parentId] }), 'utf8');
    const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, 'utf8');
    const middle = Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${request.contentType || 'application/octet-stream'}\r\n\r\n`, 'utf8');
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const response = await this.authorizedJson('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime,md5Checksum', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: Buffer.concat([prefix, metadata, middle, request.data, suffix]),
    });
    return {
      id: String(response.id), path, name: String(response.name || fileName),
      ...(response.size ? { size: Number(response.size) } : {}),
      ...(response.modifiedTime ? { modifiedAt: String(response.modifiedTime) } : {}),
      ...(response.md5Checksum ? { checksum: String(response.md5Checksum) } : {}),
      isDirectory: false,
    };
  }

  private async ensureGoogleFolder(parentId: string, name: string): Promise<string> {
    const escaped = name.replace(/'/g, "\\'");
    const q = encodeURIComponent(`name='${escaped}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const found = await this.authorizedJson(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
    const files = Array.isArray(found.files) ? found.files as JsonRecord[] : [];
    if (files[0]?.id) return String(files[0].id);
    const created = await this.authorizedJson('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    return String(created.id);
  }

  private async listGoogle(path: string): Promise<CloudObject[]> {
    let parentId = 'root';
    for (const folder of [this.credentials.rootPath, path].flatMap((part) => normalizePath(part).split('/')).filter(Boolean)) {
      parentId = await this.ensureGoogleFolder(parentId, folder);
    }
    const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
    const data = await this.authorizedJson(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime,md5Checksum,mimeType)`);
    const files = Array.isArray(data.files) ? data.files as JsonRecord[] : [];
    return files.map((file) => ({
      id: String(file.id), path: String(file.id), name: String(file.name || file.id),
      ...(file.size ? { size: Number(file.size) } : {}),
      ...(file.modifiedTime ? { modifiedAt: String(file.modifiedTime) } : {}),
      ...(file.md5Checksum ? { checksum: String(file.md5Checksum) } : {}),
      isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
    }));
  }

  private async uploadOneDrive(path: string, request: CloudUploadRequest): Promise<CloudObject> {
    const fullPath = normalizePath(`${this.credentials.rootPath}/${path}`);
    await this.ensureOneDriveParent(fullPath.split('/').slice(0, -1));
    const response = await this.authorizedJson(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodePath(fullPath)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': request.contentType || 'application/octet-stream' },
      body: request.data,
    });
    return {
      id: String(response.id), path: fullPath, name: String(response.name || fullPath.split('/').pop()),
      ...(response.size ? { size: Number(response.size) } : {}),
      ...(response.lastModifiedDateTime ? { modifiedAt: String(response.lastModifiedDateTime) } : {}),
      isDirectory: false,
    };
  }

  private async ensureOneDriveParent(parts: string[]): Promise<void> {
    let parentPath = '';
    for (const folder of parts) {
      const currentPath = normalizePath(`${parentPath}/${folder}`);
      const check = await this.authorizedFetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodePath(currentPath)}`, {}, [200, 404]);
      if (check.status === 404) {
        const endpoint = parentPath
          ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodePath(parentPath)}:/children`
          : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
        await this.authorizedJson(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folder, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
        });
      }
      parentPath = currentPath;
    }
  }

  private async listOneDrive(path: string): Promise<CloudObject[]> {
    const fullPath = normalizePath(`${this.credentials.rootPath}/${path}`);
    const endpoint = fullPath
      ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodePath(fullPath)}:/children`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
    const data = await this.authorizedJson(endpoint);
    const values = Array.isArray(data.value) ? data.value as JsonRecord[] : [];
    return values.map((item) => ({
      id: String(item.id), path: String(item.id), name: String(item.name || item.id),
      ...(item.size ? { size: Number(item.size) } : {}),
      ...(item.lastModifiedDateTime ? { modifiedAt: String(item.lastModifiedDateTime) } : {}),
      isDirectory: Boolean(item.folder),
    }));
  }

  private async uploadDropbox(path: string, request: CloudUploadRequest): Promise<CloudObject> {
    const fullPath = `/${normalizePath(`${this.credentials.rootPath}/${path}`)}`;
    const response = await this.authorizedJson('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: fullPath, mode: 'overwrite', autorename: false, mute: true }),
      },
      body: request.data,
    });
    return {
      id: String(response.id || fullPath), path: fullPath, name: String(response.name || fullPath.split('/').pop()),
      ...(response.size ? { size: Number(response.size) } : {}),
      ...(response.server_modified ? { modifiedAt: String(response.server_modified) } : {}),
      ...(response.content_hash ? { checksum: String(response.content_hash) } : {}),
      isDirectory: false,
    };
  }

  private async listDropbox(path: string): Promise<CloudObject[]> {
    const fullPath = normalizePath(`${this.credentials.rootPath}/${path}`);
    const data = await this.authorizedJson('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath ? `/${fullPath}` : '', recursive: false }),
    });
    const entries = Array.isArray(data.entries) ? data.entries as JsonRecord[] : [];
    return entries.map((item) => ({
      id: String(item.id || item.path_lower), path: String(item.path_lower || item.id), name: String(item.name || ''),
      ...(item.size ? { size: Number(item.size) } : {}),
      ...(item.server_modified ? { modifiedAt: String(item.server_modified) } : {}),
      ...(item.content_hash ? { checksum: String(item.content_hash) } : {}),
      isDirectory: item['.tag'] === 'folder',
    }));
  }

  private async authorizedJson(url: string, init: RequestInit = {}): Promise<JsonRecord> {
    const response = await this.authorizedFetch(url, init);
    if (response.status === 204) return {};
    return await response.json() as JsonRecord;
  }

  private async authorizedFetch(url: string, init: RequestInit = {}, allowed: number[] = [200, 201, 202, 204]): Promise<Response> {
    await this.ensureFreshToken();
    let response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.credentials.accessToken}`, ...(init.headers || {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401 && this.credentials.refreshToken) {
      await this.refreshToken();
      response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${this.credentials.accessToken}`, ...(init.headers || {}) },
        signal: AbortSignal.timeout(30_000),
      });
    }
    if (allowed.includes(response.status)) return response;
    const preview = (await response.text()).slice(0, 300);
    if (response.status === 401) throw new CloudStorageError('CLOUD_AUTH_FAILED', 'Cloud OAuth authorization expired or was revoked.');
    if (response.status === 403) throw new CloudStorageError('CLOUD_PERMISSION_DENIED', 'Cloud provider denied the requested operation.');
    if (response.status === 404) throw new CloudStorageError('CLOUD_OBJECT_NOT_FOUND', 'Cloud object not found.');
    throw new CloudStorageError('CLOUD_NOT_CONNECTED', `Cloud provider request failed with HTTP ${response.status}${preview ? `: ${preview}` : ''}`);
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.credentials.expiresAt) return;
    if (new Date(this.credentials.expiresAt).getTime() > Date.now()) return;
    await this.refreshToken();
  }

  private async refreshToken(): Promise<void> {
    this.credentials = await refreshCloudOAuthCredentials(this.credentials);
    await this.persistCredentials?.(this.credentials);
  }
}
