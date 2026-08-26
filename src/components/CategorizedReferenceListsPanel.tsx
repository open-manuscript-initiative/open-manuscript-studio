import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  buildCategorizedReferenceGroups,
  createCategorizedReferenceList,
  createReferenceListCategory,
  REFERENCE_LIST_CATEGORY_PRESETS,
  validateCategorizedReferenceLists,
  type OmiCategorizedReferenceList,
} from '../model/categorizedReferenceLists';

export function CategorizedReferenceListsPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const lists = manuscript.categorizedReferenceLists ?? [];
  const [activeListId, setActiveListId] = useState(lists[0]?.id ?? '');
  const [newListTitle, setNewListTitle] = useState('');
  const [customCategoryTitle, setCustomCategoryTitle] = useState('');
  const [customTypes, setCustomTypes] = useState('');
  const active = lists.find((list) => list.id === activeListId) ?? lists[0];
  const groups = useMemo(() => active ? buildCategorizedReferenceGroups(manuscript, active) : [], [active, manuscript]);
  const issues = useMemo(() => validateCategorizedReferenceLists(manuscript), [manuscript]);

  function persist(next: OmiCategorizedReferenceList[]): void {
    useStudioStore.setState((state) => ({
      manuscript: { ...state.manuscript, categorizedReferenceLists: next, updatedAt: new Date().toISOString() },
    }));
  }

  function createList(): void {
    const title = newListTitle.trim();
    if (!title) return;
    const list = createCategorizedReferenceList({ title });
    persist([...lists, list]);
    setActiveListId(list.id);
    setNewListTitle('');
  }

  function addPreset(kind: string): void {
    if (!active) return;
    const preset = REFERENCE_LIST_CATEGORY_PRESETS.find((item) => item.kind === kind);
    if (!preset || active.categories.some((category) => category.kind === preset.kind)) return;
    const category = createReferenceListCategory({ ...preset, title: localizedPresetLabel(preset.kind, locale) });
    persist(lists.map((list) => list.id === active.id ? { ...list, categories: [...list.categories, category], modifiedAt: new Date().toISOString() } : list));
  }

  function addCustomCategory(): void {
    if (!active || !customCategoryTitle.trim()) return;
    const category = createReferenceListCategory({
      title: customCategoryTitle,
      kind: 'custom',
      resourceTypes: customTypes.split(',').map((value) => value.trim()).filter(Boolean),
    });
    persist(lists.map((list) => list.id === active.id ? { ...list, categories: [...list.categories, category], modifiedAt: new Date().toISOString() } : list));
    setCustomCategoryTitle('');
    setCustomTypes('');
  }

  function removeCategory(categoryId: string): void {
    if (!active) return;
    persist(lists.map((list) => list.id === active.id ? { ...list, categories: list.categories.filter((category) => category.id !== categoryId), modifiedAt: new Date().toISOString() } : list));
  }

  function toggleIncludeUncited(value: boolean): void {
    if (!active) return;
    persist(lists.map((list) => list.id === active.id ? { ...list, includeUncited: value, modifiedAt: new Date().toISOString() } : list));
  }

  function removeList(): void {
    if (!active) return;
    const next = lists.filter((list) => list.id !== active.id);
    persist(next);
    setActiveListId(next[0]?.id ?? '');
  }

  return (
    <section className="studio-menu-view omi-categorized-reference-lists-panel">
      <div className="studio-menu-view-header">
        <div><h3><BookMarked size={18} aria-hidden="true" />{copy.title}</h3><p>{copy.description}</p></div>
        <span className="omi-notes-count">{lists.length}</span>
      </div>

      <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.createList}</strong>
        <div className="studio-tool-actions">
          <input value={newListTitle} onChange={(event) => setNewListTitle(event.target.value)} placeholder={copy.listTitlePlaceholder} onKeyDown={(event) => { if (event.key === 'Enter') createList(); }} />
          <button type="button" className="studio-menu-secondary-action" onClick={createList} disabled={!newListTitle.trim()}><Plus size={15} />{copy.add}</button>
        </div>
      </div></div>

      {lists.length ? <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.lists}</strong>
        <select value={active?.id ?? ''} onChange={(event) => setActiveListId(event.target.value)}>
          {lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
        </select>
      </div></div> : null}

      {active ? <>
        <div className="studio-tool-card"><div style={{ width: '100%' }}>
          <strong>{copy.categories}</strong>
          <p>{copy.categoriesDescription}</p>
          <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
            {REFERENCE_LIST_CATEGORY_PRESETS.map((preset) => (
              <button key={preset.kind} type="button" className="studio-menu-secondary-action" onClick={() => addPreset(preset.kind)}>{localizedPresetLabel(preset.kind, locale)}</button>
            ))}
          </div>
          <div className="studio-manuscript-fields">
            <label><span>{copy.customCategory}</span><input value={customCategoryTitle} onChange={(event) => setCustomCategoryTitle(event.target.value)} placeholder={copy.categoryPlaceholder} /></label>
            <label><span>{copy.resourceTypes}</span><input value={customTypes} onChange={(event) => setCustomTypes(event.target.value)} placeholder="archival-source, book, standard" /></label>
          </div>
          <div className="studio-tool-actions"><button type="button" className="studio-menu-secondary-action" onClick={addCustomCategory} disabled={!customCategoryTitle.trim()}><Plus size={15} />{copy.addCategory}</button></div>
          <label><input type="checkbox" checked={Boolean(active.includeUncited)} onChange={(event) => toggleIncludeUncited(event.target.checked)} /> {copy.includeUncited}</label>
        </div></div>

        {groups.map((group) => (
          <div key={group.category.id} className="studio-tool-card"><div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
              <div><strong>{group.category.title}</strong><p>{group.entries.length} {copy.entries}</p></div>
              <button type="button" className="studio-menu-secondary-action" onClick={() => removeCategory(group.category.id)} title={copy.delete}><Trash2 size={14} /></button>
            </div>
            {group.entries.length ? <div className="omi-notes-list">{group.entries.map((entry) => (
              <div key={entry.recordId} className="omi-note-editor-card omi-note-editor-card--compact">
                <strong>{entry.title}</strong>
                <small style={{ display: 'block' }}>{[entry.authorLabel, entry.issued, entry.resourceType].filter(Boolean).join(' · ')}</small>
                <small style={{ display: 'block' }}>{entry.citationCount} {copy.citations}</small>
              </div>
            ))}</div> : <p>{copy.emptyCategory}</p>}
          </div></div>
        ))}

        <div className="studio-tool-actions"><button type="button" className="studio-menu-secondary-action" onClick={removeList}><Trash2 size={15} />{copy.deleteList}</button></div>
        {issues.filter((issue) => issue.listId === active.id).length ? <p role="alert">{copy.validation}: {issues.filter((issue) => issue.listId === active.id).length}</p> : null}
      </> : <div className="omi-notes-empty"><p>{copy.empty}</p></div>}
    </section>
  );
}

