import { useState } from 'react';
import { ExternalLink, Trash2, X } from 'lucide-react';

import { useTranslation } from '../i18n';
import { getAccountDeletionCopy } from '../i18n/accountDeletionTranslations';
import { deleteCurrentAccount } from '../services/accountDeletionApi';
import { useAuthStore } from '../store/authStore';
import '../styles/account-deletion.css';

export function AccountDeletionSection({ email }: { email: string }) {
  const { locale } = useTranslation();
  const labels = getAccountDeletionCopy(locale);
  const resetAuthStore = useAuthStore((state) => state.resetAuthStore);
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmation.trim().toLowerCase() === email.trim().toLowerCase();

  const deleteAccount = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCurrentAccount(confirmation);
      resetAuthStore();
      globalThis.location?.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.blocked);
      setDeleting(false);
    }
  };

  return (
    <section className="account-deletion" aria-labelledby="account-deletion-title">
      <div className="account-deletion-heading">
        <div>
          <h3 id="account-deletion-title">{labels.title}</h3>
          <p>{labels.description}</p>
        </div>
        <Trash2 size={20} aria-hidden="true" />
      </div>

      <p className="account-deletion-note">{labels.retained}</p>
      <p className="account-deletion-note">{labels.external}</p>

      <a
        className="account-deletion-link"
        href="https://openmanuscript.org/account-deletion"
        target="_blank"
        rel="noreferrer"
      >
        {labels.learnMore}
        <ExternalLink size={14} aria-hidden="true" />
      </a>

      {!expanded ? (
        <button
          type="button"
          className="account-delete-trigger"
          onClick={() => setExpanded(true)}
        >
          <Trash2 size={16} aria-hidden="true" />
          {labels.start}
        </button>
      ) : (
        <div className="account-deletion-confirmation">
          <label>
            <span>{labels.confirmLabel}</span>
            <input
              type="email"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="email"
              placeholder={email}
              disabled={deleting}
            />
          </label>
          <small>{labels.confirmHint}</small>
          {error ? <div className="account-error" role="alert">{error}</div> : null}
          <div className="account-deletion-actions">
            <button
              type="button"
              className="account-delete-cancel"
              onClick={() => {
                setExpanded(false);
                setConfirmation('');
                setError(null);
              }}
              disabled={deleting}
            >
              <X size={16} aria-hidden="true" />
              {labels.cancel}
            </button>
            <button
              type="button"
              className="account-delete-confirm"
              onClick={() => void deleteAccount()}
              disabled={!confirmed || deleting}
            >
              <Trash2 size={16} aria-hidden="true" />
              {deleting ? labels.deleting : labels.delete}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
