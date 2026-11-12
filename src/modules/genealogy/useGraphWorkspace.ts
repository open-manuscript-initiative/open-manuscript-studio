import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { graphStore } from './workspaceStore';
import type { GraphWorkspace } from './model';
export function useGraphWorkspace(key: string) {
  const subscribe = useCallback(
    (listener: () => void) => graphStore.subscribe(key, listener),
    [key],
  );
  const get = useCallback(() => graphStore.snapshot(key), [key]);
  const snapshot = useSyncExternalStore(subscribe, get, get);
  useEffect(() => {
    void graphStore.load(key);
  }, [key]);
  const update = useCallback(
    (change: GraphWorkspace | ((current: GraphWorkspace) => GraphWorkspace)) =>
      graphStore.update(key, change),
    [key],
  );
  return { ...snapshot, update, undo: () => graphStore.undo(key) };
}
