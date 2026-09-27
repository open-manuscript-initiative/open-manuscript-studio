import { useEffect, useMemo, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { Collaboration } from '@tiptap/extension-collaboration';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import * as Y from 'yjs';

const SESSION_URL = import.meta.env.BASE_URL + 'api/session';
const SESSION_KEY = 'omi-collaboration-demo-session';

function savedSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export default function CollaborationDemo() {
  const [session, setSession] = useState(savedSession);
  const [displayName, setDisplayName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('connecting');
  const [participants, setParticipants] = useState(1);

  const connection = useMemo(() => {
    if (!session) return null;
    const document = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: session.webSocketUrl,
      name: session.room,
      document,
      token: session.token,
    });
    return { document, provider };
  }, [session]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      ...(connection ? [Collaboration.configure({ document: connection.document })] : []),
    ],
    editable: Boolean(connection),
  }, [connection]);

  useEffect(() => {
    if (!connection) return undefined;
    const provider = connection.provider;
    const statusChanged = (event) => setStatus(event.status);
    const presenceChanged = () => setParticipants(provider.awareness.getStates().size);
    provider.on('status', statusChanged);
    provider.awareness.on('change', presenceChanged);
    presenceChanged();
    return () => {
      provider.off('status', statusChanged);
      provider.awareness.off('change', presenceChanged);
      provider.destroy();
      connection.document.destroy();
    };
  }, [connection]);

  async function join(event) {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch(SESSION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, accessCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not join the demo.');
      const next = { ...result, displayName: displayName.trim() };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not join the demo.');
    }
  }

  function leave() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setStatus('disconnected');
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Open Manuscript Initiative · Studio</p>
        <h1>Live collaboration demonstration</h1>
        <p>This room contains synthetic sample text only. Do not enter real manuscripts or personal data.</p>
      </header>
      {!session ? (
        <form className="join-card" onSubmit={join}>
          <h2>Join the demonstration</h2>
          <label>Display name
            <input required minLength="2" maxLength="48" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" />
          </label>
          <label>Private access code
            <input required type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="off" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit">Join shared room</button>
        </form>
      ) : (
        <section className="editor-card" aria-label="Collaboration editor">
          <div className="editor-toolbar">
            <div><h2>Synthetic manuscript</h2><p>Signed in as {session.displayName}</p></div>
            <div className="presence">
              <span className={status === 'connected' ? 'status-dot connected' : 'status-dot'} />
              <span>{status === 'connected' ? 'Connected' : 'Connecting'}</span>
              <span>{participants} participant{participants === 1 ? '' : 's'}</span>
              <button type="button" className="secondary" onClick={leave}>Leave demo</button>
            </div>
          </div>
          <p className="editor-hint">Open this page in a second browser window, join with another name, and edit the shared sample.</p>
          <EditorContent editor={editor} className="editor-content" />
        </section>
      )}
      <footer>Yjs collaboration prototype · separate from OMI Studio accounts, APIs, PostgreSQL and manuscript storage</footer>
    </main>
  );
}
