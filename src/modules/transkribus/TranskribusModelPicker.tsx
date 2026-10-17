import { useEffect, useState } from 'react';
import { getTranskribusModels, type TranskribusModel } from './api';
import { getTranskribusCopy, transkribusErrorMessage } from './copy';
import { filterTranskribusModels, transkribusLanguageName } from './modelCatalog';

export interface TranskribusModelSelection { id: string; name: string }

export function TranskribusModelPicker({ locale, workspaceId, value, onChange, disabled }: {
  locale: string; workspaceId: string; value: TranskribusModelSelection;
  onChange: (model: TranskribusModelSelection) => void; disabled: boolean;
}) {
  const copy = getTranskribusCopy(locale);
  const [models, setModels] = useState<TranskribusModel[]>([]);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [material, setMaterial] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setModels([]);
    void getTranskribusModels(workspaceId, controller.signal).then(result => {
      if (!controller.signal.aborted) setModels(result);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(transkribusErrorMessage(reason, copy));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, retry, copy]);

  const languages = [...new Set(models.flatMap(model => model.languages))]
    .map(code => ({ code, name: transkribusLanguageName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const matches = filterTranskribusModels(models, { query, language, material }, locale);
  const selected = models.find(model => String(model.modelId) === value.id);
  const selectedOutsideFilter = value.id && !matches.some(model => String(model.modelId) === value.id);

  return <section className="transkribus-model-picker" aria-label={copy.model}>
    <p>{copy.modelsHint}</p>
    <div className="transkribus-fields">
      <label>{copy.modelSearch}<input type="search" value={query} maxLength={200} disabled={disabled} onChange={event => setQuery(event.target.value)} /></label>
      <label>{copy.modelLanguage}<select value={language} disabled={disabled || loading} onChange={event => setLanguage(event.target.value)}>
        <option value="">{copy.allLanguages}</option>{languages.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
      </select></label>
      <label>{copy.modelMaterial}<select value={material} disabled={disabled} onChange={event => setMaterial(event.target.value)}>
        <option value="">{copy.allMaterials}</option><option value="handwritten">{copy.handwritten}</option><option value="print">{copy.printed}</option>
      </select></label>
    </div>
    {loading && <p role="status">{copy.modelsLoading}</p>}
    {error && <div className="transkribus-actions"><p role="alert">{error}</p><button type="button" disabled={disabled || loading} onClick={() => setRetry(current => current + 1)}>{copy.modelsRetry}</button></div>}
    <label>{copy.model}<select value={value.id} disabled={disabled || !models.length} onChange={event => {
      const model = models.find(item => String(item.modelId) === event.target.value);
      onChange({ id: model ? String(model.modelId) : '', name: model?.name ?? '' });
    }} required>
      <option value="">{copy.chooseModel}</option>
      {selectedOutsideFilter && <option value={value.id} hidden>{value.name || `${copy.manualModel} (${value.id})`}</option>}
      {matches.map(model => <option key={model.modelId} value={model.modelId}>{model.name}</option>)}
    </select></label>
    {!loading && !error && <p role="status">{matches.length ? `${copy.modelMatches}: ${matches.length}` : copy.modelsEmpty}</p>}
    {value.id && <p className="transkribus-selected-model"><strong>{copy.selectedModel}: {value.name || value.id}</strong>
      {selected && <span>{[selected.languages.map(code => transkribusLanguageName(code, locale)).join(', '),
        selected.material === 'handwritten' ? copy.handwritten : selected.material === 'print' ? copy.printed : '',
        selected.centuries.length ? `${copy.modelCenturies}: ${selected.centuries.join(', ')}` : '', selected.creator].filter(Boolean).join(' · ')}</span>}
    </p>}
    <div className="transkribus-actions"><a href={`https://www.transkribus.org/models${value.name ? `?${new URLSearchParams({ q: value.name })}` : ''}`} target="_blank" rel="noopener noreferrer">{copy.modelDetails}</a></div>
    <details className="transkribus-manual-model"><summary>{copy.manualModel}</summary>
      <p>{copy.manualModelHint}</p>
      <label>{copy.modelId}<input type="number" min={1} max={2_147_483_647} step={1} value={value.id} disabled={disabled} onChange={event => onChange({ id: event.target.value, name: '' })} /></label>
    </details>
  </section>;
}
