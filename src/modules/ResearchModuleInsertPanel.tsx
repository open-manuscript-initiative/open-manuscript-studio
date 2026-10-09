import { useMemo } from 'react';

import { stageInsertBlocks } from '../app/visualBlockActions';
import { useAuthStore, getCurrentUser } from '../store/authStore';
import type { OmiBlock } from '../types/omi';
import { readStudioModulePreferences } from './preferences';
import { builtinModuleManifests } from './catalog';
import { getModuleShellCopy } from './moduleShellTranslations';
import { getDisciplineWorkspaceStorageKey, newWorkspaceId } from './disciplineWorkspace';

const WORKSPACE_ID = 'default';
const STORAGE_PREFIXES: Readonly<Record<string, string>> = {
  'org.omi.critical-text-edition': 'omi:critical-edition:v1:',
  'org.omi.corpus-linguistics': 'omi:corpus-linguistics:v1:',
  'org.omi.musicology': 'omi:musicology:v1:',
  'org.omi.cultural-heritage': 'omi:cultural-heritage:v1:',
};

interface ResearchModuleInsertPanelProps {
  locale: string;
  sectionId: string;
  gapIndex: number;
  onInserted?: () => void;
}

export function ResearchModuleInsertPanel({
  locale,
  sectionId,
  gapIndex,
  onInserted,
}: ResearchModuleInsertPanelProps) {
  const user = useAuthStore(getCurrentUser);
  const userId = String(user?.id ?? 'anonymous');
  const preferences = useMemo(
    () => readStudioModulePreferences(userId, WORKSPACE_ID),
    [userId],
  );
  const copy = getModuleShellCopy(locale);
  const modules = builtinModuleManifests.filter((module) =>
    preferences.activeModuleIds.includes(module.id),
  );
  const actionCopy = locale === 'hu'
    ? { title: 'Kutatási modulok', insert: 'Moduladatok beszúrása', empty: 'Nincs aktív kutatási modul.', emptyData: 'Még nincs mentett moduladat; a szakasz előkészítő címmel és leírással kerül be.', inserted: 'A modul szakasza és mentett adatai bekerülnek az aktuális kéziratba.' }
    : locale === 'de'
      ? { title: 'Forschungsmodule', insert: 'Moduldaten einfügen', empty: 'Kein Forschungsmodul ist aktiv.', emptyData: 'Es sind noch keine Moduldaten gespeichert; der Abschnitt wird mit Titel und Beschreibung vorbereitet.', inserted: 'Der Modulabschnitt und die gespeicherten Daten werden in das aktuelle Manuskript eingefügt.' }
      : { title: 'Research modules', insert: 'Insert module data', empty: 'No research module is active.', emptyData: 'No module data is saved yet; the section will be inserted with its title and description.', inserted: 'The module section and its saved data will be inserted into the current manuscript.' };

  function insertModule(module: typeof builtinModuleManifests[number]): void {
    const details = copy.modules[module.id];
    const workspace = readModuleWorkspace(module.id, userId);
    const lines = workspace ? flattenModuleData(workspace) : [];
    const paragraphs = [
      heading(details?.title ?? module.titleKey),
      paragraph(details?.description ?? module.descriptionKey),
      ...(lines.length > 0
        ? lines.map(paragraph)
        : [paragraph(actionCopy.emptyData)]),
    ];
    const block: OmiBlock = {
      id: newWorkspaceId(),
      type: 'paragraph',
      content: JSON.stringify({ type: 'doc', content: paragraphs }),
    };
    if (stageInsertBlocks(sectionId, gapIndex, [block], `Insert ${details?.title ?? module.titleKey} module data`)) {
      onInserted?.();
    }
  }

  if (modules.length === 0) return null;

  return (
    <details className="omi-module-insert-group">
      <summary>{actionCopy.title}</summary>
      <p className="omi-visual-format-hint">{actionCopy.inserted}</p>
      <div className="omi-visual-insert-actions">
        {modules.map((module) => {
          const details = copy.modules[module.id];
          return (
            <button key={module.id} type="button" onClick={() => insertModule(module)}>
              {actionCopy.insert}: {details?.title ?? module.titleKey}
            </button>
          );
        })}
      </div>
    </details>
  );
}

function readModuleWorkspace(moduleId: string, userId: string): unknown {
  const suffix = getDisciplineWorkspaceStorageKey(userId, WORKSPACE_ID, moduleId);
  const key = `${STORAGE_PREFIXES[moduleId] ?? ''}${suffix}`;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as unknown : null;
  } catch {
    return null;
  }
}

function flattenModuleData(value: unknown): string[] {
  const lines: string[] = [];
  const visit = (current: unknown, path: string, depth: number): void => {
    if (lines.length >= 60 || depth > 5 || current === null || current === undefined) return;
    if (typeof current === 'string') {
      const text = current.trim();
      if (text) lines.push(`${humanize(path)}: ${text.slice(0, 600)}`);
      return;
    }
    if (typeof current === 'number' || typeof current === 'boolean') {
      lines.push(`${humanize(path)}: ${current}`);
      return;
    }
    if (Array.isArray(current)) {
      current.slice(0, 25).forEach((item, index) => visit(item, `${path} ${index + 1}`, depth + 1));
      return;
    }
    if (typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (key === 'id' || key === 'version' || key.startsWith('_')) continue;
      visit(child, path ? `${path} · ${key}` : key, depth + 1);
      if (lines.length >= 60) break;
    }
  };
  visit(value, '', 0);
  return lines;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (character) => character.toLocaleUpperCase());
}

function heading(value: string) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: value }] };
}

function paragraph(value: string) {
  return { type: 'paragraph', content: [{ type: 'text', text: value }] };
}
