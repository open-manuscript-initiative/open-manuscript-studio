import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  acceptPendingCollaborationInvitation,
  declinePendingCollaborationInvitation,
  getPendingCollaborationInvitations,
  isCollaborationEnabled,
  downloadSharedManuscriptPackage,
  type PendingCollaborationInvitation,
} from '../services/collaborationApi';
import { inspectOmiContainer } from '../services/omiContainerImport';
import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { useTranslation } from '../i18n';

export function CollaborationInbox({ children }: { children: ReactNode }) {
  const { locale } = useTranslation();
  const hu = locale.toLowerCase().startsWith('hu');
  const de = locale.toLowerCase().startsWith('de');
  const copy = {
    invitations: hu ? 'Kézirat-meghívók' : de ? 'Einladungen zu Manuskripten' : 'Manuscript invitations',
    accept: hu ? 'Elfogadás' : de ? 'Annehmen' : 'Accept',
    decline: hu ? 'Elutasítás' : de ? 'Ablehnen' : 'Decline',
    expired: hu ? 'Lejárat' : de ? 'Läuft ab' : 'Expires',
    accepted: hu ? 'Elfogadva és megnyitva' : de ? 'Angenommen und geöffnet' : 'Accepted and opened',
    activeOnly: hu
      ? 'A kézirathoz csak az elfogadott meghívó ad hozzáférést.'
      : de
        ? 'Nur angenommene Einladungen gewähren Manuskriptzugriff.'
        : 'Only accepted invitations grant manuscript access.',
    aria: hu ? 'Kézirat-meghívók' : de ? 'Einladungen zu Manuskripten' : 'Manuscript invitations',
  };
  const [invitations, setInvitations] = useState<PendingCollaborationInvitation[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enabledRef = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (enabledRef.current === null) enabledRef.current = await isCollaborationEnabled();
      if (!enabledRef.current) return;
      const pending = await getPendingCollaborationInvitations();
      setInvitations(pending);
    } catch {
      // An unavailable preview API must not block the normal Studio workspace.
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener('omi:collaboration-access-changed', refresh);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('omi:collaboration-access-changed', refresh);
    };
  }, [refresh]);

  const decide = async (invitation: PendingCollaborationInvitation, accept: boolean) => {
    setBusyInvitationId(invitation.id);
    setMessage('');
    try {
      if (accept) {
        await acceptPendingCollaborationInvitation(invitation.id);
        const plan = await inspectOmiContainer(await downloadSharedManuscriptPackage(invitation.documentId));
        await applyOmiContainerImportPlan(plan);
      }
      else await declinePendingCollaborationInvitation(invitation.id);
      setInvitations((pending) => pending.filter((item) => item.id !== invitation.id));
      if (accept) {
        setMessage(`${copy.accepted}: ${invitation.documentTitle}.`);
        window.dispatchEvent(new Event('omi:collaboration-access-changed'));
        await refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      await refresh();
    } finally {
      setBusyInvitationId(null);
    }
  };

  return (
    <>
      {children}
      {invitations.length > 0 ? (
        <aside className="omi-collaboration-inbox" aria-label={copy.aria}>
          <strong>{copy.invitations}</strong>
          {invitations.map((invitation) => (
            <div className="omi-collaboration-inbox__item" key={invitation.id}>
              <span><b>{invitation.documentTitle}</b><small>{invitation.role.toLowerCase()} · {copy.expired} {new Date(invitation.expiresAt).toLocaleDateString(locale)}</small></span>
              <div>
                <button type="button" disabled={busyInvitationId !== null} onClick={() => void decide(invitation, true)}>{copy.accept}</button>
                <button type="button" className="secondary" disabled={busyInvitationId !== null} onClick={() => void decide(invitation, false)}>{copy.decline}</button>
              </div>
            </div>
          ))}
          <small>{copy.activeOnly}</small>
          {message ? <p role="status">{message}</p> : null}
        </aside>
      ) : null}
    </>
  );
}
