import { BookA, MapPin, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  DEFAULT_INDEX_ID,
  getDocumentIndexDefinitions,
  groupIndexEntries,
  type OmiIndexDefinition,
  type OmiIndexEntry,
} from '../model/indexing';

const labels: Record<string, {
  title: string;
  description: string;
  empty: string;
  entries: string;
  occurrences: string;
  imported: string;
  goTo: string;
  noLocation: string;
  create: string;
  newName: string;
  rename: string;
  noEntries: string;
}> = {
  en: {
    title: 'Indexes',
    description: 'Create and name document indexes such as a name index, place index or list of figures.',
    empty: 'No index markers are stored in this manuscript.',
    entries: 'Index entries',
    occurrences: 'occurrences',
    imported: 'Imported generated indexes',
    goTo: 'Go to occurrence',
    noLocation: 'Location is not available for this imported marker yet.',
    create: 'New index',
    newName: 'Index name',
    rename: 'Rename',
    noEntries: 'This index has no entries yet. Select text in the document and add it to this index.',
  },
  hu: {
    title: 'Mutatók',
    description: 'Hozzon létre és nevezzen el tetszőleges dokumentummutatókat, például névmutatót, helységmutatót vagy képek jegyzékét.',
    empty: 'A kézirat nem tartalmaz mutatójelöléseket.',
    entries: 'Mutatóbejegyzések',
    occurrences: 'előfordulás',
    imported: 'Importált generált mutatók',
    goTo: 'Ugrás az előforduláshoz',
    noLocation: 'Ehhez az importált jelöléshez még nincs pontos helyadat.',
    create: 'Új mutató',
    newName: 'Mutató neve',
    rename: 'Átnevezés',
    noEntries: 'Ebben a mutatóban még nincs bejegyzés. Jelöljön ki szöveget a dokumentumban, majd adja hozzá ehhez a mutatóhoz.',
  },
  de: {
    title: 'Register',
    description: 'Erstellen und benennen Sie beliebige Register, etwa Personen-, Orts- oder Abbildungsverzeichnisse.',
    empty: 'Dieses Manuskript enthält keine Registermarkierungen.',
    entries: 'Registereinträge',
    occurrences: 'Vorkommen',
    imported: 'Importierte generierte Register',
    goTo: 'Zum Vorkommen',
    noLocation: 'Für diese importierte Markierung ist noch keine genaue Position verfügbar.',
    create: 'Neues Register',
    newName: 'Registername',
    rename: 'Umbenennen',
    noEntries: 'Dieses Register enthält noch keine Einträge. Markieren Sie Text im Dokument und fügen Sie ihn diesem Register hinzu.',
  },
};

interface IndexPanelProps {
  onNavigate?: () => void;
}

