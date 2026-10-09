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
  'org.omi.legal-sources': '',
  'org.omi.research-reproducibility': '',
  'org.omi.spatial-research': '',
  'org.omi.archaeology': '',
  'org.omi.experimental-laboratory': '',
  'org.omi.social-research-methods': '',
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
  if (prefix === undefined || typeof window === 'undefined') return [];
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
  else if (moduleId === 'org.omi.legal-sources') {
    for (const item of items(project.sources)) {
      const legal = record(item);
      if (!legal) continue;
      for (const itemVersion of items(legal.versions)) {
        const version = record(itemVersion);
        if (version) add(string(version.id), [string(legal.title), string(version.date)].filter(Boolean).join(' · '), string(version.text), string(version.url) || string(legal.url) || string(legal.citation));
      }
    }
  } else if (moduleId === 'org.omi.research-reproducibility') {
    for (const item of items(project.outputs)) {
      const output = record(item);
      if (output) add(string(output.id), string(output.title), string(output.notes), string(output.persistentId) || string(output.repository));
    }
  } else if (moduleId === 'org.omi.spatial-research') {
    for (const item of items(project.features)) {
      const feature = record(item);
      if (feature) add(string(feature.id), string(feature.name), string(feature.notes), string(feature.source));
    }
  } else if (moduleId === 'org.omi.archaeology') {
    for (const item of items(project.contexts)) {
      const context = record(item);
      if (context) add(string(context.id), string(context.locus), string(context.description), string(context.source));
    }
  } else if (moduleId === 'org.omi.experimental-laboratory' && project.schemaVersion === 1) {
    for (const studyItem of items(project.studies)) {
      const study = record(studyItem);
      if (!study) continue;
      for (const item of items(study.protocols)) {
        const protocol = record(item);
        if (protocol) add(string(protocol.id), [string(study.title), string(protocol.title)].filter(Boolean).join(' · '), string(protocol.steps), string(protocol.source));
      }
    }
  } else if (moduleId === 'org.omi.social-research-methods') {
    // Research design is shareable only after explicit review. Never project
    // transcripts, participant identifiers, coding notes or ethics records.
    add('research-design', string(project.title), string(project.method), '');
  }
  return excerpts;
}
