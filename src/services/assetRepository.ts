const DATABASE_NAME = 'open-manuscript-studio-assets';
const DATABASE_VERSION = 1;
const STORE_NAME = 'payloads';
const memoryStore = new Map<string, Uint8Array>();

function assetKey(manuscriptId: string, assetId: string): string {
  return `${manuscriptId}:${assetId}`;
}

export async function putAssetPayload(
  manuscriptId: string,
  assetId: string,
  bytes: Uint8Array,
): Promise<void> {
  const key = assetKey(manuscriptId, assetId);
  memoryStore.set(key, new Uint8Array(bytes));

  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await runRequest(
    database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(new Uint8Array(bytes), key),
  );
  database.close();
}

export async function getAssetPayload(
  manuscriptId: string,
  assetId: string,
): Promise<Uint8Array | undefined> {
  const key = assetKey(manuscriptId, assetId);
  const cached = memoryStore.get(key);
  if (cached) return new Uint8Array(cached);

  if (typeof indexedDB === 'undefined') return undefined;
  const database = await openDatabase();
  const result = await runRequest<unknown>(
    database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key),
  );
  database.close();

  const bytes = normalizeStoredBytes(result);
  if (bytes) memoryStore.set(key, bytes);
  return bytes ? new Uint8Array(bytes) : undefined;
}

export async function hasAssetPayload(
  manuscriptId: string,
  assetId: string,
): Promise<boolean> {
  return Boolean(await getAssetPayload(manuscriptId, assetId));
}

export async function deleteAssetPayload(
  manuscriptId: string,
  assetId: string,
): Promise<void> {
  const key = assetKey(manuscriptId, assetId);
  memoryStore.delete(key);
  if (typeof indexedDB === 'undefined') return;

  const database = await openDatabase();
  await runRequest(
    database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key),
  );
  database.close();
}

export function clearMemoryAssetCache(): void {
  memoryStore.clear();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the OMI asset repository.'));
  });
}

function runRequest<T = IDBValidKey>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('OMI asset repository operation failed.'));
  });
}

function normalizeStoredBytes(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return undefined;
}
