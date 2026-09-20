import { KeyRound, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getPersonalPublishingCredentialsCopy } from '../i18n/personalPublishingCredentials';
import {
  deletePersonalPublishingCredential,
  getPersonalPublishingCredentials,
  savePersonalPublishingCredential,
  type PersonalPublishingCredentialProvider,
  type PersonalPublishingCredentialState,
} from '../services/authApi';

interface PersonalPublishingCredentialsSettingsProps {
  locale: string;
}

interface CredentialDraft {
  provider: PersonalPublishingCredentialProvider;
  label: string;
  baseUrl: string;
  apiKey: string;
}

const emptyDraft: CredentialDraft = {
  provider: 'ojs',
  label: '',
  baseUrl: '',
  apiKey: '',
};

export function PersonalPublishingCredentialsSettings({
  locale,
}: PersonalPublishingCredentialsSettingsProps) {
  const copy = getPersonalPublishingCredentialsCopy(locale);
  const [credentials, setCredentials] = useState<PersonalPublishingCredentialState[]>([]);
  const [draft, setDraft] = useState<CredentialDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedCredentials = useMemo(
    () =>
      [...credentials].sort((left, right) =>
        left.provider === right.provider
          ? left.baseUrl.localeCompare(right.baseUrl)
          : left.provider.localeCompare(right.provider),
      ),
    [credentials],
  );

  useEffect(() => {
    let cancelled = false;
    void getPersonalPublishingCredentials()
      .then((items) => {
        if (!cancelled) setCredentials(items);
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

  async function saveCredential(): Promise<void> {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const credential = await savePersonalPublishingCredential({
        provider: draft.provider,
        label: draft.label.trim() || undefined,
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey,
      });
      setCredentials((current) => [
        ...current.filter((item) => item.id !== credential.id),
        credential,
      ]);
      setDraft((current) => ({
        provider: current.provider,
        label: '',
        baseUrl: '',
        apiKey: '',
      }));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeCredential(
    credential: PersonalPublishingCredentialState,
  ): Promise<void> {
    const name = credential.label?.trim() || credential.baseUrl;
    if (!globalThis.confirm(copy.removeConfirmation(name))) return;

    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await deletePersonalPublishingCredential(credential.id);
      setCredentials((current) =>
        current.filter((item) => item.id !== credential.id),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="account-ojs-credential account-publishing-credentials"
      aria-labelledby="account-publishing-credentials-title"
    >
      <div className="account-publishing-credentials__heading">
        <KeyRound size={19} aria-hidden="true" />
        <div>
          <h2 id="account-publishing-credentials-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      <p className="account-field-hint">{copy.security}</p>

      <div className="account-publishing-credentials__saved">
        <h3>{copy.savedConnections}</h3>
        {sortedCredentials.length ? (
          <div className="account-publishing-credentials__list">
            {sortedCredentials.map((credential) => (
              <div
                className="account-publishing-credential-row"
                key={credential.id}
              >
                <div className="account-publishing-credential-row__copy">
                  <div className="account-publishing-credential-row__title">
                    <strong>
                      {credential.label?.trim() || credential.baseUrl}
                    </strong>
                    <span className="account-publishing-credential-badge">
                      {credential.provider === 'omp' ? copy.omp : copy.ojs}
                    </span>
                  </div>
                  {credential.label?.trim() ? (
                    <small>{credential.baseUrl}</small>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="account-publishing-credential-remove"
                  disabled={busy}
                  onClick={() => void removeCredential(credential)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {copy.remove}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="account-identity-muted">{copy.none}</p>
        )}
      </div>

      <div className="account-publishing-credentials__editor">
        <h3>{copy.addTitle}</h3>
        <label>
          {copy.provider}
          <select
            value={draft.provider}
            disabled={busy}
            onChange={(event) => {
              setSaved(false);
              setDraft({
                ...draft,
                provider: event.target.value as PersonalPublishingCredentialProvider,
              });
            }}
          >
            <option value="ojs">{copy.ojs}</option>
            <option value="omp">{copy.omp}</option>
          </select>
        </label>
        <label>
          {copy.label}
          <input
            value={draft.label}
            disabled={busy}
            maxLength={200}
            onChange={(event) => {
              setSaved(false);
              setDraft({ ...draft, label: event.target.value });
            }}
            placeholder={copy.labelPlaceholder}
          />
        </label>
        <label>
          {copy.baseUrl}
          <input
            type="url"
            value={draft.baseUrl}
            disabled={busy}
            onChange={(event) => {
              setSaved(false);
              setDraft({ ...draft, baseUrl: event.target.value });
            }}
          />
        </label>
        <label>
          {copy.apiKey}
          <input
            type="password"
            autoComplete="new-password"
            value={draft.apiKey}
            disabled={busy}
            onChange={(event) => {
              setSaved(false);
              setDraft({ ...draft, apiKey: event.target.value });
            }}
            placeholder={copy.apiKeyPlaceholder}
          />
        </label>
        <small className="account-field-hint">{copy.replaceHint}</small>

        {error ? (
          <div className="account-error" role="alert">{error}</div>
        ) : null}
        {saved ? (
          <div className="account-success" role="status">{copy.saved}</div>
        ) : null}

        <button
          className="account-primary"
          type="button"
          disabled={
            busy ||
            !draft.baseUrl.trim() ||
            !draft.apiKey.trim()
          }
          onClick={() => void saveCredential()}
        >
          <KeyRound size={16} aria-hidden="true" />
          {copy.save}
        </button>
      </div>
    </section>
  );
}
