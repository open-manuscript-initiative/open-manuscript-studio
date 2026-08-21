import type { CloudStorageProvider } from '../../CloudStorageProvider.js';
import { CloudStorageError } from '../../errors/CloudStorageError.js';
import { assertSafeRemoteUrl } from '../../security/remoteUrl.js';
import type {
  CloudConnectionStatus,
  CloudListRequest,
  CloudObject,
  CloudProviderType,
  CloudUploadRequest,
  WebDavCredentials,
} from '../../types.js';

const DAV_PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname />
    <d:getcontentlength />
    <d:getlastmodified />
    <d:getetag />
    <d:resourcetype />
  </d:prop>
</d:propfind>`;

function normalizePath(path: string): string {
  const parts = path
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part.length > 0 && part !== '.');

  if (parts.some((part) => part === '..')) {
    throw new CloudStorageError(
      'CLOUD_PERMISSION_DENIED',
      'Cloud storage paths must not contain parent-directory traversal.',
    );
  }

  return parts.join('/');
}

function joinPath(...parts: string[]): string {
  return parts.map(normalizePath).filter(Boolean).join('/');
}

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function elementValue(xml: string, localName: string): string | undefined {
  const expression = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${localName}>`,
    'i',
  );
  const match = expression.exec(xml);
  return match?.[1] ? xmlDecode(match[1].trim()) : undefined;
}

