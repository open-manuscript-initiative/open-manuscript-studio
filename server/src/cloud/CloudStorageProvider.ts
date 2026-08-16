import type {
  CloudConnectionStatus,
  CloudListRequest,
  CloudObject,
  CloudProviderType,
  CloudUploadRequest,
} from './types.js';

export interface CloudStorageProvider {
  readonly type: CloudProviderType;

  getStatus(): Promise<CloudConnectionStatus>;

  upload(request: CloudUploadRequest): Promise<CloudObject>;

  download(objectId: string): Promise<Buffer>;

  list(request?: CloudListRequest): Promise<CloudObject[]>;

  delete(objectId: string): Promise<void>;
}
