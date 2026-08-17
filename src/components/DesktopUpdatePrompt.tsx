import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useTranslation } from '../i18n';
import { checkForDesktopUpdate, installDesktopUpdate, type DesktopUpdateInfo } from '../services/desktopUpdater';
import { isNativeStudio } from '../services/nativeManuscriptFile';
import './DesktopUpdatePrompt.css';

export function DesktopUpdatePrompt() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [update, setUpdate] = useState<DesktopUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNativeStudio()) return;
    let cancelled = false;
    void checkForDesktopUpdate()
      .then((result) => { if (!cancelled) setUpdate(result); })
      .catch(() => { /* silent startup check */ });
    return () => { cancelled = true; };
  }, []);

  if (!update) return null;

  async function install(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await installDesktopUpdate();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  return (
    <aside className="omi-update-prompt" role="dialog" aria-labelledby="omi-update-title">
      <div className="omi-update-prompt__icon"><RefreshCw size={20} aria-hidden="true" /></div>
      <div className="omi-update-prompt__body">
        <strong id="omi-update-title">{copy.title}</strong>
        <p>{copy.version(update.version)}</p>
        {update.body ? <p className="omi-update-prompt__notes">{update.body}</p> : null}
        {error ? <p className="omi-update-prompt__error" role="alert">{error}</p> : null}
        <div className="omi-update-prompt__actions">
          <button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void install()}>
            <Download size={16} aria-hidden="true" />{busy ? copy.installing : copy.update}
          </button>
          <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => setUpdate(null)}>{copy.later}</button>
        </div>
      </div>
      <button type="button" className="omi-update-prompt__close" aria-label={copy.later} title={copy.later} onClick={() => setUpdate(null)} disabled={busy}><X size={18} aria-hidden="true" /></button>
    </aside>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return { title: 'Új OMI Studio verzió érhető el', version: (v: string) => `Verzió: ${v}`, update: 'Frissítés', later: 'Később', installing: 'Telepítés…' };
  if (locale === 'de') return { title: 'Eine neue OMI-Studio-Version ist verfügbar', version: (v: string) => `Version: ${v}`, update: 'Aktualisieren', later: 'Später', installing: 'Installation…' };
  return { title: 'A new OMI Studio version is available', version: (v: string) => `Version: ${v}`, update: 'Update', later: 'Later', installing: 'Installing…' };
}