function localizedPresetLabel(kind: string, locale: string): string {
  const language = locale.toLowerCase().split('-')[0];
  const labels: Record<string, Record<string, string>> = {
    hu: { 'archival-sources': 'Levéltári források', legislation: 'Jogszabályok', scripture: 'Bibliai helyek', 'primary-sources': 'Elsődleges források' },
    de: { 'archival-sources': 'Archivquellen', legislation: 'Rechtsquellen', scripture: 'Bibelstellen', 'primary-sources': 'Primärquellen' },
  };
  return labels[language]?.[kind] ?? REFERENCE_LIST_CATEGORY_PRESETS.find((item) => item.kind === kind)?.title ?? kind;
}

function getCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') return { title: 'Kategorizált hivatkozásjegyzékek', description: 'A bibliográfiai rekordokból és a hivatkozások szemantikus szerepéből automatikusan frissülő, kategóriákba rendezett jegyzékek.', createList: 'Új hivatkozásjegyzék', listTitlePlaceholder: 'Pl. Források és hivatkozott dokumentumok', add: 'Létrehozás', lists: 'Hivatkozásjegyzékek', categories: 'Kategóriák', categoriesDescription: 'Használjon előre definiált tudományos kategóriákat, vagy hozzon létre saját szabályt.', customCategory: 'Egyéni kategória', categoryPlaceholder: 'Kategória neve', resourceTypes: 'Forrástípusok (vesszővel)', addCategory: 'Kategória hozzáadása', includeUncited: 'Nem idézett rekordok megjelenítése is', entries: 'tétel', citations: 'hivatkozás', emptyCategory: 'Ebben a kategóriában jelenleg nincs megfelelő rekord.', delete: 'Kategória törlése', deleteList: 'Hivatkozásjegyzék törlése', empty: 'Még nincs kategorizált hivatkozásjegyzék.', validation: 'Ellenőrzési problémák' };
  if (language === 'de') return { title: 'Kategorisierte Referenzverzeichnisse', description: 'Automatisch aktualisierte, kategorisierte Verzeichnisse aus bibliografischen Datensätzen und semantischen Zitierrollen.', createList: 'Neues Referenzverzeichnis', listTitlePlaceholder: 'z. B. Quellen und zitierte Dokumente', add: 'Erstellen', lists: 'Referenzverzeichnisse', categories: 'Kategorien', categoriesDescription: 'Verwenden Sie wissenschaftliche Standardkategorien oder definieren Sie eigene Regeln.', customCategory: 'Benutzerdefinierte Kategorie', categoryPlaceholder: 'Kategoriename', resourceTypes: 'Ressourcentypen (Komma getrennt)', addCategory: 'Kategorie hinzufügen', includeUncited: 'Auch nicht zitierte Datensätze anzeigen', entries: 'Einträge', citations: 'Zitate', emptyCategory: 'Für diese Kategorie gibt es derzeit keine passenden Datensätze.', delete: 'Kategorie löschen', deleteList: 'Referenzverzeichnis löschen', empty: 'Noch kein kategorisiertes Referenzverzeichnis.', validation: 'Validierungsprobleme' };
  return { title: 'Categorized reference lists', description: 'Automatically updated grouped lists derived from bibliographic records and semantic citation roles.', createList: 'New reference list', listTitlePlaceholder: 'e.g. Sources and cited documents', add: 'Create', lists: 'Reference lists', categories: 'Categories', categoriesDescription: 'Use scholarly presets or create a custom matching rule.', customCategory: 'Custom category', categoryPlaceholder: 'Category name', resourceTypes: 'Resource types (comma separated)', addCategory: 'Add category', includeUncited: 'Include uncited records', entries: 'entries', citations: 'citations', emptyCategory: 'No matching records currently belong to this category.', delete: 'Delete category', deleteList: 'Delete reference list', empty: 'No categorized reference list yet.', validation: 'Validation issues' };
}
