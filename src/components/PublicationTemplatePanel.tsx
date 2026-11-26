import { useRef, useState } from 'react';
import { stagePublicationTemplate } from '../app/publicationTemplateActions';
import { useStudioStore } from '../app/useStudioStore';
import { publicationTemplatesCopy } from '../i18n/publicationTemplates';
import { getPublicationMatter } from '../model/publicationMatter';
import { suggestOjsIssueTemplate } from '../model/ojsIssuePublication';
import { capturePublicationTemplate, deletePublicationTemplate, importPublicationTemplate, isBuiltinPublicationTemplate, savePublicationTemplate } from '../services/publicationTemplates';
import { saveExportText } from '../services/exportFileDelivery';
import type { PublicationStyle } from '../services/publicationStyleExport';
import { PublicationTemplateSelector, publicationTemplateName, usePublicationTemplates } from './PublicationTemplateSelector';
import './PublicationTemplatePanel.css';

export function PublicationTemplatePanel({ locale, style, onApplied }: { locale: string; style: PublicationStyle; onApplied: (style: PublicationStyle) => void }) {
  const manuscript = useStudioStore((state) => state.manuscript);
  const kind = getPublicationMatter(manuscript)?.publicationKind ?? 'volume';
  const copy = publicationTemplatesCopy(locale);
  const { templates, loadError, refresh } = usePublicationTemplates();
  const [selection, setSelection] = useState<{ manuscriptId: string; id: string } | null>(null);
  const suggested = suggestOjsIssueTemplate(manuscript, templates);
  const selectedId = selection?.manuscriptId === manuscript.id ? selection.id : suggested?.id ?? '';
  const setSelectedId = (id: string) => setSelection({ manuscriptId: manuscript.id, id });
  const selected = templates.find((template) => template.id === selectedId && template.kind === kind);
  const [name, setName] = useState('');
  const [association, setAssociation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError(false);
    try { await action(); setMessage(success); }
    catch { setError(true); setMessage(copy.error); }
    finally { setBusy(false); }
  }
  async function save(id?: string) {
    const template = await capturePublicationTemplate(useStudioStore.getState().manuscript, style, name, association, id);
    await savePublicationTemplate(template);
    // Success includes the selector refresh, not just the IndexedDB write.
    await refresh();
    setSelectedId(template.id);
  }
  return <details className="publication-template-panel">
    <summary>{copy.title}</summary>
    <p>{copy.help}</p>
    <fieldset disabled={busy}>
      <PublicationTemplateSelector templates={templates} locale={locale} kind={kind} value={selected?.id ?? ''} onChange={(template) => {
        setSelectedId(template?.id ?? ''); setMessage('');
        setName(template ? publicationTemplateName(template, locale) : ''); setAssociation(template?.association ?? '');
      }} />
      <div className="publication-template-actions">
        <button type="button" disabled={!selected} onClick={() => void run(async () => {
          if (selected) onApplied(await stagePublicationTemplate(selected));
        }, copy.applied)}>{copy.apply}</button>
        <button type="button" disabled={!selected} onClick={() => void run(async () => {
          if (selected) await saveExportText(JSON.stringify(selected, null, 2), `${selected.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'publication'}.omi-template.json`, 'application/json');
        }, '')}>{copy.export}</button>
        <button type="button" onClick={() => fileRef.current?.click()}>{copy.import}</button>
        <input ref={fileRef} hidden type="file" accept=".json,application/json" aria-label={copy.import} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (file) void run(async () => {
            const template = await importPublicationTemplate(file);
            await refresh();
            if (template.kind === kind) { setSelectedId(template.id); setName(template.name); setAssociation(template.association); }
          }, copy.imported);
        }} />
      </div>
      <div className="publication-template-fields">
        <label>{copy.name}<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} /></label>
        <label>{copy.association}<input value={association} maxLength={256} onChange={(event) => setAssociation(event.target.value)} /></label>
      </div>
      <div className="publication-template-actions">
        <button type="button" disabled={!name.trim()} onClick={() => void run(() => save(), copy.saved)}>{copy.save}</button>
        <button type="button" disabled={!name.trim() || !selected || isBuiltinPublicationTemplate(selected.id)} onClick={() => void run(() => save(selected!.id), copy.saved)}>{copy.update}</button>
        <button type="button" disabled={!selected || isBuiltinPublicationTemplate(selected.id)} onClick={() => void run(async () => {
          await deletePublicationTemplate(selected!.id); await refresh(); setSelectedId('');
        }, copy.deleted)}>{copy.remove}</button>
      </div>
    </fieldset>
    <p>{copy.placeholders}</p><p>{copy.storage}</p>
    {loadError ? <p role="alert">{copy.loadError}</p> : null}
    {busy ? <p role="status">{copy.busy}</p> : null}
    {message ? <p role={error ? 'alert' : 'status'}>{message}</p> : null}
  </details>;
}
