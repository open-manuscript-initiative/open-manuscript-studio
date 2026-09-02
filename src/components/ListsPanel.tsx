import { BookA, BookMarked, Images, ListPlus, ListTree, Plus, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { buildCaptionListEntries, getGeneratedListDefinitions, type OmiGeneratedListKind } from '../model/generatedLists';
import type { OmiTableOfContents } from '../model/tableOfContents';
import { AdvancedIndexEntryPanel } from './AdvancedIndexEntryPanel';
import { CategorizedReferenceListsPanel } from './CategorizedReferenceListsPanel';
import { IndexPanel } from './IndexPanel';
import { TableOfContentsPanel } from './TableOfContentsPanel';

type BuiltInKind = 'toc' | 'figures' | 'tables' | 'index' | 'references';

export function ListsPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const definitions = useMemo(() => getGeneratedListDefinitions(manuscript), [manuscript]);
  const [active, setActive] = useState<BuiltInKind>('toc');
  const [customTitle, setCustomTitle] = useState('');

  function persistDefinition(kind: OmiGeneratedListKind, title: string): void {
    const current = manuscript.generatedListDefinitions ?? [];
    if (current.some((item) => item.kind === kind && item.title === title)) return;
    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        generatedListDefinitions: [...current, { id: crypto.randomUUID(), kind, title }],
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function ensureToc(): void {
    if (!manuscript.tableOfContents) {
      const toc: OmiTableOfContents = {
        id: crypto.randomUUID(), title: copy.toc, minLevel: 1, maxLevel: 3,
        hyperlinks: true, useOutlineLevels: true, source: { format: 'manual' },
      };
      useStudioStore.setState((state) => ({ manuscript: { ...state.manuscript, tableOfContents: toc, updatedAt: new Date().toISOString() } }));
    }
    persistDefinition('toc', copy.toc);
    setActive('toc');
  }

  function createBuiltIn(kind: BuiltInKind): void {
    if (kind === 'toc') { ensureToc(); return; }
    if (kind === 'references') { setActive('references'); return; }
    const title = kind === 'figures' ? copy.figures : kind === 'tables' ? copy.tables : copy.indexes;
    persistDefinition(kind, title);
    setActive(kind);
  }

  function createCustom(): void {
    const title = customTitle.trim();
    if (!title) return;
    persistDefinition('custom', title);
    setCustomTitle('');
  }

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div><h3><ListTree size={18} aria-hidden="true" />{copy.title}</h3><p>{copy.description}</p></div>
        <span className="omi-notes-count">{definitions.length}</span>
      </div>

      <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.create}</strong>
        <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="studio-menu-secondary-action" onClick={() => createBuiltIn('toc')}><ListTree size={15} />{copy.toc}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => createBuiltIn('figures')}><Images size={15} />{copy.figures}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => createBuiltIn('tables')}><Table2 size={15} />{copy.tables}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => createBuiltIn('index')}><BookA size={15} />{copy.indexes}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => createBuiltIn('references')}><BookMarked size={15} />{copy.references}</button>
        </div>
        <div className="studio-tool-actions">
          <input value={customTitle} placeholder={copy.customPlaceholder} onChange={(event) => setCustomTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createCustom(); }} />
          <button type="button" className="studio-menu-secondary-action" onClick={createCustom}><Plus size={15} />{copy.custom}</button>
        </div>
      </div></div>

      <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.available}</strong>
        <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="studio-menu-secondary-action" onClick={() => setActive('toc')}>{copy.toc}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => setActive('figures')}>{copy.figures}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => setActive('tables')}>{copy.tables}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => setActive('index')}>{copy.indexes}</button>
          <button type="button" className="studio-menu-secondary-action" onClick={() => setActive('references')}>{copy.references}</button>
        </div>
        {definitions.filter((item) => item.kind === 'custom').map((item) => <p key={item.id}><ListPlus size={14} aria-hidden="true" /> {item.title}</p>)}
      </div></div>

      {active === 'toc' ? <TableOfContentsPanel onNavigate={onNavigate} /> : null}
      {active === 'index' ? <><AdvancedIndexEntryPanel /><IndexPanel onNavigate={onNavigate} /></> : null}
      {active === 'references' ? <CategorizedReferenceListsPanel /> : null}
      {active === 'figures' || active === 'tables' ? <CaptionList kind={active} onNavigate={onNavigate} /> : null}
    </section>
  );
}

