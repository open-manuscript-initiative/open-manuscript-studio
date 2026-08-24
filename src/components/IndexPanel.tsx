import { BookA, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { groupIndexEntries, type OmiIndexEntry } from '../model/indexing';

const labels: Record<string, {
  title: string;
  description: string;
  empty: string;
  entries: string;
  occurrences: string;
  imported: string;
  goTo: string;
  noLocation: string;
}> = {
  en: {
    title: 'Name index',
    description: 'Semantic index entries preserved from Word XE fields and manual text selections.',
    empty: 'No index markers are stored in this manuscript.',
    entries: 'Index entries',
    occurrences: 'occurrences',
    imported: 'Imported generated index',
    goTo: 'Go to occurrence',
    noLocation: 'Location is not available for this imported marker yet.',
  },
  hu: {
    title: 'Névmutató',
    description: 'A Word XE mezőiből és kézi szövegkijelölésből megőrzött szemantikus névmutató-bejegyzések.',
    empty: 'A kézirat nem tartalmaz névmutató-jelöléseket.',
    entries: 'Névmutató-bejegyzések',
    occurrences: 'előfordulás',
    imported: 'Importált generált névmutató',
    goTo: 'Ugrás az előforduláshoz',
    noLocation: 'Ehhez az importált jelöléshez még nincs pontos helyadat.',
  },
  de: {
    title: 'Personenregister',
    description: 'Semantische Registereinträge aus Word-XE-Feldern und manuellen Textmarkierungen.',
    empty: 'Dieses Manuskript enthält keine Registermarkierungen.',
    entries: 'Registereinträge',
    occurrences: 'Vorkommen',
    imported: 'Importiertes generiertes Register',
    goTo: 'Zum Vorkommen',
    noLocation: 'Für diese importierte Markierung ist noch keine genaue Position verfügbar.',
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
  const groups = useMemo(() => groupIndexEntries(entries), [entries]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  function navigateToEntry(entry: OmiIndexEntry): void {
    if (!entry.targetBlockId) return;
    const section = manuscript.sections.find((candidate) =>
      candidate.blocks.some((block) => block.id === entry.targetBlockId),
    );
    if (section) selectSection(section.id);
    onNavigate?.();

    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-block-id="${cssEscape(entry.targetBlockId ?? '')}"]`,
      );
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (entry.targetText) selectText(target, entry.targetText);
      target.classList.add('omi-index-navigation-target');
      window.setTimeout(() => target.classList.remove('omi-index-navigation-target'), 1600);
    }, 80);
  }

  return (
    <section className="studio-menu-view omi-index-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3>
            <BookA size={18} aria-hidden="true" />
            {copy.title}
          </h3>
          <p>{copy.description}</p>
        </div>
        <span className="omi-notes-count">{entries.length}</span>
      </div>

      {generatedIndexes.length > 0 ? (
        <div className="studio-tool-card">
          <div>
            <strong>{copy.imported}</strong>
            <p>{generatedIndexes.length}</p>
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="omi-notes-empty">
          <BookA size={22} aria-hidden="true" />
          <p>{copy.empty}</p>
        </div>
      ) : (
        <div className="omi-notes-list" aria-label={copy.entries}>
          {groups.map((group) => {
            const expanded = openGroup === group.key;
            return (
              <div key={group.key} className="omi-note-editor-card omi-note-editor-card--compact">
                <button
                  type="button"
                  className="studio-menu-secondary-action"
                  onClick={() => setOpenGroup(expanded ? null : group.key)}
                  aria-expanded={expanded}
                >
                  <strong>{group.label}</strong>
                  <span>{group.count} {copy.occurrences}</span>
                </button>

                {expanded ? (
                  <div className="omi-index-occurrences">
                    {group.entries.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="studio-menu-secondary-action"
                        disabled={!entry.targetBlockId}
                        title={entry.targetBlockId ? copy.goTo : copy.noLocation}
                        onClick={() => navigateToEntry(entry)}
                      >
                        <MapPin size={15} aria-hidden="true" />
                        <span>{index + 1}. {entry.targetText || group.label}</span>
                      </button>
                    ))}
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

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function selectText(root: HTMLElement, needle: string): void {
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
  const start = combined.toLocaleLowerCase().indexOf(text.toLocaleLowerCase());
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
