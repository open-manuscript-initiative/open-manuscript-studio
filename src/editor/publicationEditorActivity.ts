import { create } from 'zustand';

// Runtime view activity only: never document metadata or an editing lock.
const useActivity = create<{ owners: ReadonlySet<symbol> }>(() => ({ owners: new Set() }));

export function registerPublicationEditor(): () => void {
  const owner = Symbol('publication-editor');
  useActivity.setState(state => ({ owners: new Set([...state.owners, owner]) }));
  return () => useActivity.setState(state => {
    if (!state.owners.has(owner)) return state;
    const owners = new Set(state.owners);
    owners.delete(owner);
    return { owners };
  });
}

export function useAuthoringViewSuspended(): boolean {
  return useActivity(state => state.owners.size > 0);
}