function CaptionList({ kind, onNavigate }: { kind: 'figures' | 'tables'; onNavigate?: () => void }) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const entries = useMemo(() => buildCaptionListEntries(manuscript.sections, kind), [kind, manuscript.sections]);
  const selectSection = useStudioStore((state) => state.selectSection);
  const title = kind === 'figures' ? copy.figures : copy.tables;

  function navigate(blockId?: string): void {
    if (!blockId) return;
    const section = manuscript.sections.find((item) => item.blocks.some((block) => block.id === blockId));
    if (section) selectSection(section.id);
    onNavigate?.();
    document.querySelector<HTMLButtonElement>('.studio-menu-close')?.click();
    window.setTimeout(() => document.getElementById(`omi-target-${blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  }

  return <section className="studio-menu-view">
    <div className="studio-menu-view-header"><div><h3>{title}</h3><p>{copy.captionDescription}</p></div><span className="omi-notes-count">{entries.length}</span></div>
    {entries.length ? <div className="omi-notes-list">{entries.map((entry) => <button key={entry.id} type="button" className="studio-menu-secondary-action" onClick={() => navigate(entry.blockId)}>{entry.label}</button>)}</div> : <div className="omi-notes-empty"><p>{copy.noCaptions}</p></div>}
  </section>;
}

function getCopy(locale: string) {
  if (locale === 'hu') return { title: 'Közös jegyzékek', description: 'A teljes kötet strukturált jelöléseiből hozzon létre és kezeljen automatikusan frissülő jegyzékeket.', create: 'Új közös jegyzék létrehozása', available: 'Kötetjegyzékek', toc: 'Tartalomjegyzék', figures: 'Képek jegyzéke', tables: 'Táblázatok jegyzéke', indexes: 'Mutatók', references: 'Hivatkozásjegyzékek', custom: 'Egyéni jegyzék', customPlaceholder: 'Jegyzék neve', captionDescription: 'A kötet minden tanulmányának feliratozott elemeiből automatikusan generált közös jegyzék.', noCaptions: 'A kötetben még nincs ehhez a jegyzékhez használható feliratozott elem.' };
  if (locale === 'de') return { title: 'Gemeinsame Verzeichnisse', description: 'Erstellen und verwalten Sie automatisch aktualisierte Verzeichnisse aus den strukturierten Markierungen des gesamten Bandes.', create: 'Gemeinsames Verzeichnis erstellen', available: 'Bandverzeichnisse', toc: 'Inhaltsverzeichnis', figures: 'Abbildungsverzeichnis', tables: 'Tabellenverzeichnis', indexes: 'Register', references: 'Referenzverzeichnisse', custom: 'Benutzerdefiniert', customPlaceholder: 'Name des Verzeichnisses', captionDescription: 'Automatisch aus beschrifteten Elementen aller Bandbeiträge erzeugtes gemeinsames Verzeichnis.', noCaptions: 'Der Band enthält noch keine passenden beschrifteten Elemente.' };
  return { title: 'Shared lists', description: 'Create and manage automatically updated lists from structured markers across the whole volume.', create: 'Create shared list', available: 'Volume lists', toc: 'Table of contents', figures: 'List of figures', tables: 'List of tables', indexes: 'Indexes', references: 'Reference lists', custom: 'Custom list', customPlaceholder: 'List name', captionDescription: 'A shared list generated automatically from captioned elements in every study.', noCaptions: 'The volume does not yet contain captioned elements for this list.' };
}
