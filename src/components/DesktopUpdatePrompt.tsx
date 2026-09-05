import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

import { useTranslation } from '../i18n';
import {
  applyStudioUpdate,
  checkForStudioUpdate,
  type StudioUpdateInfo,
} from '../services/studioUpdater';
import './DesktopUpdatePrompt.css';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const UPDATE_DISMISS_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const DISMISSED_UPDATE_KEY = 'omi:studio-update-dismissed';

type UpdateCopy = {
  title: string;
  update: string;
  later: string;
  applying: string;
  failed: string;
};

const COPY: Record<string, UpdateCopy> = {
  bg: { title: 'Налична е нова версия на OMI Studio', update: 'Актуализиране', later: 'По-късно', applying: 'Актуализиране…', failed: 'Актуализацията не бе успешна.' },
  cs: { title: 'Je k dispozici nová verze OMI Studio', update: 'Aktualizovat', later: 'Později', applying: 'Aktualizace…', failed: 'Aktualizace se nezdařila.' },
  da: { title: 'En ny version af OMI Studio er tilgængelig', update: 'Opdater', later: 'Senere', applying: 'Opdaterer…', failed: 'Opdateringen mislykkedes.' },
  de: { title: 'Eine neue OMI-Studio-Version ist verfügbar', update: 'Aktualisieren', later: 'Später', applying: 'Aktualisierung…', failed: 'Die Aktualisierung ist fehlgeschlagen.' },
  el: { title: 'Υπάρχει νέα έκδοση του OMI Studio', update: 'Ενημέρωση', later: 'Αργότερα', applying: 'Ενημέρωση…', failed: 'Η ενημέρωση απέτυχε.' },
  en: { title: 'A new OMI Studio version is available', update: 'Update', later: 'Later', applying: 'Updating…', failed: 'The update could not be completed.' },
  es: { title: 'Hay una nueva versión de OMI Studio', update: 'Actualizar', later: 'Más tarde', applying: 'Actualizando…', failed: 'No se pudo completar la actualización.' },
  et: { title: 'Saadaval on OMI Studio uus versioon', update: 'Uuenda', later: 'Hiljem', applying: 'Uuendamine…', failed: 'Uuendamine ebaõnnestus.' },
  fi: { title: 'OMI Studiosta on saatavilla uusi versio', update: 'Päivitä', later: 'Myöhemmin', applying: 'Päivitetään…', failed: 'Päivitys epäonnistui.' },
  fr: { title: 'Une nouvelle version d’OMI Studio est disponible', update: 'Mettre à jour', later: 'Plus tard', applying: 'Mise à jour…', failed: 'La mise à jour a échoué.' },
  ga: { title: 'Tá leagan nua de OMI Studio ar fáil', update: 'Nuashonraigh', later: 'Níos déanaí', applying: 'Á nuashonrú…', failed: 'Níor éirigh leis an nuashonrú.' },
  hr: { title: 'Dostupna je nova verzija OMI Studija', update: 'Ažuriraj', later: 'Kasnije', applying: 'Ažuriranje…', failed: 'Ažuriranje nije uspjelo.' },
  hu: { title: 'Új OMI Studio-verzió érhető el', update: 'Frissítés', later: 'Később', applying: 'Frissítés…', failed: 'A frissítés nem sikerült.' },
  it: { title: 'È disponibile una nuova versione di OMI Studio', update: 'Aggiorna', later: 'Più tardi', applying: 'Aggiornamento…', failed: 'Impossibile completare l’aggiornamento.' },
  lt: { title: 'Pasiekiama nauja „OMI Studio“ versija', update: 'Atnaujinti', later: 'Vėliau', applying: 'Atnaujinama…', failed: 'Atnaujinti nepavyko.' },
  lv: { title: 'Ir pieejama jauna OMI Studio versija', update: 'Atjaunināt', later: 'Vēlāk', applying: 'Atjaunina…', failed: 'Atjaunināšana neizdevās.' },
  mt: { title: 'Verżjoni ġdida ta’ OMI Studio hija disponibbli', update: 'Aġġorna', later: 'Aktar tard', applying: 'Qed jaġġorna…', failed: 'L-aġġornament ma rnexxiex.' },
  nl: { title: 'Er is een nieuwe versie van OMI Studio beschikbaar', update: 'Bijwerken', later: 'Later', applying: 'Bijwerken…', failed: 'De update is mislukt.' },
  pl: { title: 'Dostępna jest nowa wersja OMI Studio', update: 'Aktualizuj', later: 'Później', applying: 'Aktualizowanie…', failed: 'Aktualizacja nie powiodła się.' },
  pt: { title: 'Está disponível uma nova versão do OMI Studio', update: 'Atualizar', later: 'Mais tarde', applying: 'A atualizar…', failed: 'Não foi possível concluir a atualização.' },
  ro: { title: 'Este disponibilă o versiune nouă OMI Studio', update: 'Actualizează', later: 'Mai târziu', applying: 'Se actualizează…', failed: 'Actualizarea nu a reușit.' },
  sk: { title: 'Je dostupná nová verzia OMI Studio', update: 'Aktualizovať', later: 'Neskôr', applying: 'Aktualizuje sa…', failed: 'Aktualizácia zlyhala.' },
  sl: { title: 'Na voljo je nova različica OMI Studio', update: 'Posodobi', later: 'Pozneje', applying: 'Posodabljanje…', failed: 'Posodobitev ni uspela.' },
  sv: { title: 'En ny version av OMI Studio finns tillgänglig', update: 'Uppdatera', later: 'Senare', applying: 'Uppdaterar…', failed: 'Uppdateringen misslyckades.' },
};

