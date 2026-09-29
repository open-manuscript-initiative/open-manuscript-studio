import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  acceptPendingCollaborationInvitation,
  declinePendingCollaborationInvitation,
  getPendingCollaborationInvitations,
  isCollaborationEnabled,
  listSharedCollaborativeDocuments,
  downloadSharedManuscriptPackage,
  type PendingCollaborationInvitation,
  type SharedCollaborativeDocument,
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
    shared: hu ? 'Megosztott kéziratok' : de ? 'Geteilte Manuskripte' : 'Shared manuscripts',
    accept: hu ? 'Elfogadás' : de ? 'Annehmen' : 'Accept',
    decline: hu ? 'Elutasítás' : de ? 'Ablehnen' : 'Decline',
    open: hu ? 'Megnyitás' : de ? 'Öffnen' : 'Open',
    expired: hu ? 'Lejárat' : de ? 'Läuft ab' : 'Expires',
    accepted: hu ? 'Elfogadva és megnyitva' : de ? 'Angenommen und geöffnet' : 'Accepted and opened',
    opened: hu ? 'Megnyitva' : de ? 'Geöffnet' : 'Opened',
    close: hu ? 'Bezárás' : de ? 'Schließen' : 'Close',
    showPanel: hu ? 'Meghívók és megosztott kéziratok' : de ? 'Einladungen und geteilte Manuskripte' : 'Invitations and shared manuscripts',
    activeOnly: hu
      ? 'A kézirathoz csak az elfogadott meghívó ad hozzáférést.'
      : de
        ? 'Nur angenommene Einladungen gewähren Manuskriptzugriff.'
        : 'Only accepted invitations grant manuscript access.',
    aria: hu ? 'Kézirat-meghívók és megosztott kéziratok' : de ? 'Manuskripteinladungen und geteilte Manuskripte' : 'Manuscript invitations and shared manuscripts',
  };
  const [invitations, setInvitations] = useState<PendingCollaborationInvitation[]>([]);
  const [documents, setDocuments] = useState<SharedCollaborativeDocument[]>([]);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const enabledRef = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (enabledRef.current === null) enabledRef.current = await isCollaborationEnabled();
      if (!enabledRef.current) return;
      const [pending, shared] = await Promise.all([
        getPendingCollaborationInvitations(),
        listSharedCollaborativeDocuments(),
      ]);
      setInvitations(pending);
      setDocuments(shared);
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

  const openSharedDocument = async (document: SharedCollaborativeDocument) => {
    setBusyInvitationId(document.documentId);
    setMessage('');
    try {
      const plan = await inspectOmiContainer(await downloadSharedManuscriptPackage(document.documentId));
      await applyOmiContainerImportPlan(plan);
      setMessage(`${copy.opened}: ${document.title}.`);
      setPanelOpen(false);
      window.dispatchEvent(new Event('omi:collaboration-access-changed'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyInvitationId(null);
    }
  };

  const hasInboxContent = invitations.length > 0 || documents.length > 0 || Boolean(message);

  return (
    <>
      {children}
      {hasInboxContent ? (
        panelOpen ? (
          <aside className="omi-collaboration-inbox" aria-label={copy.aria}>
            <div className="omi-collaboration-inbox__header">
              <strong>{copy.showPanel}</strong>
              <button
                type="button"
                className="secondary omi-collaboration-inbox__close"
                aria-label={copy.close}
                title={copy.close}
                onClick={() => setPanelOpen(false)}
              >
                ×
              </button>
            </div>
            {invitations.length ? <strong>{copy.invitations}</strong> : null}
            {invitations.map((invitation) => (
              <div className="omi-collaboration-inbox__item" key={invitation.id}>
                <span><b>{invitation.documentTitle}</b><small>{invitation.role.toLowerCase()} · {copy.expired} {new Date(invitation.expiresAt).toLocaleDateString(locale)}</small></span>
                <div>
                  <button type="button" disabled={busyInvitationId !== null} onClick={() => void decide(invitation, true)}>{copy.accept}</button>
                  <button type="button" className="secondary" disabled={busyInvitationId !== null} onClick={() => void decide(invitation, false)}>{copy.decline}</button>
                </div>
              </div>
            ))}
            {invitations.length ? <small>{copy.activeOnly}</small> : null}
            {documents.length ? (
              <div className="omi-collaboration-inbox__shared">
                <strong>{copy.shared}</strong>
                {documents.map((document) => (
                  <div className="omi-collaboration-inbox__item" key={document.documentId}>
                    <span><b>{document.title}</b><small>{document.role.toLowerCase()}</small></span>
                    <button type="button" disabled={busyInvitationId !== null} onClick={() => void openSharedDocument(document)}>{copy.open}</button>
                  </div>
                ))}
              </div>
            ) : null}
            {message ? <p role="status">{message}</p> : null}
          </aside>
        ) : (
          <button
            type="button"
            className="omi-collaboration-inbox__launcher"
            aria-label={copy.showPanel}
            title={copy.showPanel}
            onClick={() => setPanelOpen(true)}
          >
            <span aria-hidden="true">✉</span>
            <span>{copy.shared}</span>
            <span>{invitations.length + documents.length}</span>
          </button>
        )
      ) : null}
    </>
  );
}
