import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';
import {
  DEFAULT_STUDIO_API_ORIGIN,
  getNativeStudioServerOrigin,
  getSavedNativeStudioServerOrigin,
  isNativeStudioRuntime,
  normalizeNativeStudioServerOrigin,
  saveNativeStudioServerOrigin,
} from '../services/studioServer';
import {
  fetchStudioServerDirectory,
  type StudioServerDirectoryEntry,
} from '../services/studioServerDirectory';
import './ServerEndpointSettings.css';

function copy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Studio-szerver', summary: 'Studio-szerver kiválasztása', current: 'Jelenlegi szerver',
      directory: 'Elérhető szerverek', loading: 'Szerverlista betöltése…', offline: 'Nem érhető el',
      unavailable: 'A szerverlista most nem érhető el. Saját szervercímet ettől függetlenül megadhat.',
      address: 'Másik szerver címe', placeholder: 'https://studio.pelda.hu',
      help: 'A saját szervernek HTTPS-en elérhető Studio-felületet és API-t kell biztosítania. Váltáskor az új szerveren folytatja; a korábbi szerveren tárolt adatok nem változnak.',
      choose: 'Szerver megnyitása', apply: 'Saját szerver megnyitása',
      reset: 'Hivatalos szerver visszaállítása', invalid: 'Adja meg a szerver teljes HTTPS-címét.',
      official: 'Hivatalos OMI Studio', empty: 'A címtárban jelenleg nincs másik szerver.',
    };
  }
  if (locale === 'de') {
    return {
      title: 'Studio-Server', summary: 'Studio-Server auswählen', current: 'Aktueller Server',
      directory: 'Verfügbare Server', loading: 'Serverliste wird geladen…', offline: 'Nicht erreichbar',
      unavailable: 'Die Serverliste ist derzeit nicht verfügbar. Sie können trotzdem eine eigene Serveradresse eingeben.',
      address: 'Adresse eines anderen Servers', placeholder: 'https://studio.beispiel.org',
      help: 'Der eigene Server muss eine über HTTPS erreichbare Studio-Oberfläche und API bereitstellen. Beim Wechsel wird der neue Server geöffnet; auf dem bisherigen Server gespeicherte Daten bleiben unverändert.',
      choose: 'Server öffnen', apply: 'Eigenen Server öffnen', reset: 'Offiziellen Server öffnen',
      invalid: 'Geben Sie die vollständige HTTPS-Adresse des Servers ein.',
      official: 'Offizielles OMI Studio', empty: 'Im Verzeichnis sind derzeit keine weiteren Server eingetragen.',
    };
  }
  return {
    title: 'Studio server', summary: 'Choose a Studio server', current: 'Current server',
    directory: 'Available servers', loading: 'Loading server list…', offline: 'Offline',
    unavailable: 'The server list is unavailable right now. You can still enter a server address.',
    address: 'Another server address', placeholder: 'https://studio.example.org',
    help: 'A custom server must provide a Studio web interface and API over HTTPS. Switching opens the new server; data stored on the previous server is unchanged.',
    choose: 'Open server', apply: 'Open custom server', reset: 'Open the official server',
    invalid: 'Enter the server’s full HTTPS address.', official: 'Official OMI Studio',
    empty: 'There are no other servers in the directory yet.',
  };
}

export function ServerEndpointSettings() {
  const { locale } = useTranslation();
  const text = copy(locale);
  const native = isNativeStudioRuntime();
  const savedOrigin = native ? getSavedNativeStudioServerOrigin() : null;
  const [open, setOpen] = useState(Boolean(savedOrigin));
  const [serverOrigin, setServerOrigin] = useState(savedOrigin ?? '');
  const [servers, setServers] = useState<StudioServerDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryAvailable, setDirectoryAvailable] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchStudioServerDirectory()
      .then((entries) => { if (active) setServers(entries); })
      .catch(() => { if (active) setDirectoryAvailable(false); })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, []);

  const currentOrigin = native ? getNativeStudioServerOrigin() : window.location.origin;

  const openServer = (value: string) => {
    setError('');
    try {
      const normalized = normalizeNativeStudioServerOrigin(value);
      if (native) {
        const changed = saveNativeStudioServerOrigin(normalized);
        if (changed) {
          window.location.reload();
          return;
        }
        setOpen(false);
        return;
      }
      if (normalized !== window.location.origin) {
        window.location.assign(normalized);
        return;
      }
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.invalid);
    }
  };

  const resetNativeServer = () => {
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
          <div className="native-server-settings__directory" aria-label={text.directory}>
            <strong>{text.directory}</strong>
            {directoryLoading ? <p>{text.loading}</p> : null}
            {!directoryLoading && !directoryAvailable ? (
              <p className="native-server-settings__help">{text.unavailable}</p>
            ) : null}
            {!directoryLoading && directoryAvailable && servers.length === 0 ? (
              <p className="native-server-settings__help">{text.empty}</p>
            ) : null}
            {servers.map((server) => {
              const selected = server.origin === currentOrigin;
              const unavailable = server.availability === 'offline';
              const label = server.id === 'omi-official' ? text.official : server.name;
              return (
                <button
                  key={server.id}
                  type="button"
                  className={selected
                    ? 'native-server-settings__server native-server-settings__server--current'
                    : 'native-server-settings__server'}
                  aria-current={selected ? 'true' : undefined}
                  disabled={unavailable}
                  onClick={() => openServer(server.origin)}
                >
                  <span>{label}</span>
                  <span dir="ltr">{server.origin}</span>
                  <span>{selected ? text.current : unavailable ? text.offline : text.choose}</span>
                </button>
              );
            })}
          </div>
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
            <button type="button" className="native-server-settings__primary" onClick={() => openServer(serverOrigin)}>
              {text.apply}
            </button>
            {native && (currentOrigin !== DEFAULT_STUDIO_API_ORIGIN || savedOrigin) ? (
              <button type="button" className="native-server-settings__secondary" onClick={resetNativeServer}>
                {text.reset}
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </section>
  );
}
