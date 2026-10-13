import { useEffect, useState, type ReactNode } from 'react';

import {
  acceptCollaborationInvitation,
  downloadSharedManuscriptPackage,
  declineCollaborationInvitation,
  inspectCollaborationInvitation,
} from '../services/collaborationApi';
import { inspectOmiContainer } from '../services/omiContainerImport';
import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { tCatalog } from '../i18n';

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
      if (accept) {
        await acceptCollaborationInvitation(token);
        if (invitation) {
          const plan = await inspectOmiContainer(await downloadSharedManuscriptPackage(invitation.documentId));
          await applyOmiContainerImportPlan(plan);
        }
      }
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
      <h1>{tCatalog("/uncataloguedUi/components-collaborationinvitationgate/manuscript-collaboration-invitation-f32a232")}</h1>
      {invitation ? (
        <>
          <p><strong>{invitation.documentTitle}</strong></p>
          <p>{tCatalog("/uncataloguedUi/components-collaborationinvitationgate/invited-as-role-for-workspace-0c87d6c", { role: invitation.role.toLowerCase(), workspace: invitation.email })}.</p>
          <p>{tCatalog("/uncataloguedUi/components-collaborationinvitationgate/signed-in-as-name-accepting-adds-this-account-as-a-col-ea9edcf", { name: user?.email ?? "" })}</p>
          <div>
            <button type="button" onClick={() => void decide(true)} disabled={busy || user?.email.toLowerCase() !== invitation.email.toLowerCase()}>
              {tCatalog("/uncataloguedUi/components-collaborationinvitationgate/accept-invitation-0b918ca")}
            </button>
            <button type="button" className="secondary" onClick={() => void decide(false)} disabled={busy}>
              {tCatalog("/uncataloguedUi/components-collaborationinvitationgate/decline-b59cf9e")}
            </button>
          </div>
          {user?.email.toLowerCase() !== invitation.email.toLowerCase() ? (
            <p role="alert">{tCatalog("/uncataloguedUi/components-collaborationinvitationgate/sign-in-with-the-invited-email-address-to-accept-this--467f451")}</p>
          ) : null}
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
