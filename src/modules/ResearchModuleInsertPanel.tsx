import { getResearchModuleCopyByLocale } from './moduleTranslationCatalog';
import { sortModulesForLocale } from './moduleOrdering';
import { MathematicsPanel } from './mathematics/MathematicsPanel';
import { useMemo, useState } from 'react';

import { stageInsertBlocks } from '../app/visualBlockActions';
import { useAuthStore, getCurrentUser } from '../store/authStore';
import type { OmiBlock } from '../types/omi';
import { readStudioModulePreferences } from './preferences';
import { builtinModuleManifests } from './catalog';
import { getModuleShellCopy } from './moduleShellTranslations';
import { normalizeModuleLocale } from './moduleLocale';
import { newWorkspaceId } from './disciplineWorkspace';
import { readResearchExcerpts, type ResearchExcerpt } from './researchModuleProjection';

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
  const language = normalizeModuleLocale(locale);
  const modules = sortModulesForLocale(builtinModuleManifests, locale).filter((module) =>
    preferences.activeModuleIds.includes(module.id),
  );
  const [activeModuleId, setActiveModuleId] = useState('');
  const [candidates, setCandidates] = useState<ResearchExcerpt[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [source, setSource] = useState('');
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const actionCopy = getResearchModuleCopyByLocale('research-module-insert-panel/actionCopy')[language];

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

  function chooseModule(moduleId: string): void {
    setCandidates(readResearchExcerpts(moduleId, userId));
    setActiveModuleId(moduleId);
    setSelectedId('');
    setSource('');
    setApproved(false);
    setError('');
  }

  function chooseExcerpt(id: string): void {
    const candidate = candidates.find((item) => item.id === id);
    setSelectedId(id);
    setSource(candidate?.source ?? '');
    setApproved(false);
    setError('');
  }

  function insertExcerpt(): void {
    if (!selected || !activeModuleId || !source.trim() || !approved) {
      setError(actionCopy.missing);
      return;
    }
    const current = readResearchExcerpts(activeModuleId, userId)
      .find((item) => item.id === selected.id);
    if (!current || current.text !== selected.text || current.label !== selected.label) {
      setApproved(false);
      setError(actionCopy.changed);
      return;
    }
    if (selected.text.length > 20000) {
      setError(actionCopy.tooLong);
      return;
    }
    const content = [
      heading(selected.label),
      ...selected.text.split(/\r?\n/).map(paragraph),
      paragraph(`${actionCopy.source}: ${source.trim()}`),
    ];
    const block: OmiBlock = {
      id: newWorkspaceId(),
      type: 'paragraph',
      content: JSON.stringify({ type: 'doc', content }),
    };
    if (stageInsertBlocks(sectionId, gapIndex, [block], `Insert sourced research excerpt`)) {
      setApproved(false);
      setSelectedId('');
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
          if (module.id === 'org.omi.mathematics') return (
            <details key={module.id} className="omi-module-insert-group">
              <summary>{copy.modules[module.id]?.title}</summary>
              <MathematicsPanel locale={locale} sectionId={sectionId} gapIndex={gapIndex} onInserted={onInserted} />
            </details>
          );
          const details = copy.modules[module.id];
          return (
            <div key={module.id}>
              <button type="button" onClick={() => insertModule(module)}>
                {actionCopy.insert}: {details?.title ?? module.titleKey}
              </button>
              <button type="button" onClick={() => chooseModule(module.id)}>
                {actionCopy.choose}: {details?.title ?? module.titleKey}
              </button>
            </div>
          );
        })}
      </div>
      {activeModuleId && (
        <div className="omi-module-excerpt-preview">
          {candidates.length === 0 ? <p>{actionCopy.noData}</p> : (
            <>
              <label>{actionCopy.excerpt}
                <select value={selectedId} onChange={(event) => chooseExcerpt(event.target.value)}>
                  <option value="">—</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                  ))}
                </select>
              </label>
              {selected && (
                <>
                  <h5>{actionCopy.preview}</h5>
                  <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.text}</p>
                  <label>{actionCopy.source}
                    <input required value={source} onChange={(event) => { setSource(event.target.value); setApproved(false); }} />
                  </label>
                  <label>
                    <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
                    {actionCopy.approve}
                  </label>
                  {error && <p role="alert">{error}</p>}
                  <button type="button" disabled={!source.trim() || !approved || selected.text.length > 20000} onClick={insertExcerpt}>
                    {actionCopy.confirm}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}

function heading(value: string) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: value }] };
}
function paragraph(value: string) {
  return { type: 'paragraph', content: [{ type: 'text', text: value }] };
}
