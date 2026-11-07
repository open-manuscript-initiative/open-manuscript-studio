import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { getPrivacyCopy } from '../i18n/privacyTranslations';
import { fetchPrivacyNotice, publicPrivacyLink, privacyContactLink, type PublicPrivacyNotice } from '../services/privacyApi';
import '../styles/privacy.css';

export function PrivacyNotice({ expanded = false }: { expanded?: boolean }) {
  const { locale } = useTranslation();
  const text = getPrivacyCopy(locale);
  const [result, setResult] = useState<PublicPrivacyNotice | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(false);
    void fetchPrivacyNotice(controller.signal).then(setResult).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [retry]);
  const notice = result?.configured ? result.notice : null;
  const contact = notice ? privacyContactLink(notice.controller.email, text.subject) : undefined;
  const link = notice ? publicPrivacyLink(notice.noticeUrl) : undefined;
  const authority = notice ? publicPrivacyLink(notice.authority.url) : undefined;
  return <details className="privacy-notice" open={expanded || undefined}>
    <summary>{text.title}</summary>
    <div className="privacy-notice__body">
      {error ? <p role="alert">{text.unavailable} <button type="button" onClick={() => setRetry(retry + 1)}>{text.retry}</button></p>
        : !result ? <p role="status">{text.loading}</p>
          : !notice ? <p role="status">{text.missing}</p> : <>
            <p><strong>{text.controller}: {notice.controller.name}</strong><br />{notice.controller.postalAddress}<br />{notice.controller.email}</p>
            {notice.controller.dpoEmail ? <p>{text.dpo}: {notice.controller.dpoEmail}</p> : null}
            <p>{text.version}: {notice.version} ({notice.language})</p>
            {link ? <p><a href={link} target="_blank" rel="noreferrer noopener">{text.notice}</a></p> : null}
            <div>
              {notice.processing.map((item, index) => <dl key={index}>
                {(['purpose', 'categories', 'legalBasis', 'retention', 'recipients', 'internationalTransfers'] as const).map((key) =>
                  <div key={key}><dt>{text[key]}</dt><dd lang={notice.language}>{item[key]}</dd></div>)}
              </dl>)}
              {(['rights', 'dataSources', 'requiredData', 'automatedDecisions', 'cookies', 'backups', 'deletion'] as const).map((key) =>
                <section key={key}><h3>{text[key]}</h3><p lang={notice.language}>{notice[key]}</p></section>)}
            </div>
            <p>{text.contactHint}</p>
            {contact ? <p><a href={contact}>{text.contact}</a></p> : null}
            {authority ? <p><a href={authority} target="_blank" rel="noreferrer noopener">{text.authority}: {notice.authority.name}</a></p> : null}
          </>}
    </div>
  </details>;
}

export function PublicPrivacyPage() {
  const { locale } = useTranslation();
  const text = getPrivacyCopy(locale);
  return <main className="privacy-page"><h1>{text.title}</h1><PrivacyNotice expanded /><a href={window.location.pathname}>{text.back}</a></main>;
}