type DismissedUpdate = {
  version: string;
  dismissedAt: number;
};

function isDismissed(version: string): boolean {
  try {
    const stored = globalThis.localStorage.getItem(DISMISSED_UPDATE_KEY);
    if (!stored) return false;
    const dismissed = JSON.parse(stored) as DismissedUpdate;
    return dismissed.version === version
      && Date.now() - dismissed.dismissedAt < UPDATE_DISMISS_INTERVAL_MS;
  } catch {
    return false;
  }
}

function rememberDismissal(version: string): void {
  try {
    globalThis.localStorage.setItem(
      DISMISSED_UPDATE_KEY,
      JSON.stringify({ version, dismissedAt: Date.now() }),
    );
  } catch {
    // A restricted browser may not expose persistent storage.
  }
}

function conciseReleaseNotes(body: string | null | undefined): string | null {
  const normalized = body?.replace(/\r/g, '').trim();
  if (!normalized) return null;
  const firstParagraph = normalized.split(/\n\s*\n/, 1)[0] ?? normalized;
  return firstParagraph.length > 360
    ? `${firstParagraph.slice(0, 357).trimEnd()}…`
    : firstParagraph;
}

export function StudioUpdatePrompt() {
  const { locale } = useTranslation();
  const copy = COPY[locale] ?? COPY.en;
  const [update, setUpdate] = useState<StudioUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const result = await checkForStudioUpdate();
        if (!cancelled && result && !isDismissed(result.version)) {
          setUpdate(result);
        }
      } catch {
        // A version check must never prevent manuscript work.
      }
    };

    void check();
    const interval = globalThis.setInterval(
      () => void check(),
      UPDATE_CHECK_INTERVAL_MS,
    );
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', checkWhenVisible);

    return () => {
      cancelled = true;
      globalThis.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, []);

  if (!update) return null;

  async function apply(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await applyStudioUpdate(update);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      setError(`${copy.failed} ${detail}`);
      setBusy(false);
    }
  }

  function dismiss(): void {
    rememberDismissal(update.version);
    setUpdate(null);
  }

  const notes = conciseReleaseNotes(update.body);

  return (
    <aside
      className="omi-update-prompt"
      role="status"
      aria-live="polite"
      aria-labelledby="omi-update-title"
    >
      <div className="omi-update-prompt__icon">
        <RefreshCw size={20} aria-hidden="true" />
      </div>
      <div className="omi-update-prompt__body">
        <strong id="omi-update-title">{copy.title}</strong>
        <p>v{update.currentVersion} → v{update.version}</p>
        {notes ? <p className="omi-update-prompt__notes">{notes}</p> : null}
        {error ? <p className="omi-update-prompt__error" role="alert">{error}</p> : null}
        <div className="omi-update-prompt__actions">
          <button
            type="button"
            className="studio-menu-primary-action"
            disabled={busy}
            onClick={() => void apply()}
          >
            <Download size={16} aria-hidden="true" />
            {busy ? copy.applying : copy.update}
          </button>
          <button
            type="button"
            className="studio-menu-secondary-action"
            disabled={busy}
            onClick={dismiss}
          >
            {copy.later}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="omi-update-prompt__close"
        aria-label={copy.later}
        title={copy.later}
        onClick={dismiss}
        disabled={busy}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </aside>
  );
}
