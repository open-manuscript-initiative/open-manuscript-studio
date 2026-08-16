export type CloudProviderType = 'webdav' | 'nextcloud';

export type CloudConnectionState =
  | 'connected'
  | 'disconnected'
  | 'error';

export interface CloudConnectionStatus {
  state: CloudConnectionState;
  message?: string;
}

export interface CloudUploadRequest {
  path: string;
  data: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface CloudListRequest {
  path?: string;
}

export interface CloudObject {
  id: string;
  path: string;
  name: string;
  size?: number;
  modifiedAt?: string;
  checksum?: string;
  isDirectory?: boolean;
}

export interface WebDavCredentials {
  baseUrl: string;
  username: string;
  password: string;
  rootPath: string;
}
