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
import { getStudioFeedbackCopy } from '../i18n/studioFeedbackTranslations';
import './StudioFeedbackPanel.css';

const areas: FeedbackArea[] = [
  'editor', 'import', 'export', 'notes', 'collaboration', 'publishing', 'account', 'other',
];

export function StudioFeedbackPanel() {
  const { locale } = useTranslation();
  const copy = getStudioFeedbackCopy(locale);

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
    messageLocale: locale,
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
            <input type="email" maxLength={320} autoComplete="off" value={contactEmail}
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
