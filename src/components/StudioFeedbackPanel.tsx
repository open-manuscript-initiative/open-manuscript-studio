import { useState, type FormEvent } from 'react';
import { ClipboardCopy, MessageSquareText, Send } from 'lucide-react';
import { useTranslation } from '../i18n';
import { getStudioPlatform } from '../mobile/platform/platform';
import {
  sendStudioFeedback,
  type FeedbackArea,
  type FeedbackCategory,
  type FeedbackTestOutcome,
  type StudioFeedback,
} from '../services/studioFeedbackApi';
import { BUILD_INFO } from '../version';
import './StudioFeedbackPanel.css';

const areas: FeedbackArea[] = [
  'editor', 'import', 'export', 'notes', 'collaboration', 'publishing', 'account', 'other',
];

const copyByLanguage = {
  hu: {
    heading: 'Visszajelzés küldése',
    intro: 'Jelents hibát, javasolj fejlesztést, vagy számolj be egy sikeres tesztről.',
    category: 'Visszajelzés típusa',
    categories: { bug: 'Hibabejelentés', suggestion: 'Fejlesztési javaslat', test: 'Tesztelési tapasztalat' },
    area: 'Érintett funkció',
    areas: { editor: 'Szövegszerkesztő', import: 'Importálás', export: 'Exportálás', notes: 'Jegyzetek és hivatkozások', collaboration: 'Együttműködés', publishing: 'Kiadványszerkesztő', account: 'Fiók és bejelentkezés', other: 'Egyéb' },
    title: 'Rövid cím',
    titlePlaceholder: 'Például: DOCX-import után eltűnik a képaláírás',
    description: 'Mi történt? Mit próbáltál ki?',
    descriptionPlaceholder: 'Írd le a tapasztalatodat. Kérjük, ne illessz be kéziratszöveget vagy személyes adatokat.',
    steps: 'A hiba előidézésének lépései (nem kötelező)',
    expected: 'Elvárt működés (nem kötelező)',
    outcome: 'A teszt eredménye',
    outcomes: { success: 'Sikeres', problem: 'Hiba tapasztalható', not_applicable: 'Nem értékelhető' },
    email: 'Kapcsolattartási e-mail (nem kötelező)',
    emailHelp: 'Csak akkor add meg, ha választ szeretnél kapni.',
    technical: 'Alkalmazásverzió, platform és felület nyelvének elküldése',
    privacy: 'A rendszer nem csatol automatikusan dokumentumot, jegyzetet, képernyőképet vagy hibanaplót. A jelentés az aktuálisan kiválasztott Studio-szerver üzemeltetőjéhez kerül.',
    submit: 'Visszajelzés elküldése',
    sending: 'Küldés…',
    success: 'A visszajelzés megérkezett. Azonosító:',
    newReport: 'Új visszajelzés',
    error: 'A küldés sikertelen. A beírt adatok megmaradtak.',
    disabled: 'Ezen a Studio-szerveren még nincs beállítva a visszajelzések fogadása.',
    limited: 'Túl sok visszajelzés érkezett. Próbáld újra később.',
    copy: 'Szöveg másolása',
    copied: 'A szöveg vágólapra másolva.',
  },
  de: {
    heading: 'Feedback senden',
    intro: 'Melden Sie einen Fehler, schlagen Sie eine Verbesserung vor oder beschreiben Sie einen Test.',
    category: 'Art des Feedbacks',
    categories: { bug: 'Fehlerbericht', suggestion: 'Verbesserungsvorschlag', test: 'Testerfahrung' },
    area: 'Betroffener Bereich',
    areas: { editor: 'Editor', import: 'Import', export: 'Export', notes: 'Anmerkungen und Zitate', collaboration: 'Zusammenarbeit', publishing: 'Publikationseditor', account: 'Konto und Anmeldung', other: 'Sonstiges' },
    title: 'Kurzer Titel',
    titlePlaceholder: 'Beispiel: Bildunterschrift fehlt nach DOCX-Import',
    description: 'Was ist passiert? Was haben Sie getestet?',
    descriptionPlaceholder: 'Beschreiben Sie Ihre Erfahrung. Bitte keine Manuskriptinhalte oder personenbezogenen Daten einfügen.',
    steps: 'Schritte zum Reproduzieren (optional)',
    expected: 'Erwartetes Verhalten (optional)',
    outcome: 'Testergebnis',
    outcomes: { success: 'Erfolgreich', problem: 'Problem aufgetreten', not_applicable: 'Nicht zutreffend' },
    email: 'Kontakt-E-Mail (optional)',
    emailHelp: 'Nur angeben, wenn Sie eine Antwort wünschen.',
    technical: 'App-Version, Plattform und Oberflächensprache mitsenden',
    privacy: 'Dokumente, Anmerkungen, Screenshots und Fehlerprotokolle werden nicht automatisch angehängt. Der Bericht geht an den Betreiber des ausgewählten Studio-Servers.',
    submit: 'Feedback senden',
    sending: 'Wird gesendet…',
    success: 'Feedback eingegangen. Kennung:',
    newReport: 'Weiteres Feedback',
    error: 'Senden fehlgeschlagen. Ihre Angaben bleiben erhalten.',
    disabled: 'Feedback ist auf diesem Studio-Server noch nicht eingerichtet.',
    limited: 'Zu viele Meldungen. Bitte versuchen Sie es später erneut.',
    copy: 'Text kopieren',
    copied: 'Text in die Zwischenablage kopiert.',
  },
  en: {
    heading: 'Send feedback',
    intro: 'Report an issue, suggest an improvement, or describe a completed test.',
    category: 'Feedback type',
    categories: { bug: 'Bug report', suggestion: 'Feature suggestion', test: 'Testing experience' },
    area: 'Affected feature',
    areas: { editor: 'Editor', import: 'Import', export: 'Export', notes: 'Notes and citations', collaboration: 'Collaboration', publishing: 'Publication editor', account: 'Account and sign-in', other: 'Other' },
    title: 'Short title',
    titlePlaceholder: 'For example: caption disappears after DOCX import',
    description: 'What happened? What did you test?',
    descriptionPlaceholder: 'Describe your experience. Do not paste manuscript content or personal data.',
    steps: 'Steps to reproduce (optional)',
    expected: 'Expected behavior (optional)',
    outcome: 'Test result',
    outcomes: { success: 'Successful', problem: 'Problem found', not_applicable: 'Not applicable' },
    email: 'Contact e-mail (optional)',
    emailHelp: 'Provide only if you would like a reply.',
    technical: 'Include app version, platform and interface language',
    privacy: 'Documents, notes, screenshots and error logs are never attached automatically. Your report goes to the operator of the currently selected Studio server.',
    submit: 'Send feedback',
    sending: 'Sending…',
    success: 'Feedback received. Reference:',
    newReport: 'New feedback',
    error: 'Sending failed. Your entered details have been preserved.',
    disabled: 'Feedback is not configured on this Studio server.',
    limited: 'Too many reports. Please try again later.',
    copy: 'Copy report text',
    copied: 'Report copied to the clipboard.',
  },
};

