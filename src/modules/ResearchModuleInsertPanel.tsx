import { useMemo } from 'react';

import { stageInsertBlocks } from '../app/visualBlockActions';
import { useAuthStore, getCurrentUser } from '../store/authStore';
import type { OmiBlock } from '../types/omi';
import { readStudioModulePreferences } from './preferences';
import { builtinModuleManifests } from './catalog';
import { getModuleShellCopy } from './moduleShellTranslations';
import { newWorkspaceId } from './disciplineWorkspace';

const WORKSPACE_ID = 'default';
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
    ? { title: 'Kutatási modulok', insert: 'Modulszakasz beszúrása', empty: 'Nincs aktív kutatási modul.', inserted: 'Csak a modul címe és leírása kerül a kéziratba. A kutatási adatok a modul munkaterében maradnak.' }
    : locale === 'de'
      ? { title: 'Forschungsmodule', insert: 'Modulabschnitt einfügen', empty: 'Kein Forschungsmodul ist aktiv.', inserted: 'Nur Titel und Beschreibung werden eingefügt. Forschungsdaten bleiben im Modul-Arbeitsbereich.' }
      : { title: 'Research modules', insert: 'Insert module section', empty: 'No research module is active.', inserted: 'Only the module title and description are inserted. Research data remains in the module workspace.' };

  function insertModule(module: typeof builtinModuleManifests[number]): void {
    const details = copy.modules[module.id];
    const paragraphs = [
      heading(details?.title ?? module.titleKey),
      paragraph(details?.description ?? module.descriptionKey),
    ];
    const block: OmiBlock = {
      id: newWorkspaceId(),
      type: 'paragraph',
      content: JSON.stringify({ type: 'doc', content: paragraphs }),
    };
    if (stageInsertBlocks(sectionId, gapIndex, [block], `Insert ${details?.title ?? module.titleKey} module section`)) {
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

function heading(value: string) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: value }] };
}

function paragraph(value: string) {
  return { type: 'paragraph', content: [{ type: 'text', text: value }] };
}
