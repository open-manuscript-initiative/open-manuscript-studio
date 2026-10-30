import { useMemo, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { addManuscriptTranslation, archiveTranslationAlignment, removeManuscriptTranslation, saveTranslationAlignment, synchronizeManuscriptTranslation } from '../app/translationActions';
import { translateCatalog, useTranslation } from '../i18n';
import { getManuscriptLanguageOptions } from '../model/manuscriptLanguage';
import { currentUnits, getTranslationModel, translationFreshness, translationProgress, type ManuscriptTranslation, type TranslationAlignment, type TranslationEquivalence } from '../model/translation';
import { saveExportText } from '../services/exportFileDelivery';
import { renderTranslationHtml } from '../services/translationExport';
import './TranslationPanel.css';

export function TranslationPanel() {
  const { locale } = useTranslation();
  const copy = (key: string) => translateCatalog(locale, `/translationModel/${key}`);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const [target, setTarget] = useState(manuscript.locale === 'en' ? 'de' : 'en');
  const [scopeKind, setScopeKind] = useState<'manuscript' | 'section'>('manuscript');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const result = useMemo(() => {
    try { return { model: getTranslationModel(manuscript), error: '' }; }
    catch { return { model: null, error: copy('invalid') }; }
    // Locale changes translate validation messages as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscript, locale]);
  const variant = result.model?.variants.find((item) => item.id === selectedId) ?? result.model?.variants[0];
  const progress = variant ? translationProgress(manuscript, variant) : null;
  const units = useMemo(() => variant ? currentUnits(manuscript, variant) : new Map(), [manuscript, variant]);
  const languageOptions = getManuscriptLanguageOptions(locale).filter((item) => item.source === 'iso-639-1' && item.tag !== manuscript.locale);

  function run(action: () => void): void {
    setError(''); setNotice('');
    try { action(); setNotice(copy('saved')); }
    catch { setError(copy('actionFailed')); }
  }
  async function exportHtml(mode: 'parallel' | 'target'): Promise<void> {
    if (!variant) return;
    setError('');
    try {
      const html = renderTranslationHtml(manuscript, variant.id, mode);
      await saveExportText(html, `translation-${variant.targetLanguage}-${mode}.html`, 'text/html;charset=utf-8');
    } catch { setError(copy('exportFailed')); }
  }
  const totalPages = Math.max(1, Math.ceil((variant?.alignments.length ?? 0) / 20));
  const currentPage = Math.min(page, totalPages - 1);
  return <section className="panel omi-translation-panel">
    <h3>{copy('title')}</h3><p>{copy('description')}</p>
    <div className="omi-translation-controls">
      <label>{copy('targetLanguage')}<input list="translation-languages" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      <datalist id="translation-languages">{languageOptions.map((item) => <option key={item.tag} value={item.tag}>{item.label}</option>)}</datalist>
      <label>{copy('scope')}<select value={scopeKind} onChange={(event) => setScopeKind(event.target.value as typeof scopeKind)}><option value="manuscript">{copy('manuscript')}</option><option value="section">{copy('section')}</option></select></label>
      <button type="button" className="studio-menu-primary-action" disabled={!result.model || (scopeKind === 'section' && !selectedSectionId)} onClick={() => run(() => {
        const id = addManuscriptTranslation({ kind: scopeKind, id: scopeKind === 'manuscript' ? manuscript.id : selectedSectionId! }, target);
        setSelectedId(id); setPage(0);
      })}>{copy('create')}</button>
    </div>
    {result.error || error ? <p role="alert">{result.error || error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {!variant ? <p>{copy('empty')}</p> : <>
      <label>{copy('variant')}<select value={variant.id} onChange={(event) => { setSelectedId(event.target.value); setPage(0); }}>
        {result.model?.variants.map((item) => <option key={item.id} value={item.id}>{item.sourceLanguage} → {item.targetLanguage} · {copy(item.scope.kind)} · {new Date(item.createdAt).toLocaleString(locale)}</option>)}
      </select></label>
      <p>{copy('reviewed')}: {progress?.reviewed}/{progress?.total} · {copy('stale')}: {progress?.stale} · {copy('added')}: {progress?.added}</p>
      <div className="omi-translation-controls">
        <button type="button" className="studio-menu-secondary-action" onClick={() => run(() => synchronizeManuscriptTranslation(variant.id))}>{copy('synchronize')}</button>
        <button type="button" className="studio-menu-secondary-action" disabled={!progress?.ready} onClick={() => void exportHtml('parallel')}>{copy('parallelExport')}</button>
        <button type="button" className="studio-menu-secondary-action" disabled={!progress?.ready} onClick={() => void exportHtml('target')}>{copy('targetExport')}</button>
        <button type="button" className="studio-menu-secondary-action" onClick={() => { if (window.confirm(copy('removeConfirm'))) run(() => removeManuscriptTranslation(variant.id)); }}>{copy('remove')}</button>
      </div>
      <p>{copy('syncHint')}</p>
      <p>{copy('archived')}: {variant.archivedAlignments.length}</p>
      {variant.alignments.slice(currentPage * 20, (currentPage + 1) * 20).map((alignment) => <AlignmentEditor key={`${variant.id}:${alignment.id}:${alignment.modifiedAt}`} variant={variant} alignment={alignment} freshness={translationFreshness(manuscript, variant, alignment, units)} onSave={(input) => run(() => saveTranslationAlignment(variant.id, alignment.id, input))} onArchive={() => run(() => archiveTranslationAlignment(variant.id, alignment.id))} copy={copy} />)}
      {totalPages > 1 ? <div className="omi-translation-controls">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{copy('previous')}</button>
        <span>{currentPage + 1}/{totalPages}</span>
        <button type="button" disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>{copy('next')}</button>
      </div> : null}
    </>}
  </section>;
}

function AlignmentEditor({ variant, alignment, freshness, onSave, onArchive, copy }: {
  variant: ManuscriptTranslation; alignment: TranslationAlignment; freshness: string;
  onSave: (input: Partial<Pick<TranslationAlignment, 'targetText' | 'notes' | 'equivalence' | 'status'>>) => void;
  onArchive: () => void;
  copy: (key: string) => string;
}) {
  const [text, setText] = useState(alignment.targetText);
  const [notes, setNotes] = useState(alignment.notes);
  const [equivalence, setEquivalence] = useState(alignment.equivalence);
  const dirty = text !== alignment.targetText || notes !== alignment.notes || equivalence !== alignment.equivalence;
  const canReview = !dirty && !!text.trim() && equivalence !== 'unassessed' && freshness === 'current';
  return <article className="omi-translation-alignment">
    <p><strong>{copy(alignment.status)}</strong> · <span>{copy(freshness)}</span> · <span>{copy(alignment.origin.method)}</span>{alignment.origin.provider ? ` · ${alignment.origin.provider}` : ''}</p>
    <div className="omi-translation-columns">
      <div><strong>{copy('sourceText')}</strong><p lang={variant.sourceLanguage} dir="auto">{alignment.sourceText}</p></div>
      <label>{copy('targetText')}<textarea aria-label={copy('targetText')} lang={variant.targetLanguage} dir="auto" value={text} onChange={(event) => setText(event.target.value)} /></label>
    </div>
    <label>{copy('notes')}<textarea aria-label={copy('notes')} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    <label>{copy('equivalence')}<select aria-label={copy('equivalence')} value={equivalence} onChange={(event) => setEquivalence(event.target.value as TranslationEquivalence)}>
      {(['unassessed', 'equivalent', 'adapted'] as const).map((value) => <option key={value} value={value}>{copy(value)}</option>)}
    </select></label>
    <div className="omi-translation-controls">
      <button type="button" className="studio-menu-secondary-action" disabled={!dirty} onClick={() => onSave({ targetText: text, notes, equivalence })}>{copy('save')}</button>
      <button type="button" className="studio-menu-secondary-action" disabled={!canReview || alignment.status === 'reviewed'} onClick={() => onSave({ status: 'reviewed' })}>{copy('markReviewed')}</button>
      {freshness === 'missing' ? <button type="button" className="studio-menu-secondary-action" onClick={onArchive}>{copy('archive')}</button> : null}
    </div>
  </article>;
}
