import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  getCollaborationMessages,
  sendCollaborationMessage,
  type CollaborationMessage,
} from '../services/collaborationApi';

interface CollaborationChatProps {
  documentId: string;
  locale: string;
}

export function CollaborationChat({ documentId, locale }: CollaborationChatProps) {
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const hu = locale === 'hu';
  const de = locale === 'de';
  const labels = {
    empty: hu ? 'Még nincs üzenet.' : de ? 'Noch keine Nachrichten.' : 'No messages yet.',
    placeholder: hu ? 'Írj üzenetet a dokumentum közreműködőinek…' : de ? 'Nachricht an die Mitwirkenden schreiben…' : 'Message the manuscript collaborators…',
    send: hu ? 'Küldés' : de ? 'Senden' : 'Send',
    sending: hu ? 'Küldés…' : de ? 'Senden…' : 'Sending…',
    failed: hu ? 'Az üzenetek betöltése nem sikerült.' : de ? 'Nachrichten konnten nicht geladen werden.' : 'Could not load messages.',
    sent: hu ? 'Az üzenet elküldve.' : de ? 'Nachricht gesendet.' : 'Message sent.',
  };

  const refresh = useCallback(async () => {
    try {
      setMessages(await getCollaborationMessages(documentId));
      setStatus('');
    } catch {
      setStatus(labels.failed);
    }
  }, [documentId, labels.failed]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getCollaborationMessages(documentId);
        if (active) {
          setMessages(next);
          setStatus('');
        }
      } catch {
        if (active) setStatus(labels.failed);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [documentId, labels.failed]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const sent = await sendCollaborationMessage(documentId, body);
      setMessages((current) => [...current, sent].slice(-100));
      setBody('');
      setStatus(labels.sent);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : labels.failed);
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <section className="omi-collaboration-chat" aria-label={hu ? 'Dokumentum chat' : de ? 'Dokument-Chat' : 'Document chat'}>
      <div className="omi-collaboration-chat__messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? <p>{labels.empty}</p> : messages.map((message) => (
          <article className="omi-collaboration-chat__message" key={message.id}>
            <header>
              <strong>{message.senderName}</strong>
              <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(locale)}</time>
            </header>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      <form className="omi-collaboration-chat__compose" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor={'omi-chat-' + documentId}>{labels.placeholder}</label>
        <textarea
          id={'omi-chat-' + documentId}
          value={body}
          maxLength={4000}
          onChange={(event) => setBody(event.target.value)}
          placeholder={labels.placeholder}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !body.trim()}>
          {busy ? labels.sending : labels.send}
        </button>
      </form>
      {status ? <p className="omi-collaboration-chat__status" role="status">{status}</p> : null}
    </section>
  );
}
