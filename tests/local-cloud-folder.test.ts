import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearSynchronizedFolderPreference,
  getSynchronizedFolderPreference,
  setSynchronizedFolderPreference,
  synchronizedFolderPreferenceKey,
  type KeyValueStorage,
  type SynchronizedFolderPreferenceContext,
} from '../src/services/localCloudFolder.ts';

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const personalOneDrive: SynchronizedFolderPreferenceContext = {
  userId: 'author-1',
  providerId: 'onedrive',
  accountType: 'personal',
};

test('synchronized folder preference keys separate user, provider and account type', () => {
  const baseKey = synchronizedFolderPreferenceKey(personalOneDrive);
  const businessKey = synchronizedFolderPreferenceKey({
    ...personalOneDrive,
    accountType: 'business',
  });
  const otherUserKey = synchronizedFolderPreferenceKey({
    ...personalOneDrive,
    userId: 'author-2',
  });

  assert.notEqual(baseKey, businessKey);
  assert.notEqual(baseKey, otherUserKey);
  assert.match(baseKey, /onedrive/);
});

test('synchronized folder path can be saved, restored and forgotten locally', () => {
  const storage = new MemoryStorage();
  const path = 'C:\\Users\\Author\\OneDrive\\Open Manuscript';

  assert.equal(getSynchronizedFolderPreference(personalOneDrive, storage), '');

  setSynchronizedFolderPreference(personalOneDrive, path, storage);
  assert.equal(getSynchronizedFolderPreference(personalOneDrive, storage), path);

  clearSynchronizedFolderPreference(personalOneDrive, storage);
  assert.equal(getSynchronizedFolderPreference(personalOneDrive, storage), '');
});

test('blank folder paths clear an existing device preference', () => {
  const storage = new MemoryStorage();
  setSynchronizedFolderPreference(personalOneDrive, '/Users/author/Dropbox/OMI', storage);
  setSynchronizedFolderPreference(personalOneDrive, '   ', storage);
  assert.equal(getSynchronizedFolderPreference(personalOneDrive, storage), '');
});
