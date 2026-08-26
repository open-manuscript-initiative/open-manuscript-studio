import { Bookmark, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  collectNamedAnchorTargets,
  createNamedAnchor,
  renameNamedAnchor,
  resolveNamedAnchorTarget,
  validateNamedAnchors,
  type OmiNamedAnchorTargetKind,
} from '../model/namedAnchors';

export function NamedAnchorsPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const anchors = manuscript.namedAnchors ?? [];
  const targets = useMemo(() => collectNamedAnchorTargets(manuscript.sections), [manuscript.sections]);
  const issues = useMemo(() => validateNamedAnchors(manuscript), [manuscript]);
  const [name, setName] = useState('');
  const [targetKey, setTargetKey] = useState(() => {
    const first = targets[0];
    return first ? `${first.kind}:${first.id}` : '';
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [message, setMessage] = useState('');

  function setAnchors(next: typeof anchors): void {
    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        namedAnchors: next,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function addAnchor(): void {
    const separator = targetKey.indexOf(':');
    const targetKind = targetKey.slice(0, separator) as OmiNamedAnchorTargetKind;
    const targetId = targetKey.slice(separator + 1);
    const normalized = name.trim();
    if (!normalized || !targetId) return;
    if (anchors.some((anchor) => anchor.name.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      setMessage(copy.duplicate);
      return;
    }
    try {
      setAnchors([...anchors, createNamedAnchor({ name: normalized, targetId, targetKind })]);
      setName('');
      setMessage(copy.created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function saveRename(anchorId: string): void {
    const normalized = editingName.trim();
    if (!normalized) return;
    if (anchors.some((anchor) => anchor.id !== anchorId && anchor.name.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      setMessage(copy.duplicate);
      return;
    }
    setAnchors(anchors.map((anchor) => anchor.id === anchorId ? renameNamedAnchor(anchor, normalized) : anchor));
    setEditingId(null);
    setEditingName('');
    setMessage(copy.renamed);
  }

  function remove(anchorId: string): void {
    setAnchors(anchors.filter((anchor) => anchor.id !== anchorId));
    setMessage(copy.deleted);
  }

  function navigate(anchorId: string): void {
    const anchor = anchors.find((candidate) => candidate.id === anchorId);
    if (!anchor) return;
    const target = resolveNamedAnchorTarget(manuscript, anchor);
    if (!target) return;
    selectSection(target.sectionId);
    onNavigate?.();
    document.querySelector<HTMLButtonElement>('.studio-menu-close')?.click();
    window.setTimeout(() => {
      const elementId = target.kind === 'section' ? `omi-section-${target.id}` : `omi-target-${target.id}`;
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div><h3><Bookmark size={18} aria-hidden="true" /> {copy.title}</h3><p>{copy.description}</p></div>
        <span className="omi-notes-count">{anchors.length}</span>
      </div>

      <div className="studio-tool-card">
        <div style={{ width: '100%' }}>
          <strong>{copy.create}</strong>
          <p>{copy.createDescription}</p>
          <div className="studio-manuscript-fields">
            <label><span>{copy.name}</span><input value={name} onChange={(event) => { setName(event.target.value); setMessage(''); }} placeholder={copy.namePlaceholder} /></label>
            <label><span>{copy.target}</span><select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>{targets.map((target) => <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>{target.kind === 'section' ? `${copy.section}: ${target.label}` : `${copy.block}: ${target.label}`}</option>)}</select></label>
          </div>
          <div className="studio-tool-actions"><button type="button" className="studio-menu-primary-action" disabled={!name.trim() || !targetKey} onClick={addAnchor}><Plus size={16} aria-hidden="true" />{copy.add}</button></div>
          {message ? <p role="status">{message}</p> : null}
        </div>
      </div>

      <div className="studio-tool-card">
        <div style={{ width: '100%' }}>
          <strong>{copy.existing}</strong>
          {anchors.length === 0 ? <p>{copy.empty}</p> : anchors.map((anchor) => {
            const target = resolveNamedAnchorTarget(manuscript, anchor);
            const hasIssue = issues.some((issue) => issue.anchorId === anchor.id);
            return <div key={anchor.id} className="studio-tool-card" style={{ marginTop: '0.75rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingId === anchor.id ? <input value={editingName} autoFocus onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveRename(anchor.id); if (event.key === 'Escape') setEditingId(null); }} /> : <><strong>{anchor.name}</strong><p>{target ? target.label : copy.missingTarget}</p><small>{copy.exportName}: {anchor.exportName}</small>{hasIssue ? <p role="alert">{copy.invalid}</p> : null}</>}
              </div>
              <div className="studio-tool-actions">
                {editingId === anchor.id ? <button type="button" onClick={() => saveRename(anchor.id)}>{copy.save}</button> : <button type="button" disabled={!target} onClick={() => navigate(anchor.id)}><ExternalLink size={15} aria-hidden="true" />{copy.go}</button>}
                <button type="button" onClick={() => { setEditingId(anchor.id); setEditingName(anchor.name); }}><Pencil size={15} aria-hidden="true" />{copy.rename}</button>
                <button type="button" onClick={() => remove(anchor.id)}><Trash2 size={15} aria-hidden="true" />{copy.delete}</button>
              </div>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return { title: 'Könyvjelzők', description: 'Névvel ellátott, stabil célpontok a kéziratban. A későbbi kereszthivatkozások és exportok ezekre az azonosítókra hivatkozhatnak.', create: 'Új könyvjelző', createDescription: 'Válasszon egy szakaszt vagy blokkot, és adjon neki ember számára olvasható nevet.', name: 'Név', namePlaceholder: 'pl. Bethlen-fejezet', target: 'Cél', section: 'Szakasz', block: 'Blokk', add: 'Könyvjelző létrehozása', existing: 'Létrehozott könyvjelzők', empty: 'Még nincs könyvjelző a dokumentumban.', exportName: 'Exportnév', missingTarget: 'A célpont már nem található.', invalid: 'A könyvjelző ellenőrzést igényel.', duplicate: 'Ez a könyvjelzőnév már létezik.', created: 'Könyvjelző létrehozva.', renamed: 'Könyvjelző átnevezve.', deleted: 'Könyvjelző törölve.', go: 'Ugrás', rename: 'Átnevezés', delete: 'Törlés', save: 'Mentés' };
  if (locale === 'de') return { title: 'Textmarken', description: 'Benannte stabile Ziele im Manuskript. Spätere Querverweise und Exporte können diese Identitäten verwenden.', create: 'Neue Textmarke', createDescription: 'Wählen Sie einen Abschnitt oder Block und geben Sie ihm einen lesbaren Namen.', name: 'Name', namePlaceholder: 'z. B. bethlen-kapitel', target: 'Ziel', section: 'Abschnitt', block: 'Block', add: 'Textmarke erstellen', existing: 'Vorhandene Textmarken', empty: 'Dieses Dokument enthält noch keine Textmarken.', exportName: 'Exportname', missingTarget: 'Das Ziel ist nicht mehr vorhanden.', invalid: 'Diese Textmarke muss geprüft werden.', duplicate: 'Dieser Textmarkenname existiert bereits.', created: 'Textmarke erstellt.', renamed: 'Textmarke umbenannt.', deleted: 'Textmarke gelöscht.', go: 'Gehe zu', rename: 'Umbenennen', delete: 'Löschen', save: 'Speichern' };
  return { title: 'Bookmarks', description: 'Named stable destinations in the manuscript. Later cross-references and exports can address these identities.', create: 'New bookmark', createDescription: 'Choose a section or block and assign a human-readable name.', name: 'Name', namePlaceholder: 'e.g. bethlen-chapter', target: 'Target', section: 'Section', block: 'Block', add: 'Create bookmark', existing: 'Bookmarks', empty: 'This document does not contain bookmarks yet.', exportName: 'Export name', missingTarget: 'The target no longer exists.', invalid: 'This bookmark needs attention.', duplicate: 'A bookmark with this name already exists.', created: 'Bookmark created.', renamed: 'Bookmark renamed.', deleted: 'Bookmark deleted.', go: 'Go to', rename: 'Rename', delete: 'Delete', save: 'Save' };
}
