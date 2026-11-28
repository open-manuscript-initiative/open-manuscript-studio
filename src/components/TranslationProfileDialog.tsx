import { useEffect, useRef, useState } from 'react';
import type { TranslationLanguagePair } from '../model/user';
import { translationTaskCopy } from '../model/translationAssignmentProfile';
import { useAuthStore } from '../store/authStore';
import { TranslationLanguagePairsField } from './TranslationLanguagePairsField';

export function TranslationProfileDialog({ pairs: savedPairs, locale, onClose, onSaved }: {
  pairs: TranslationLanguagePair[]; locale: string; onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), copy = translationTaskCopy(locale);
  const [pairs, setPairs] = useState(savedPairs), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const update = useAuthStore(state => state.updateCurrentUser);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="translation-profile-dialog" onCancel={onClose} aria-labelledby="translation-profile-title">
    <form onSubmit={event => { event.preventDefault(); setBusy(true); setError(''); void update({ translationLanguagePairs: pairs })
      .then(onSaved).catch(caught => setError(caught instanceof Error ? caught.message : copy.invalid)).finally(() => setBusy(false)); }}>
      <h2 id="translation-profile-title">{copy.setup}</h2><p>{copy.setupHint}</p>
      <TranslationLanguagePairsField pairs={pairs} onChange={setPairs} locale={locale} disabled={busy} />
      {error ? <p role="alert">{error}</p> : null}
      <div className="translation-pair-inputs"><button type="button" disabled={busy} onClick={onClose}>{copy.cancel}</button><button disabled={busy || !pairs.length}>{copy.save}</button></div>
    </form>
  </dialog>;
}
