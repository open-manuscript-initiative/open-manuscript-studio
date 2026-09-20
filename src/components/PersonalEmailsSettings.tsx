import { Mail, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getPersonalPublishingCredentialsCopy } from '../i18n/personalPublishingCredentials';
import {
  addPersonalProfileEmail,
  deletePersonalProfileEmail,
  getPersonalProfileEmails,
  type PersonalProfileEmailState,
} from '../services/authApi';

interface PersonalEmailsSettingsProps {
  locale: string;
  onChanged?: () => void;
}

export function PersonalEmailsSettings({
  locale,
  onChanged,
}: PersonalEmailsSettingsProps) {
  const copy = getPersonalPublishingCredentialsCopy(locale);
  const [emails, setEmails] = useState<PersonalProfileEmailState[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedEmails = useMemo(
    () =>
      [...emails].sort((left, right) =>
        left.isPrimary === right.isPrimary
          ? left.email.localeCompare(right.email)
          : left.isPrimary
            ? -1
            : 1,
      ),
    [emails],
  );

  useEffect(() => {
    let cancelled = false;
    void getPersonalProfileEmails()
      .then((items) => {
        if (!cancelled) setEmails(items);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function addEmail(): Promise<void> {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const email = await addPersonalProfileEmail(draft);
      setEmails((current) => [
        ...current.filter((item) => item.id !== email.id),
        email,
      ]);
      setDraft('');
      setSaved(true);
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeEmail(email: PersonalProfileEmailState): Promise<void> {
    if (email.isPrimary) return;
    if (!globalThis.confirm(copy.profileEmailRemoveConfirmation(email.email))) return;

    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await deletePersonalProfileEmail(email.id);
      setEmails((current) => current.filter((item) => item.id !== email.id));
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="account-publishing-credentials account-profile-emails"
      aria-labelledby="account-profile-emails-title"
    >
      <div className="account-publishing-credentials__heading">
        <Mail size={19} aria-hidden="true" />
        <div>
          <h2 id="account-profile-emails-title">{copy.profileEmailsTitle}</h2>
          <p>{copy.profileEmailsDescription}</p>
        </div>
      </div>

      {sortedEmails.length ? (
        <div className="account-publishing-credentials__list">
          {sortedEmails.map((email) => (
            <div className="account-publishing-credential-row" key={email.id}>
              <div className="account-publishing-credential-row__copy">
                <div className="account-publishing-credential-row__title">
                  <strong>{email.email}</strong>
                  {email.isPrimary ? (
                    <span className="account-publishing-credential-badge">
                      {copy.primaryEmail}
                    </span>
                  ) : null}
                </div>
              </div>
              {!email.isPrimary ? (
                <button
                  type="button"
                  className="account-publishing-credential-remove"
                  disabled={busy}
                  onClick={() => void removeEmail(email)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {copy.remove}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="account-identity-muted">{copy.profileEmailsNone}</p>
      )}

      <div className="account-publishing-credentials__editor">
        <label>
          {copy.profileEmail}
          <input
            type="email"
            value={draft}
            disabled={busy}
            maxLength={320}
            placeholder={copy.profileEmailPlaceholder}
            onChange={(event) => {
              setSaved(false);
              setDraft(event.target.value);
            }}
          />
        </label>

        {error ? <div className="account-error" role="alert">{error}</div> : null}
        {saved ? <div className="account-success" role="status">{copy.profileEmailSaved}</div> : null}

        <button
          className="account-primary"
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void addEmail()}
        >
          <Mail size={16} aria-hidden="true" />
          {copy.addProfileEmail}
        </button>
      </div>
    </section>
  );
}
