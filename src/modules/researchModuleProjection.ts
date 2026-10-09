import { getDisciplineWorkspaceStorageKey } from './disciplineWorkspace';

export interface ResearchExcerpt {
  id: string;
  moduleId: string;
  label: string;
  text: string;
  source: string;
}

const storagePrefixes: Readonly<Record<string, string>> = {
  'org.omi.critical-text-edition': 'omi:critical-edition:v1:',
  'org.omi.corpus-linguistics': 'omi:corpus-linguistics:v1:',
  'org.omi.musicology': 'omi:musicology:v1:',
  'org.omi.cultural-heritage': 'omi:cultural-heritage:v1:',
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function string(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function items(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Project data is read only after the researcher opens the selection UI. */
export function readResearchExcerpts(moduleId: string, userId: string): ResearchExcerpt[] {
  const prefix = storagePrefixes[moduleId];
  if (!prefix || typeof window === 'undefined') return [];
  const key = prefix + getDisciplineWorkspaceStorageKey(userId, 'default', moduleId);
  let project: Record<string, unknown> | null;
  try {
    const json = window.localStorage.getItem(key);
    project = json ? record(JSON.parse(json) as unknown) : null;
  } catch {
    return [];
  }
  if (!project) return [];
  const excerpts: ResearchExcerpt[] = [];
  const add = (id: string, label: string, text: string, source: string): void => {
    if (id && label && text) excerpts.push({ id, moduleId, label, text, source });
  };
  if (moduleId === 'org.omi.critical-text-edition' && project.version === 1) {
    for (const item of items(project.segments)) {
      const segment = record(item);
      if (segment) add(string(segment.id), string(segment.locus), string(segment.lemma), '');
    }
  } else if (moduleId === 'org.omi.corpus-linguistics' && project.version === 1) {
    for (const item of items(project.documents)) {
      const document = record(item);
      if (document) add(string(document.id), string(document.title), string(document.text), string(document.source));
    }
  } else if (moduleId === 'org.omi.musicology') {
    for (const item of items(project.events)) {
      const event = record(item);
      if (event) {
        const label = [string(event.measure), string(event.part)].filter(Boolean).join(' · ');
        add(string(event.id), label || string(event.pitch), string(event.annotation) || string(event.pitch), string(project.source));
      }
    }
  } else if (moduleId === 'org.omi.cultural-heritage') {
    for (const item of items(project.records)) {
      const heritage = record(item);
      if (heritage) add(string(heritage.id), string(heritage.title), string(heritage.description), string(heritage.sourceUrl));
    }
  }
  return excerpts;
}