function parseDavObjects(xml: string, requestedPath: string): CloudObject[] {
  const responses = xml.match(
    /<(?:[A-Za-z0-9_-]+:)?response\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?response>/gi,
  ) ?? [];

  return responses.flatMap((responseXml): CloudObject[] => {
    const href = elementValue(responseXml, 'href');
    if (!href) return [];

    const decodedHref = decodeURIComponent(href);
    const hrefPath = decodedHref.replace(/^https?:\/\/[^/]+/i, '');
    const nameFromHref = hrefPath.replace(/\/$/, '').split('/').pop() ?? '';
    const displayName = elementValue(responseXml, 'displayname') || nameFromHref;
    const contentLength = elementValue(responseXml, 'getcontentlength');
    const modifiedAt = elementValue(responseXml, 'getlastmodified');
    const checksum = elementValue(responseXml, 'getetag')?.replace(/^W\//, '').replace(/^"|"$/g, '');
    const isDirectory = /<(?:[A-Za-z0-9_-]+:)?collection\b/i.test(responseXml);

    const normalizedRequested = normalizePath(requestedPath);
    const normalizedHref = normalizePath(hrefPath);
    if (normalizedHref.endsWith(normalizedRequested) && isDirectory) return [];

    return [{
      id: normalizedHref,
      path: normalizedHref,
      name: displayName,
      ...(contentLength && Number.isFinite(Number(contentLength))
        ? { size: Number(contentLength) }
        : {}),
      ...(modifiedAt ? { modifiedAt: new Date(modifiedAt).toISOString() } : {}),
      ...(checksum ? { checksum } : {}),
      isDirectory,
    }];
  });
}

export class WebDavProvider implements CloudStorageProvider {
  readonly type: CloudProviderType;

  constructor(
    private readonly credentials: WebDavCredentials,
    type: CloudProviderType = 'webdav',
  ) {
    this.type = type;
  }

  private remotePath(path = ''): string {
    return joinPath(this.credentials.rootPath, path);
  }

  private async request(
    method: string,
    path: string,
    options: {
      body?: Buffer | string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<Response> {
    const baseUrl = this.credentials.baseUrl.endsWith('/')
      ? this.credentials.baseUrl
      : `${this.credentials.baseUrl}/`;
    const safeBase = await assertSafeRemoteUrl(baseUrl);
    const target = new URL(
      this.remotePath(path)
        .split('/')
        .map(encodeURIComponent)
        .join('/'),
      safeBase,
    );

    const authorization = Buffer.from(
      `${this.credentials.username}:${this.credentials.password}`,
      'utf8',
    ).toString('base64');

    let response: Response;
    try {
      response = await fetch(target, {
        method,
        redirect: 'manual',
        headers: {
          Authorization: `Basic ${authorization}`,
          ...options.headers,
        },
        ...(options.body !== undefined ? { body: options.body } : {}),
      });
    } catch (error) {
      throw new CloudStorageError(
        'CLOUD_NOT_CONNECTED',
        'The WebDAV server could not be reached.',
        error,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      throw new CloudStorageError(
        'CLOUD_UNSAFE_REMOTE_URL',
        'WebDAV redirects are not followed for security reasons. Configure the final HTTPS endpoint directly.',
      );
    }

    return response;
  }

  private throwForResponse(response: Response, operation: string): never {
    if (response.status === 401) {
      throw new CloudStorageError('CLOUD_AUTH_FAILED', 'WebDAV authentication failed.');
    }
    if (response.status === 403) {
      throw new CloudStorageError('CLOUD_PERMISSION_DENIED', `WebDAV ${operation} was denied.`);
    }
    if (response.status === 404) {
      throw new CloudStorageError('CLOUD_OBJECT_NOT_FOUND', 'The WebDAV object was not found.');
    }

    throw new CloudStorageError(
      operation === 'download'
        ? 'CLOUD_DOWNLOAD_FAILED'
        : operation === 'delete'
          ? 'CLOUD_DELETE_FAILED'
          : operation === 'list'
            ? 'CLOUD_LIST_FAILED'
            : 'CLOUD_UPLOAD_FAILED',
      `WebDAV ${operation} failed with HTTP ${response.status}.`,
    );
  }

  private async ensureDirectory(path: string): Promise<void> {
    const parts = normalizePath(path).split('/').filter(Boolean);
    let current = '';

    for (const part of parts) {
      current = joinPath(current, part);
      const response = await this.request('MKCOL', current);
      if (response.ok || response.status === 405) continue;
      this.throwForResponse(response, 'upload');
    }
  }

  async getStatus(): Promise<CloudConnectionStatus> {
    try {
      const response = await this.request('PROPFIND', '', {
        body: DAV_PROPFIND_BODY,
        headers: {
          Depth: '0',
          'Content-Type': 'application/xml; charset=utf-8',
        },
      });

      if (!response.ok && response.status !== 207) {
        this.throwForResponse(response, 'list');
      }

      return { state: 'connected' };
    } catch (error) {
      return {
        state: 'error',
        message: error instanceof Error ? error.message : 'WebDAV connection test failed.',
      };
    }
  }

  async upload(request: CloudUploadRequest): Promise<CloudObject> {
    const runtimeRequest: unknown = request;
    if (!runtimeRequest || typeof runtimeRequest !== 'object') {
      throw new CloudStorageError('CLOUD_UPLOAD_FAILED', 'The cloud upload request is invalid.');
    }

    const input = runtimeRequest as {
      path?: unknown;
      data?: unknown;
      contentType?: unknown;
    };
    if (typeof input.path !== 'string' || !Buffer.isBuffer(input.data)) {
      throw new CloudStorageError('CLOUD_UPLOAD_FAILED', 'The cloud upload path and binary data are invalid.');
    }

    const path = normalizePath(input.path);
    const data = Buffer.from(input.data);
    const contentType = typeof input.contentType === 'string' && input.contentType.length <= 255
      ? input.contentType
      : 'application/octet-stream';
    const directory = path.split('/').slice(0, -1).join('/');
    if (directory) await this.ensureDirectory(directory);

    const response = await this.request('PUT', path, {
      body: data,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!response.ok) this.throwForResponse(response, 'upload');

    return {
      id: path,
      path,
      name: path.split('/').pop() ?? path,
      size: data.byteLength,
      ...(response.headers.get('etag')
        ? { checksum: response.headers.get('etag')!.replace(/^W\//, '').replace(/^"|"$/g, '') }
        : {}),
      isDirectory: false,
    };
  }

  async download(objectId: string): Promise<Buffer> {
    const response = await this.request('GET', normalizePath(objectId));
    if (!response.ok) this.throwForResponse(response, 'download');
    return Buffer.from(await response.arrayBuffer());
  }

  async list(request: CloudListRequest = {}): Promise<CloudObject[]> {
    const path = normalizePath(request.path ?? '');
    const response = await this.request('PROPFIND', path, {
      body: DAV_PROPFIND_BODY,
      headers: {
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });

    if (!response.ok && response.status !== 207) this.throwForResponse(response, 'list');
    return parseDavObjects(await response.text(), this.remotePath(path));
  }

  async delete(objectId: string): Promise<void> {
    const response = await this.request('DELETE', normalizePath(objectId));
    if (!response.ok && response.status !== 204) this.throwForResponse(response, 'delete');
  }
}