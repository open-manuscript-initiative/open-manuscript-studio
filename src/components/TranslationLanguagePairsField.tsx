import { useId, useState } from 'react';
import type { TranslationLanguagePair } from '../model/user';
import { normalizeTranslationLanguagePairs, translationTaskCopy } from '../model/translationAssignmentProfile';
import './TranslationWorkflow.css';

export function TranslationLanguagePairsField({ pairs, onChange, locale, disabled = false }: {
  pairs: TranslationLanguagePair[]; onChange: (pairs: TranslationLanguagePair[]) => void; locale: string; disabled?: boolean;
}) {
  const copy = translationTaskCopy(locale), id = useId();
  const [source, setSource] = useState(''), [target, setTarget] = useState(''), [error, setError] = useState('');
  const names = new Intl.DisplayNames([locale], { type: 'language' });
  return <fieldset className="translation-pairs-field" disabled={disabled}>
    <legend>{copy.profile}</legend><p>{copy.hint}</p>
    {pairs.map((pair, index) => <div className="translation-pair-row" key={`${pair.sourceLanguage}-${pair.targetLanguage}`}>
      <span>{names.of(pair.sourceLanguage)} → {names.of(pair.targetLanguage)}</span>
      <button type="button" onClick={() => onChange(pairs.filter((_, i) => i !== index))}>{copy.remove}</button>
    </div>)}
    <div className="translation-pair-inputs">
      <label>{copy.source}<input value={source} onChange={event => setSource(event.target.value)} list={id} placeholder="hu" maxLength={32} /></label>
      <label>{copy.target}<input value={target} onChange={event => setTarget(event.target.value)} list={id} placeholder="en" maxLength={32} /></label>
      <datalist id={id}>{['hu', 'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'ro', 'sk', 'la', 'el', 'uk', 'cs'].map(code => <option key={code} value={code}>{names.of(code)}</option>)}</datalist>
      <button type="button" disabled={pairs.length >= 32} onClick={() => {
        try { onChange(normalizeTranslationLanguagePairs([...pairs, { sourceLanguage: source, targetLanguage: target }])); setError(''); setSource(''); setTarget(''); }
        catch { setError(copy.invalid); }
      }}>{copy.add}</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
  </fieldset>;
}
