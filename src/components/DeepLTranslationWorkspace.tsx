import { useEffect, useMemo, useRef, useState } from 'react';
import { addManuscriptTranslation } from '../app/translationActions';
import { useStudioStore } from '../app/useStudioStore';
import { translateCatalog, useTranslation } from '../i18n';
import { getMachineTranslationCopy } from '../i18n/machineTranslationTranslations';
import type { TranslationScope } from '../model/translation';
import { deleteTranslationVariant, getTranslationVariants, type TranslationVariant } from '../services/integrationExecutionApi';
import { machineTranslationSourceChanged, requestMachineTranslationSuggestions, selectedMachineTranslationSegments, type MachineTranslationProposal } from '../services/machineTranslationSuggestions';

export function DeepLTranslationWorkspace({ scope, targetLanguage, disabled = false, onAccepted }: {
  scope: TranslationScope | null;
  targetLanguage: string;
  disabled?: boolean;
  onAccepted: (variantId: string) => void;
}) {
  const { locale, t } = useTranslation();
  const copy = getMachineTranslationCopy(locale);
  const shared = (key: string) => translateCatalog(locale, `/translationModel/${key}`);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [proposal, setProposal] = useState<MachineTranslationProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const request = useRef<AbortController | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacy, setLegacy] = useState<TranslationVariant[]>([]);
  const [legacyError, setLegacyError] = useState('');
  const basis = proposal?.basis;
  const requestedScope = proposal?.scope;
  const sourceUnits = proposal?.sourceUnits;
  const sourceChanged = useMemo(() => basis && requestedScope && sourceUnits
    ? machineTranslationSourceChanged(manuscript, { basis, scope: requestedScope, sourceUnits }) : false, [manuscript, basis, requestedScope, sourceUnits]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!legacyOpen) return;
    let active = true;
    getTranslationVariants(manuscript.id).then((items) => { if (active) setLegacy(items); })
      .catch(() => { if (active) setLegacyError(shared('actionFailed')); });
    return () => { active = false; };
    // Only opening legacy records should contact their separate storage API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyOpen, manuscript.id]);

  async function generate() {
    if (!scope || disabled || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(''); setProposal(null); setPage(0);
    try {
      useStudioStore.getState().checkpoint('manual');
      const result = await requestMachineTranslationSuggestions(useStudioStore.getState().manuscript, scope, targetLanguage, controller.signal);
      if (!controller.signal.aborted && useStudioStore.getState().manuscript.id === result.basis.id) setProposal(result);
    } catch {
      if (!controller.signal.aborted) setError(copy.failed);
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  function accept() {
    if (!proposal || disabled) return;
    setError('');
    try {
      const id = addManuscriptTranslation(proposal.scope, proposal.targetLanguage, selectedMachineTranslationSegments(proposal), proposal.basis,
        { method: 'machine', provider: 'DeepL', createdAt: proposal.createdAt });
      setProposal(null); onAccepted(id);
    } catch { setError(copy.acceptFailed); }
  }
  async function removeLegacy(id: string) {
    try { await deleteTranslationVariant(id); setLegacy((items) => items.filter((item) => item.id !== id)); }
    catch { setLegacyError(shared('actionFailed')); }
  }
  const pages = Math.max(1, Math.ceil((proposal?.suggestions.length ?? 0) / 20));
  const currentPage = Math.min(page, pages - 1);
  return <section className="omi-machine-translation-workspace">
    <h4>{translateCatalog(locale, '/uncataloguedUi/components-integrationexecutionworkspace/deepl-translation-workspace-ad788d9')}</h4>
    <p>{copy.description}</p>
    <div className="omi-translation-controls">
      <button type="button" className="studio-menu-primary-action" disabled={busy || disabled || !scope || !targetLanguage.trim()} onClick={() => void generate()}>
        {busy ? translateCatalog(locale, '/uncataloguedUi/components-integrationexecutionworkspace/translating-ae47b9e') : copy.request}
      </button>
      {busy ? <button type="button" className="studio-menu-secondary-action" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>{t('common.cancel')}</button> : null}
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {proposal ? <>
      <p className="omi-machine-translation-basis">{proposal.basis.locale} → {proposal.targetLanguage} · {shared(proposal.scope.kind)}</p>
      {sourceChanged ? <p role="status">{copy.changed}</p> : null}
      {proposal.suggestions.slice(currentPage * 20, (currentPage + 1) * 20).map((item, index) => <article className="omi-machine-translation-suggestion" key={item.id}>
        <label className="omi-machine-translation-choice"><input type="checkbox" aria-label={`${copy.include} ${currentPage * 20 + index + 1}`} checked={item.included}
          onChange={(event) => setProposal((current) => current ? { ...current, suggestions: current.suggestions.map((row) => row.id === item.id ? { ...row, included: event.target.checked } : row) } : null)} />{copy.include}</label>
        <div className="omi-translation-columns">
          <div><strong>{shared('sourceText')}</strong><p lang={proposal.basis.locale} dir="auto">{item.sourceText}</p></div>
          <label>{copy.suggestion}<textarea aria-label={`${copy.suggestion} ${currentPage * 20 + index + 1}`} lang={proposal.targetLanguage} dir="auto" value={item.text}
            onChange={(event) => setProposal((current) => current ? { ...current, suggestions: current.suggestions.map((row) => row.id === item.id ? { ...row, text: event.target.value } : row) } : null)} /></label>
        </div>
      </article>)}
      {pages > 1 ? <div className="omi-translation-controls">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{shared('previous')}</button>
        <span>{currentPage + 1}/{pages}</span>
        <button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{shared('next')}</button>
      </div> : null}
      <div className="omi-translation-controls">
        <button type="button" className="studio-menu-primary-action" disabled={disabled || proposal.basis.id !== manuscript.id || !proposal.suggestions.some((item) => item.included && item.text.trim())} onClick={accept}>{copy.accept}</button>
        <button type="button" className="studio-menu-secondary-action" onClick={() => { setProposal(null); setError(''); }}>{copy.discard}</button>
      </div>
    </> : null}
    <details onToggle={(event) => setLegacyOpen(event.currentTarget.open)}>
      <summary>{shared('legacyVariants')}</summary>
      {legacyError ? <p role="alert">{legacyError}</p> : null}
      {!legacy.length ? <p>{shared('empty')}</p> : legacy.map((variant) => <div className="omi-translation-controls" key={variant.id}>
        <span>{variant.targetLocale} · {shared(variant.scope.kind)} · {new Date(variant.updatedAt).toLocaleString(locale)}</span>
        <button type="button" className="studio-menu-secondary-action" onClick={() => { if (window.confirm(shared('removeConfirm'))) void removeLegacy(variant.id); }}>{shared('remove')}</button>
      </div>)}
    </details>
  </section>;
}
