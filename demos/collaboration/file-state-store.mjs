import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function createFileStateStore(directory, roomId) {
  const statePath = path.join(path.resolve(directory), roomId + '.yjs');
  let queue = Promise.resolve();

  return {
    async load() {
      try {
        return await readFile(statePath);
      } catch (error) {
        if (error && error.code === 'ENOENT') return null;
        throw error;
      }
    },
    save(update) {
      const bytes = Buffer.from(update);
      queue = queue.then(async () => {
        await mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
        const temporary = statePath + '.' + randomUUID() + '.tmp';
        await writeFile(temporary, bytes, { mode: 0o600 });
        await rename(temporary, statePath);
      });
      return queue;
    },
  };
}
