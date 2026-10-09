import { useState } from 'react';

import { useTranslation } from '../i18n';
import {
  DEFAULT_STUDIO_API_ORIGIN,
  getNativeStudioServerOrigin,
  getSavedNativeStudioServerOrigin,
  isNativeStudioRuntime,
  normalizeNativeStudioServerOrigin,
  saveNativeStudioServerOrigin,
} from '../services/studioServer';
import './ServerEndpointSettings.css';

function copy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Studio-szerver',
      summary: 'Másik Studio-szerver használata',
      current: 'Jelenlegi szerver',
      address: 'Szerver címe',
      placeholder: 'https://studio.pelda.hu',
      help: 'A saját szervernek HTTPS-en elérhető Studio API-t kell biztosítania. A váltás kijelentkeztet erről a szerverről; a rajta tárolt adatok nem változnak.',
      apply: 'Szerver használata',
      reset: 'Alapértelmezett szerver visszaállítása',
      invalid: 'Adja meg a szerver teljes HTTPS-címét.',
    };
  }
  if (locale === 'de') {
    return {
      title: 'Studio-Server',
      summary: 'Anderen Studio-Server verwenden',
      current: 'Aktueller Server',
      address: 'Serveradresse',
      placeholder: 'https://studio.beispiel.org',
      help: 'Der eigene Server muss eine über HTTPS erreichbare Studio-API bereitstellen. Beim Wechsel werden Sie auf diesem Server abgemeldet; dort gespeicherte Daten bleiben unverändert.',
      apply: 'Server verwenden',
      reset: 'Standardserver wiederherstellen',
      invalid: 'Geben Sie die vollständige HTTPS-Adresse des Servers ein.',
    };
  }
  return {
    title: 'Studio server',
    summary: 'Use a different Studio server',
    current: 'Current server',
    address: 'Server address',
    placeholder: 'https://studio.example.org',
    help: 'Your server must provide a Studio API over HTTPS. Switching signs you out of this server; data stored there is unchanged.',
    apply: 'Use server',
    reset: 'Return to the default server',
    invalid: 'Enter the server’s full HTTPS address.',
  };
}

export function ServerEndpointSettings() {
  const { locale } = useTranslation();
  const text = copy(locale);
  const native = isNativeStudioRuntime();
  const savedOrigin = getSavedNativeStudioServerOrigin();
  const [open, setOpen] = useState(Boolean(savedOrigin));
  const [serverOrigin, setServerOrigin] = useState(savedOrigin ?? '');
  const [error, setError] = useState('');

  if (!native) return null;

  const currentOrigin = getNativeStudioServerOrigin();

  const apply = () => {
    setError('');
    try {
      const normalized = normalizeNativeStudioServerOrigin(serverOrigin);
      const changed = saveNativeStudioServerOrigin(normalized);
      if (changed) {
        window.location.reload();
        return;
      }
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.invalid);
    }
  };

  const reset = () => {
    setError('');
    const changed = saveNativeStudioServerOrigin(null);
    setServerOrigin('');
    setOpen(false);
    if (changed) window.location.reload();
  };

  return (
    <section className="native-server-settings" aria-label={text.title}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>{text.summary}</summary>
        <div className="native-server-settings__body">
          <p className="native-server-settings__current">
            <strong>{text.current}:</strong> <span dir="ltr">{currentOrigin}</span>
          </p>
          <label htmlFor="native-studio-server-origin">{text.address}</label>
          <input
            id="native-studio-server-origin"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            dir="ltr"
            placeholder={text.placeholder}
            value={serverOrigin}
            onChange={(event) => {
              setServerOrigin(event.target.value);
              setError('');
            }}
          />
          <p className="native-server-settings__help">{text.help}</p>
          {error ? <p className="native-server-settings__error" role="alert">{error}</p> : null}
          <div className="native-server-settings__actions">
            <button type="button" className="native-server-settings__primary" onClick={apply}>
              {text.apply}
            </button>
            {currentOrigin !== DEFAULT_STUDIO_API_ORIGIN || savedOrigin ? (
              <button type="button" className="native-server-settings__secondary" onClick={reset}>
                {text.reset}
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </section>
  );
}
