import { useState } from 'react';
import { useTranslation } from '../i18n';
import { getPrivacyCopy } from '../i18n/privacyTranslations';
import { fetchAccountData } from '../services/privacyApi';
import { saveExportBlob } from '../services/exportFileDelivery';
import { PrivacyNotice } from './PrivacyNotice';

export function AccountPrivacySection() {
  const { locale } = useTranslation();
  const text = getPrivacyCopy(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function download() {
    setBusy(true); setError(false);
    try {
      await saveExportBlob(await fetchAccountData(), 'omi-account-data.json');
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <section className="account-privacy" aria-label={text.title}>
    <PrivacyNotice />
    <p>{text.exportHint}</p>
    <button type="button" onClick={() => void download()} disabled={busy}>{busy ? text.exporting : text.export}</button>
    {error ? <p role="alert">{text.exportError}</p> : null}
  </section>;
}
