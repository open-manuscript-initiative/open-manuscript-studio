import { CornerDownRight, Link2, Plus, Quote, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  createIndexSubentry,
  createManualIndexEntry,
  indexEntryDisplayLabel,
  validateIndexEntries,
  type OmiIndexEntry,
  type OmiIndexEntryRelation,
  type OmiIndexTextRange,
} from '../model/indexing';

interface AdvancedIndexEntryPanelProps {
  indexId: string;
}

export function AdvancedIndexEntryPanel({ indexId }: AdvancedIndexEntryPanelProps) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const allEntries = manuscript.indexEntries ?? [];
  const entries = allEntries.filter((entry) => (entry.indexId ?? indexId) === indexId);
  const [term, setTerm] = useState('');
  const [parentEntryId, setParentEntryId] = useState('');
  const [relation, setRelation] = useState<OmiIndexEntryRelation>('location');
  const [relatedEntryId, setRelatedEntryId] = useState('');
  const [selectionRange, setSelectionRange] = useState<OmiIndexTextRange | null>(null);
  const [message, setMessage] = useState('');
  const blockIds = useMemo(
    () => new Set(manuscript.sections.flatMap((section) => section.blocks.map((block) => block.id))),
    [manuscript.sections],
  );
  const issues = useMemo(
    () => validateIndexEntries({ entries: allEntries, blockIds }).filter((issue) => entries.some((entry) => entry.id === issue.entryId)),
    [allEntries, blockIds, entries],
  );

  function persist(next: OmiIndexEntry[]): void {
    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        indexEntries: next,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function captureSelection(): void {
    const range = captureEditorTextRange();
    if (!range) {
      setMessage(copy.noSelection);
      return;
    }
    setSelectionRange(range);
    if (!term.trim() && range.text?.trim()) setTerm(range.text.trim());
    setMessage(copy.selectionCaptured);
  }

  function addEntry(): void {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    const parent = parentEntryId ? allEntries.find((entry) => entry.id === parentEntryId) : undefined;
    const related = relatedEntryId ? allEntries.find((entry) => entry.id === relatedEntryId) : undefined;
    try {
      const targetBlockId = selectionRange?.startBlockId;
      const entry = parent
        ? createIndexSubentry({
            parent,
            term: cleanTerm,
            targetBlockId,
            targetText: selectionRange?.text,
            targetTextOffset: selectionRange?.startOffset,
            range: relation === 'location' ? selectionRange ?? undefined : undefined,
          })
        : createManualIndexEntry({
            term: cleanTerm,
            indexId,
            targetBlockId,
            targetText: selectionRange?.text,
            targetTextOffset: selectionRange?.startOffset,
            relation,
            relatedEntryId: relation === 'location' ? undefined : related?.id,
            relatedTerm: relation === 'location' ? undefined : related ? indexEntryDisplayLabel(related) : undefined,
            range: relation === 'location' ? selectionRange ?? undefined : undefined,
          });

      const completed = parent && relation !== 'location'
        ? {
            ...entry,
            relation,
            relatedEntryId: related?.id,
            relatedTerm: related ? indexEntryDisplayLabel(related) : undefined,
            range: undefined,
            targetBlockId: undefined,
            targetTextOffset: undefined,
          }
        : entry;
      persist([...allEntries, completed]);
      setTerm('');
      setParentEntryId('');
      setRelatedEntryId('');
      setRelation('location');
      setSelectionRange(null);
      setMessage(copy.created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function removeEntry(id: string): void {
    persist(allEntries.filter((entry) => entry.id !== id).map((entry) => {
      if (entry.parentEntryId === id) return { ...entry, parentEntryId: undefined };
      if (entry.relatedEntryId === id) return { ...entry, relatedEntryId: undefined };
      return entry;
    }));
  }

  const selectableRelated = entries.filter((entry) => entry.id !== parentEntryId);

  return (
    <section className="studio-tool-card omi-advanced-index-entry-panel">
      <div style={{ width: '100%' }}>
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
        <div className="studio-manuscript-fields">
          <label>
            <span>{copy.term}</span>
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={copy.termPlaceholder} />
          </label>
          <label>
            <span>{copy.parent}</span>
            <select value={parentEntryId} onChange={(event) => setParentEntryId(event.target.value)}>
              <option value="">{copy.mainEntry}</option>
              {entries.map((entry) => <option key={entry.id} value={entry.id}>{indexEntryDisplayLabel(entry)}</option>)}
            </select>
          </label>
          <label>
            <span>{copy.relation}</span>
            <select value={relation} onChange={(event) => setRelation(event.target.value as OmiIndexEntryRelation)}>
              <option value="location">{copy.location}</option>
              <option value="see">{copy.see}</option>
              <option value="see-also">{copy.seeAlso}</option>
            </select>
          </label>
          {relation !== 'location' ? (
            <label>
              <span>{copy.related}</span>
              <select value={relatedEntryId} onChange={(event) => setRelatedEntryId(event.target.value)}>
                <option value="">—</option>
                {selectableRelated.map((entry) => <option key={entry.id} value={entry.id}>{indexEntryDisplayLabel(entry)}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        {relation === 'location' ? (
          <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="studio-menu-secondary-action" onClick={captureSelection}>
              <Quote size={15} aria-hidden="true" />{copy.captureSelection}
            </button>
            {selectionRange ? <small>{copy.range}: {selectionRange.text || copy.selectedRange}</small> : null}
          </div>
        ) : null}

        <div className="studio-tool-actions">
          <button
            type="button"
            className="studio-menu-secondary-action"
            disabled={!term.trim() || (relation !== 'location' && !relatedEntryId)}
            onClick={addEntry}
          >
            <Plus size={15} aria-hidden="true" />{parentEntryId ? copy.addSubentry : copy.addEntry}
          </button>
        </div>
        {message ? <p role="status">{message}</p> : null}

        {entries.length ? (
          <div className="omi-notes-list" style={{ marginTop: '.75rem' }}>
            {entries.map((entry) => {
              const relationLabel = entry.relation === 'see'
                ? copy.see
                : entry.relation === 'see-also'
                  ? copy.seeAlso
                  : entry.range
                    ? copy.range
                    : copy.location;
              const related = entry.relatedEntryId
                ? allEntries.find((candidate) => candidate.id === entry.relatedEntryId)
                : undefined;
              return (
                <div key={entry.id} className="omi-note-editor-card omi-note-editor-card--compact">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.6rem' }}>
                    <div>
                      <strong>{entry.parentEntryId ? <CornerDownRight size={14} aria-hidden="true" /> : null}{indexEntryDisplayLabel(entry)}</strong>
                      <small style={{ display: 'block' }}>
                        {entry.relation === 'see' || entry.relation === 'see-also' ? <Link2 size={13} aria-hidden="true" /> : null}
                        {relationLabel}{related ? ` → ${indexEntryDisplayLabel(related)}` : entry.relatedTerm ? ` → ${entry.relatedTerm}` : ''}
                      </small>
                    </div>
                    <button type="button" className="studio-menu-secondary-action" onClick={() => removeEntry(entry.id)} title={copy.delete}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {issues.length ? <p role="alert">{copy.validation}: {issues.length}</p> : null}
      </div>
    </section>
  );
}

function captureEditorTextRange(): OmiIndexTextRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const domRange = selection.getRangeAt(0);
  const startElement = closestBlock(domRange.startContainer);
  const endElement = closestBlock(domRange.endContainer);
  if (!startElement || !endElement) return null;
  const startBlockId = blockIdFromElement(startElement);
  const endBlockId = blockIdFromElement(endElement);
  if (!startBlockId || !endBlockId) return null;
  return {
    startBlockId,
    startOffset: textOffsetWithin(startElement, domRange.startContainer, domRange.startOffset),
    endBlockId,
    endOffset: textOffsetWithin(endElement, domRange.endContainer, domRange.endOffset),
    text: selection.toString(),
  };
}

function closestBlock(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>('[data-block-id], [id^="omi-target-"]') ?? null;
}

function blockIdFromElement(element: HTMLElement): string | null {
  return element.dataset.blockId ?? (element.id.startsWith('omi-target-') ? element.id.slice('omi-target-'.length) : null);
}

function textOffsetWithin(root: HTMLElement, node: Node, offset: number): number {
  try {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return 0;
  }
}

function getCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') return {
    title: 'Fejlett mutatóbejegyzés', description: 'Hozzon létre fő- és albejegyzéseket, Lásd/Lásd még kapcsolatokat, illetve stabil szövegtartományhoz kötött bejegyzéseket.',
    term: 'Bejegyzés', termPlaceholder: 'Pl. Bethlen Gábor', parent: 'Szint', mainEntry: 'Főbejegyzés', relation: 'Kapcsolat', location: 'Előfordulás', see: 'Lásd', seeAlso: 'Lásd még', related: 'Kapcsolódó bejegyzés', captureSelection: 'Kijelölt szöveg rögzítése', range: 'Szövegtartomány', selectedRange: 'kijelölt tartomány', addEntry: 'Bejegyzés hozzáadása', addSubentry: 'Albejegyzés hozzáadása', created: 'Mutatóbejegyzés létrehozva.', noSelection: 'Előbb jelöljön ki szöveget a dokumentumban.', selectionCaptured: 'A kijelölt szövegtartomány rögzítve.', delete: 'Törlés', validation: 'Ellenőrzési problémák',
  };
  if (language === 'de') return {
    title: 'Erweiterter Registereintrag', description: 'Erstellen Sie Haupt- und Untereinträge, Siehe/Siehe-auch-Verweise und Einträge für stabile Textbereiche.',
    term: 'Eintrag', termPlaceholder: 'z. B. Bethlen Gábor', parent: 'Ebene', mainEntry: 'Haupteintrag', relation: 'Beziehung', location: 'Vorkommen', see: 'Siehe', seeAlso: 'Siehe auch', related: 'Verknüpfter Eintrag', captureSelection: 'Textauswahl übernehmen', range: 'Textbereich', selectedRange: 'ausgewählter Bereich', addEntry: 'Eintrag hinzufügen', addSubentry: 'Untereintrag hinzufügen', created: 'Registereintrag erstellt.', noSelection: 'Markieren Sie zuerst Text im Dokument.', selectionCaptured: 'Der ausgewählte Textbereich wurde übernommen.', delete: 'Löschen', validation: 'Validierungsprobleme',
  };
  return {
    title: 'Advanced index entry', description: 'Create main entries, subentries, See/See also relations, and entries bound to stable text ranges.',
    term: 'Entry', termPlaceholder: 'e.g. Bethlen Gábor', parent: 'Level', mainEntry: 'Main entry', relation: 'Relation', location: 'Occurrence', see: 'See', seeAlso: 'See also', related: 'Related entry', captureSelection: 'Capture selected text', range: 'Text range', selectedRange: 'selected range', addEntry: 'Add entry', addSubentry: 'Add subentry', created: 'Index entry created.', noSelection: 'Select text in the document first.', selectionCaptured: 'Selected text range captured.', delete: 'Delete', validation: 'Validation issues',
  };
}