import { useEffect, useState, type ReactNode } from 'react';

import {
  acceptCollaborationInvitation,
  declineCollaborationInvitation,
  inspectCollaborationInvitation,
} from '../services/collaborationApi';
import { getCurrentUser, useAuthStore } from '../store/authStore';

interface Invitation {
  email: string;
  role: 'EDITOR' | 'AUTHOR' | 'VIEWER';
  documentId: string;
  documentTitle: string;
  status: 'pending';
}

export function CollaborationInvitationGate({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const user = useAuthStore(getCurrentUser);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Loading invitation…');

  useEffect(() => {
    let cancelled = false;
    void inspectCollaborationInvitation(token).then((result) => {
      if (cancelled) return;
      setInvitation(result);
      setMessage('');
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
    });
    return () => { cancelled = true; };
  }, [token]);

  const decide = async (accept: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      if (accept) await acceptCollaborationInvitation(token);
      else await declineCollaborationInvitation(token);
      setAccepted(true);
      if (accept) window.dispatchEvent(new Event('omi:collaboration-access-changed'));
      const url = new URL(window.location.href);
      url.searchParams.delete('collaborationInvite');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (accepted) return <>{children}</>;
  return (
    <main className="omi-collaboration-invitation">
      <h1>Manuscript collaboration invitation</h1>
      {invitation ? (
        <>
          <p><strong>{invitation.documentTitle}</strong></p>
          <p>Invited as {invitation.role.toLowerCase()} for {invitation.email}.</p>
          <p>Signed in as {user?.email}. Accepting adds this account as a collaborator.</p>
          <div>
            <button type="button" onClick={() => void decide(true)} disabled={busy || user?.email.toLowerCase() !== invitation.email.toLowerCase()}>
              Accept invitation
            </button>
            <button type="button" className="secondary" onClick={() => void decide(false)} disabled={busy}>
              Decline
            </button>
          </div>
          {user?.email.toLowerCase() !== invitation.email.toLowerCase() ? (
            <p role="alert">Sign in with the invited email address to accept this invitation.</p>
          ) : null}
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