export function IndexPanel({ onNavigate }: IndexPanelProps) {
  const { locale } = useTranslation();
  const copy = labels[locale] ?? labels.en;
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const entries = manuscript.indexEntries ?? [];
  const generatedIndexes = manuscript.generatedIndexes ?? [];
  const definitions = useMemo(
    () => getDocumentIndexDefinitions({
      locale,
      indexDefinitions: manuscript.indexDefinitions,
      entries,
    }),
    [entries, locale, manuscript.indexDefinitions],
  );
  const [activeIndexId, setActiveIndexId] = useState<string>(
    definitions[0]?.id ?? DEFAULT_INDEX_ID,
  );
  const activeDefinition = definitions.find((item) => item.id === activeIndexId) ?? definitions[0];
  const activeEntries = entries.filter((entry) =>
    entry.indexId ? entry.indexId === activeDefinition?.id : activeDefinition?.id === DEFAULT_INDEX_ID,
  );
  const groups = useMemo(() => groupIndexEntries(activeEntries), [activeEntries]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [newIndexName, setNewIndexName] = useState('');

  function persistDefinitions(next: OmiIndexDefinition[]): void {
    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        indexDefinitions: next,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function createIndex(): void {
    const title = newIndexName.trim();
    if (!title) return;
    const definition: OmiIndexDefinition = { id: crypto.randomUUID(), title };
    persistDefinitions([...definitions, definition]);
    setActiveIndexId(definition.id);
    setNewIndexName('');
  }

  function renameActiveIndex(): void {
    if (!activeDefinition) return;
    const nextTitle = window.prompt(copy.newName, activeDefinition.title)?.trim();
    if (!nextTitle || nextTitle === activeDefinition.title) return;
    persistDefinitions(definitions.map((item) =>
      item.id === activeDefinition.id ? { ...item, title: nextTitle } : item,
    ));
  }

  function resolveEntry(entry: OmiIndexEntry, occurrenceIndex: number, fallbackText: string): OmiIndexEntry | null {
    if (entry.targetBlockId) return entry;

    const needle = (entry.targetText || fallbackText || entry.terms.at(-1) || '').trim();
    if (!needle) return null;
    const normalizedNeedle = needle.toLocaleLowerCase();
    let seen = 0;

    for (const section of manuscript.sections) {
      for (const block of section.blocks) {
        const text = blockPlainText(block.content);
        if (!text) continue;
        const normalizedText = text.toLocaleLowerCase();
        let from = 0;
        while (from <= normalizedText.length - normalizedNeedle.length) {
          const found = normalizedText.indexOf(normalizedNeedle, from);
          if (found < 0) break;
          if (seen === occurrenceIndex) {
            return {
              ...entry,
              targetBlockId: block.id,
              targetText: needle,
              targetTextOffset: found,
            };
          }
          seen += 1;
          from = found + Math.max(1, normalizedNeedle.length);
        }
      }
    }

    return null;
  }

  function navigateToEntry(entry: OmiIndexEntry, occurrenceIndex: number, fallbackText: string): void {
    const resolved = resolveEntry(entry, occurrenceIndex, fallbackText);
    if (!resolved?.targetBlockId) return;
    const section = manuscript.sections.find((candidate) =>
      candidate.blocks.some((block) => block.id === resolved.targetBlockId),
    );
    if (section) selectSection(section.id);
    onNavigate?.();
    document.querySelector<HTMLButtonElement>('.studio-menu-close')?.click();
    revealTarget(resolved, 0);
  }

  function revealTarget(entry: OmiIndexEntry, attempt: number): void {
    window.setTimeout(() => {
      const target = document.getElementById(`omi-target-${entry.targetBlockId}`)
        ?? document.querySelector<HTMLElement>(`[data-block-id="${cssEscape(entry.targetBlockId ?? '')}"]`);
      if (!target) {
        if (attempt < 12) revealTarget(entry, attempt + 1);
        return;
      }
      target.scrollIntoView({ behavior: attempt === 0 ? 'smooth' : 'auto', block: 'center' });
      if (entry.targetText) selectText(target, entry.targetText, entry.targetTextOffset);
      target.classList.add('omi-index-navigation-target');
      window.setTimeout(() => target.classList.remove('omi-index-navigation-target'), 1600);
    }, attempt === 0 ? 100 : 100);
  }

  return (
    <section className="studio-menu-view omi-index-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3><BookA size={18} aria-hidden="true" />{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <span className="omi-notes-count">{entries.length}</span>
      </div>

      <div className="studio-tool-card">
        <div style={{ width: '100%' }}>
          <strong>{copy.title}</strong>
          <select value={activeDefinition?.id ?? ''} onChange={(event) => { setActiveIndexId(event.target.value); setOpenGroup(null); }}>
            {definitions.map((definition) => (
              <option key={definition.id} value={definition.id}>{definition.title}</option>
            ))}
          </select>
          <div className="studio-tool-actions">
            <input value={newIndexName} placeholder={copy.newName} onChange={(event) => setNewIndexName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createIndex(); }} />
            <button type="button" className="studio-menu-secondary-action" onClick={createIndex}><Plus size={15} aria-hidden="true" />{copy.create}</button>
            <button type="button" className="studio-menu-secondary-action" onClick={renameActiveIndex}>{copy.rename}</button>
          </div>
        </div>
      </div>

      {generatedIndexes.length > 0 ? (
        <div className="studio-tool-card"><div><strong>{copy.imported}</strong><p>{generatedIndexes.length}</p></div></div>
      ) : null}

      {definitions.length === 0 && groups.length === 0 ? (
        <div className="omi-notes-empty"><BookA size={22} aria-hidden="true" /><p>{copy.empty}</p></div>
      ) : groups.length === 0 ? (
        <div className="omi-notes-empty"><BookA size={22} aria-hidden="true" /><p>{copy.noEntries}</p></div>
      ) : (
        <div className="omi-notes-list" aria-label={copy.entries}>
          {groups.map((group) => {
            const expanded = openGroup === group.key;
            return (
              <div key={group.key} className="omi-note-editor-card omi-note-editor-card--compact">
                <button type="button" className="studio-menu-secondary-action" onClick={() => setOpenGroup(expanded ? null : group.key)} aria-expanded={expanded}>
                  <strong>{group.label}</strong><span>{group.count} {copy.occurrences}</span>
                </button>
                {expanded ? (
                  <div className="omi-index-occurrences">
                    {group.entries.map((entry, index) => {
                      const resolved = resolveEntry(entry, index, group.label);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className="studio-menu-secondary-action"
                          disabled={!resolved?.targetBlockId}
                          title={resolved?.targetBlockId ? copy.goTo : copy.noLocation}
                          onClick={() => navigateToEntry(entry, index, group.label)}
                        >
                          <MapPin size={15} aria-hidden="true" />
                          <span>{index + 1}. {entry.targetText || group.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function blockPlainText(content: string): string {
  try {
    const value = JSON.parse(content) as unknown;
    return collectNodeText(value);
  } catch {
    return content.replace(/<[^>]+>/g, ' ');
  }
}

function collectNodeText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown };
  const own = typeof node.text === 'string' ? node.text : '';
  const children = Array.isArray(node.content)
    ? node.content.map((child) => collectNodeText(child)).join('')
    : '';
  return `${own}${children}`;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

function selectText(root: HTMLElement, needle: string, preferredOffset?: number): void {
  const text = needle.trim();
  if (!text) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let combined = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    nodes.push(node);
    combined += node.data;
  }
  const normalizedNeedle = text.toLocaleLowerCase();
  let start = -1;
  if (typeof preferredOffset === 'number' && preferredOffset >= 0) {
    const candidate = combined.slice(preferredOffset, preferredOffset + text.length);
    if (candidate.toLocaleLowerCase() === normalizedNeedle) start = preferredOffset;
  }
  if (start < 0) start = combined.toLocaleLowerCase().indexOf(normalizedNeedle);
  if (start < 0) return;
  const end = start + text.length;
  let offset = 0;
  let startNode: Text | undefined;
  let endNode: Text | undefined;
  let startOffset = 0;
  let endOffset = 0;
  for (const node of nodes) {
    const next = offset + node.data.length;
    if (!startNode && start >= offset && start <= next) {
      startNode = node;
      startOffset = start - offset;
    }
    if (end >= offset && end <= next) {
      endNode = node;
      endOffset = end - offset;
      break;
    }
    offset = next;
  }
  if (!startNode || !endNode) return;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
