import { hasPlatformPasskey } from '../platform/passkeyCapability';
import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Trash2 } from 'lucide-react';

import {
  deletePasskey,
  finishPasskeyRegistration,
  getPasskeyRegistrationOptions,
  getPasskeys,
  type PasskeySummary,
} from '../services/authApi';
import { useTranslation } from '../i18n';
import '../styles/passkeys.css';

const copy = {
  en: {
    title: 'Passkeys', description: 'Use your device screen lock, fingerprint or face recognition to sign in. Biometric data stays on your device.',
    add: 'Add a passkey on this device', name: 'Passkey name', placeholder: 'For example, my phone',
    remove: 'Remove', none: 'No passkeys are registered.', unavailable: 'This browser does not provide a platform passkey.',
    added: 'Passkey added.', removed: 'Passkey removed.', failed: 'The passkey could not be updated.', confirm: 'Remove this passkey?',
  },
  hu: {
    title: 'Passkey-belépés', description: 'Jelentkezzen be az eszköz képernyőzárával, ujjlenyomatával vagy arcfelismerésével. A biometrikus adat az eszközön marad.',
    add: 'Passkey hozzáadása ezen az eszközön', name: 'Passkey neve', placeholder: 'Például: telefonom',
    remove: 'Eltávolítás', none: 'Még nincs regisztrált passkey.', unavailable: 'Ez a böngésző nem támogat eszközön tárolt passkey-t.',
    added: 'A passkey hozzáadva.', removed: 'A passkey eltávolítva.', failed: 'Nem sikerült módosítani a passkey-t.', confirm: 'Eltávolítja ezt a passkey-t?',
  },
  de: {
    title: 'Passkeys', description: 'Melden Sie sich mit der Gerätesperre, dem Fingerabdruck oder der Gesichtserkennung an. Biometrische Daten bleiben auf Ihrem Gerät.',
    add: 'Passkey auf diesem Gerät hinzufügen', name: 'Name des Passkeys', placeholder: 'Zum Beispiel: Mein Telefon',
    remove: 'Entfernen', none: 'Es ist noch kein Passkey registriert.', unavailable: 'Dieser Browser unterstützt keinen Plattform-Passkey.',
    added: 'Passkey hinzugefügt.', removed: 'Passkey entfernt.', failed: 'Der Passkey konnte nicht geändert werden.', confirm: 'Diesen Passkey entfernen?',
  },
  sk: {
    title: 'Prihlasovacie kľúče', description: 'Prihláste sa zámkom obrazovky, odtlačkom prsta alebo rozpoznaním tváre. Biometrické údaje zostávajú vo vašom zariadení.',
    add: 'Pridať kľúč v tomto zariadení', name: 'Názov kľúča', placeholder: 'Napríklad: môj telefón',
    remove: 'Odstrániť', none: 'Zatiaľ nie je zaregistrovaný žiadny kľúč.', unavailable: 'Tento prehliadač nepodporuje platformový prihlasovací kľúč.',
    added: 'Prihlasovací kľúč bol pridaný.', removed: 'Prihlasovací kľúč bol odstránený.', failed: 'Prihlasovací kľúč sa nepodarilo upraviť.', confirm: 'Odstrániť tento prihlasovací kľúč?',
  },
} as const;

export function PasskeysSettings() {
  const { locale } = useTranslation();
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const [available, setAvailable] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setPasskeys(await getPasskeys());
  }

  useEffect(() => {
    let active = true;
    void refresh().catch(() => { if (active) setError(labels.failed); });
    void hasPlatformPasskey()
      .then((value) => { if (active) setAvailable(value); })
      .catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [labels.failed]);

  async function addPasskey() {
    setBusy(true); setError(''); setMessage('');
    try {
      const options = await getPasskeyRegistrationOptions();
      const attestation = await startRegistration({ optionsJSON: options as never });
      await finishPasskeyRegistration({ challenge: String(options.challenge), response: attestation, label: name.trim() || undefined });
      setName('');
      await refresh();
      setMessage(labels.added);
    } catch {
      setError(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(passkey: PasskeySummary) {
    if (!globalThis.confirm(labels.confirm)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await deletePasskey(passkey.id);
      await refresh();
      setMessage(labels.removed);
    } catch {
      setError(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-passkeys" aria-labelledby="account-passkeys-title">
      <div className="account-section-heading">
        <div>
          <h3 id="account-passkeys-title"><Fingerprint size={18} aria-hidden="true" />{labels.title}</h3>
          <p>{labels.description}</p>
        </div>
      </div>
      {passkeys.length ? (
        <ul className="account-passkey-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              <span><KeyRound size={16} aria-hidden="true" />{passkey.label}</span>
              <button type="button" className="account-link-button" disabled={busy} onClick={() => void removePasskey(passkey)}>
                <Trash2 size={15} aria-hidden="true" />{labels.remove}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="account-field-hint">{labels.none}</p>}
      {available ? (
        <>
          <label>
            {labels.name}
            <input value={name} maxLength={100} placeholder={labels.placeholder} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="button" className="account-primary" disabled={busy} onClick={() => void addPasskey()}>
            <Fingerprint size={17} aria-hidden="true" />{labels.add}
          </button>
        </>
      ) : <p className="account-field-hint">{labels.unavailable}</p>}
      {error ? <p className="account-error" role="alert">{error}</p> : null}
      {message ? <p className="account-success" role="status">{message}</p> : null}
    </section>
  );
}
