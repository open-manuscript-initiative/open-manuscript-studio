import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  acceptPendingCollaborationInvitation,
  declinePendingCollaborationInvitation,
  getPendingCollaborationInvitations,
  isCollaborationEnabled,
  type PendingCollaborationInvitation,
} from '../services/collaborationApi';

export function CollaborationInbox({ children }: { children: ReactNode }) {
  const [invitations, setInvitations] = useState<PendingCollaborationInvitation[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const enabledRef = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (enabledRef.current === null) enabledRef.current = await isCollaborationEnabled();
      if (!enabledRef.current) return;
      setInvitations(await getPendingCollaborationInvitations());
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
      if (accept) await acceptPendingCollaborationInvitation(invitation.id);
      else await declinePendingCollaborationInvitation(invitation.id);
      setInvitations((pending) => pending.filter((item) => item.id !== invitation.id));
      if (accept) {
        setMessage(`Accepted: ${invitation.documentTitle}. Open that OMI manuscript in Studio to join its live edit.`);
        window.dispatchEvent(new Event('omi:collaboration-access-changed'));
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
      {invitations.length || message ? (
        <aside className="omi-collaboration-inbox" aria-label="Manuscript invitations">
          <strong>Manuscript invitations</strong>
          {invitations.map((invitation) => (
            <div className="omi-collaboration-inbox__item" key={invitation.id}>
              <span><b>{invitation.documentTitle}</b><small>{invitation.role.toLowerCase()} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</small></span>
              <div>
                <button type="button" disabled={busyInvitationId !== null} onClick={() => void decide(invitation, true)}>Accept</button>
                <button type="button" className="secondary" disabled={busyInvitationId !== null} onClick={() => void decide(invitation, false)}>Decline</button>
              </div>
            </div>
          ))}
          <small>Only accepted invitations grant manuscript access. After accepting, open the same OMI manuscript in Studio.</small>
          {message ? <p role="status">{message}</p> : null}
        </aside>
      ) : null}
    </>
  );
}
