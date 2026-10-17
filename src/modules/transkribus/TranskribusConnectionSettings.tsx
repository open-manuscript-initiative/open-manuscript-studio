import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getCurrentUser, useAuthStore } from '../../store/authStore';
import { connectTranskribus, disconnectTranskribus, getTranskribusConnection, type TranskribusConnection } from './api';
import { getTranskribusCopy, transkribusErrorMessage } from './copy';
import './transkribus.css';

export function TranskribusConnectionSettings({ locale, onStatus }: {
  locale: string;
  onStatus?: (connection: TranskribusConnection) => void;
}) {
  const copy = getTranskribusCopy(locale);
  const userId = useAuthStore(state => getCurrentUser(state)?.id);
  const [connection, setConnection] = useState<TranskribusConnection | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const notify = useRef(onStatus);
  notify.current = onStatus;
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    setConnection(null); setUsername(''); setPassword('');
    notify.current?.({ connected: false, accountLabel: '' });
    setBusy(true);
    void getTranskribusConnection(controller.signal).then(status => {
      if (controller.signal.aborted) return;
      setConnection(status); notify.current?.(status);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(transkribusErrorMessage(reason, getTranskribusCopy(locale)));
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => { controller.abort(); pending.current?.abort(); };
    // UI messages are localized at the time of the request; locale changes do not reconnect an account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function change(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError('');
    try {
      const status = connection?.connected
        ? (await disconnectTranskribus(controller.signal), { connected: false, accountLabel: '' })
        : await connectTranskribus(username.trim(), password, controller.signal);
      if (!controller.signal.aborted) { setConnection(status); notify.current?.(status); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(transkribusErrorMessage(reason, copy));
    } finally {
      setPassword('');
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className="transkribus-connection" aria-label={copy.connection}>
    <h5>{copy.connection}</h5>
    <p>{copy.loginHint}</p>
    {connection?.connected ? <div className="transkribus-actions">
      <span role="status">{copy.connected}: {connection.accountLabel}</span>
      <button type="button" disabled={busy} onClick={() => void change()}>{busy ? copy.busy : copy.disconnect}</button>
    </div> : <form onSubmit={event => void change(event)} className="transkribus-login">
      <label>{copy.username}<input value={username} maxLength={320} autoComplete="username" disabled={busy} onChange={event => setUsername(event.target.value)} required /></label>
      <label>{copy.password}<input type="password" value={password} maxLength={4096} autoComplete="off" disabled={busy} onChange={event => setPassword(event.target.value)} required /></label>
      <button type="submit" disabled={busy || !username.trim() || !password}>{busy ? copy.busy : copy.connect}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    <p>{copy.moduleHint} <a href="https://docs.transkribus.org/" target="_blank" rel="noopener noreferrer">{copy.documentation}</a></p>
  </section>;
}