export function getStudioFeedbackNavigationLabel(locale: string): string {
  return locale.startsWith('hu') ? copyByLanguage.hu.heading
    : locale.startsWith('de') ? copyByLanguage.de.heading
      : copyByLanguage.en.heading;
}

export function StudioFeedbackPanel() {
  const { locale } = useTranslation();
  const copy = locale.startsWith('hu') ? copyByLanguage.hu
    : locale.startsWith('de') ? copyByLanguage.de : copyByLanguage.en;

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [area, setArea] = useState<FeedbackArea>('editor');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [testOutcome, setTestOutcome] = useState<FeedbackTestOutcome>('success');
  const [contactEmail, setContactEmail] = useState('');
  const [includeTechnical, setIncludeTechnical] = useState(false);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const report: StudioFeedback = {
    category, area, title: title.trim(), description: description.trim(),
    ...(category === 'bug' && reproductionSteps.trim() ? { reproductionSteps: reproductionSteps.trim() } : {}),
    ...(category === 'bug' && expectedResult.trim() ? { expectedResult: expectedResult.trim() } : {}),
    ...(category === 'test' ? { testOutcome } : {}),
    ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
    ...(includeTechnical
      ? { technical: { platform: getStudioPlatform(), appVersion: BUILD_INFO.version, locale } }
      : {}),
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const id = await sendStudioFeedback(report);
      setReference(id);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      setError(code === 'FEEDBACK_DISABLED' ? copy.disabled
        : code === 'FEEDBACK_RATE_LIMITED' ? copy.limited : copy.error);
    } finally {
      setSending(false);
    }
  }

  async function onCopy() {
    const contents = [
      copy.categories[category], copy.areas[area], title, description,
      reproductionSteps, expectedResult,
      category === 'test' ? copy.outcomes[testOutcome] : '',
    ].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(contents);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="studio-feedback" aria-label={copy.heading}>
      <header className="studio-feedback__header">
        <MessageSquareText aria-hidden="true" size={22} />
        <div><h2>{copy.heading}</h2><p>{copy.intro}</p></div>
      </header>
      {reference ? (
        <div className="studio-feedback__confirmation" role="status">
          <p>{copy.success} <strong>{reference}</strong></p>
          <button type="button" onClick={() => {
            setReference(''); setTitle(''); setDescription(''); setReproductionSteps('');
            setExpectedResult(''); setError(''); setCopied(false);
          }}>{copy.newReport}</button>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="studio-feedback__form">
          <label>{copy.category}
            <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>
              {(['bug', 'suggestion', 'test'] as const).map((key) =>
                <option key={key} value={key}>{copy.categories[key]}</option>)}
            </select>
          </label>
          <label>{copy.area}
            <select value={area} onChange={(event) => setArea(event.target.value as FeedbackArea)}>
              {areas.map((key) => <option key={key} value={key}>{copy.areas[key]}</option>)}
            </select>
          </label>
          <label>{copy.title}
            <input required minLength={5} maxLength={120} value={title}
              placeholder={copy.titlePlaceholder} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>{copy.description}
            <textarea required minLength={15} maxLength={4000} rows={5} value={description}
              placeholder={copy.descriptionPlaceholder}
              onChange={(event) => setDescription(event.target.value)} />
          </label>
          {category === 'bug' && <>
            <label>{copy.steps}
              <textarea maxLength={1500} rows={3} value={reproductionSteps}
                onChange={(event) => setReproductionSteps(event.target.value)} />
            </label>
            <label>{copy.expected}
              <textarea maxLength={1500} rows={3} value={expectedResult}
                onChange={(event) => setExpectedResult(event.target.value)} />
            </label>
          </>}
          {category === 'test' && <label>{copy.outcome}
            <select value={testOutcome} onChange={(event) => setTestOutcome(event.target.value as FeedbackTestOutcome)}>
              {(['success', 'problem', 'not_applicable'] as const).map((key) =>
                <option key={key} value={key}>{copy.outcomes[key]}</option>)}
            </select>
          </label>}
          <label>{copy.email}
            <input type="email" maxLength={320} autoComplete="email" value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)} />
            <small>{copy.emailHelp}</small>
          </label>
          <label className="studio-feedback__checkbox">
            <input type="checkbox" checked={includeTechnical}
              onChange={(event) => setIncludeTechnical(event.target.checked)} />
            <span>{copy.technical}</span>
          </label>
          <p className="studio-feedback__privacy">{copy.privacy}</p>
          {error && <p className="studio-feedback__error" role="alert">{error}</p>}
          {copied && <p role="status">{copy.copied}</p>}
          <div className="studio-feedback__actions">
            <button type="submit" disabled={sending}>
              <Send size={16} aria-hidden="true" />{sending ? copy.sending : copy.submit}
            </button>
            <button type="button" className="studio-feedback__secondary" onClick={() => void onCopy()}>
              <ClipboardCopy size={16} aria-hidden="true" />{copy.copy}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
