export type CloudStorageErrorCode =
  | 'CLOUD_NOT_CONNECTED'
  | 'CLOUD_AUTH_FAILED'
  | 'CLOUD_PERMISSION_DENIED'
  | 'CLOUD_UPLOAD_FAILED'
  | 'CLOUD_DOWNLOAD_FAILED'
  | 'CLOUD_DELETE_FAILED'
  | 'CLOUD_LIST_FAILED'
  | 'CLOUD_OBJECT_NOT_FOUND'
  | 'CLOUD_UNSAFE_REMOTE_URL'
  | 'BACKUP_PACKAGE_INVALID'
  | 'BACKUP_INTEGRITY_CHECK_FAILED';

export class CloudStorageError extends Error {
  constructor(
    public readonly code: CloudStorageErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CloudStorageError';
  }
}
