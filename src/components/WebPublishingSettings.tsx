import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';
import {
  deleteIntegrationConnection,
  getIntegrationCatalog,
  saveIntegrationConnection,
  testIntegrationConnection,
  type IntegrationConnection,
} from '../services/integrationApi';

type ProviderId = 'wordpress' | 'web-publishing';
type GenericAuthScheme = 'none' | 'bearer' | 'x-api-key' | 'basic';

export function WebPublishingSettings({ providerId }: { providerId: ProviderId }) {
  const { locale } = useTranslation();
  const copy = getCopy(locale, providerId);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [editing, setEditing] = useState<IntegrationConnection | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [authScheme, setAuthScheme] = useState<GenericAuthScheme>(
    providerId === 'wordpress' ? 'basic' : 'bearer',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const catalog = await getIntegrationCatalog();
    setConnections(
      catalog.find((provider) => provider.id === providerId)?.connections ?? [],
    );
  }

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void getIntegrationCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setConnections(
          catalog.find((provider) => provider.id === providerId)?.connections ?? [],
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  function clearForm() {
    setEditing(null);
    setDisplayName('');
    setUrl('');
    setUsername('');
    setSecret('');
    setAuthScheme(providerId === 'wordpress' ? 'basic' : 'bearer');
  }

  function beginEdit(connection: IntegrationConnection) {
    const config = connection.config ?? {};
    setEditing(connection);
    setDisplayName(connection.displayName ?? '');
    setUrl(
      typeof config[providerId === 'wordpress' ? 'baseUrl' : 'endpoint'] === 'string'
        ? String(config[providerId === 'wordpress' ? 'baseUrl' : 'endpoint'])
        : '',
    );
    setUsername(typeof config.username === 'string' ? config.username : '');
    if (providerId === 'web-publishing') {
      const stored = typeof config.authScheme === 'string' ? config.authScheme : 'bearer';
      setAuthScheme(
        ['none', 'bearer', 'x-api-key', 'basic'].includes(stored)
          ? stored as GenericAuthScheme
          : 'bearer',
      );
    }
    setSecret('');
    setMessage('');
    setError('');
  }

  async function save() {
    const name = displayName.trim();
    const targetUrl = url.trim();
    if (!name || !targetUrl) {
      setError(copy.required);
      return;
    }
    if (providerId === 'wordpress' && !username.trim()) {
      setError(copy.usernameRequired);
      return;
    }
    if (
      providerId === 'web-publishing' &&
      authScheme === 'basic' &&
      !username.trim()
    ) {
      setError(copy.usernameRequired);
      return;
    }
    if (!editing && providerId === 'wordpress' && !secret.trim()) {
      setError(copy.secretRequired);
      return;
    }
    if (
      !editing &&
      providerId === 'web-publishing' &&
      authScheme !== 'none' &&
      !secret.trim()
    ) {
      setError(copy.secretRequired);
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');
    try {
      const config = providerId === 'wordpress'
        ? {
            baseUrl: targetUrl,
            username: username.trim(),
          }
        : {
            endpoint: targetUrl,
            authScheme,
            ...(authScheme === 'basic' ? { username: username.trim() } : {}),
          };
      await saveIntegrationConnection(providerId, {
        connectionKey: editing?.connectionKey ?? crypto.randomUUID(),
        displayName: name,
        authenticationMode:
          providerId === 'web-publishing' && authScheme === 'none'
            ? 'none'
            : 'user_api_key',
        ...(secret.trim() ? { secret: secret.trim() } : {}),
        ...(providerId === 'web-publishing' && authScheme === 'none'
          ? { clearSecret: true }
          : {}),
        config,
        enabled: true,
      });
      await refresh();
      clearForm();
      setMessage(copy.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function remove(connection: IntegrationConnection) {
    if (!window.confirm(copy.deleteConfirmation(connection.displayName ?? connection.connectionKey))) {
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await deleteIntegrationConnection(connection.id);
      await refresh();
      if (editing?.id === connection.id) clearForm();
      setMessage(copy.deleted);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await testIntegrationConnection(providerId);
      await refresh();
      setMessage(result.message ?? copy.valid);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="omi-integration-config omi-publishing-form">
      <strong>{copy.title}</strong>
      <p className="omi-integration-secret-note">{copy.security}</p>

      {connections.length ? (
        <div className="omi-publishing-connections">
          {connections.map((connection) => {
            const config = connection.config ?? {};
            const target =
              typeof config[providerId === 'wordpress' ? 'baseUrl' : 'endpoint'] === 'string'
                ? String(config[providerId === 'wordpress' ? 'baseUrl' : 'endpoint'])
                : '';
            return (
              <div className="omi-publishing-connection" key={connection.id}>
                <div className="omi-publishing-connection__main">
                  <strong>{connection.displayName ?? connection.connectionKey}</strong>
                  <span>{target}</span>
                  <small>{connection.hasSecret ? copy.secretStored : copy.noSecret}</small>
                </div>
                <div className="omi-publishing-connection__actions">
                  <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => beginEdit(connection)}>
                    {copy.edit}
                  </button>
                  <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void remove(connection)}>
                    {copy.delete}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="omi-integration-secret-note">{copy.empty}</p>
      )}

      <label>
        <span>{copy.name}</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label>
        <span>{copy.url}</span>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={copy.urlPlaceholder} />
      </label>

      {providerId === 'web-publishing' ? (
        <label>
          <span>{copy.authentication}</span>
          <select value={authScheme} onChange={(event) => setAuthScheme(event.target.value as GenericAuthScheme)}>
            <option value="none">{copy.none}</option>
            <option value="bearer">Bearer</option>
            <option value="x-api-key">X-API-Key</option>
            <option value="basic">Basic</option>
          </select>
        </label>
      ) : null}

      {(providerId === 'wordpress' || authScheme === 'basic') ? (
        <label>
          <span>{copy.username}</span>
          <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
      ) : null}

      {providerId === 'wordpress' || authScheme !== 'none' ? (
        <label>
          <span>{providerId === 'wordpress' ? copy.applicationPassword : copy.secret}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={editing ? copy.leaveBlank : ''}
          />
        </label>
      ) : null}

      <div className="omi-integration-card__actions">
        <button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void save()}>
          {busy ? copy.working : copy.save}
        </button>
        {editing ? (
          <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={clearForm}>
            {copy.cancel}
          </button>
        ) : null}
        <button type="button" className="studio-menu-secondary-action" disabled={busy || connections.length === 0} onClick={() => void test()}>
          {copy.test}
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
    </div>
  );
}

function getCopy(locale: string, providerId: ProviderId) {
  const wordpress = providerId === 'wordpress';
  if (locale === 'hu') {
    return {
      title: wordpress ? 'WordPress célpontok' : 'Általános webes célpontok',
      security: wordpress
        ? 'A Studio kizárólag WordPress alkalmazásjelszót tárol titkosítva; a normál WordPress-jelszót ne add meg.'
        : 'A Bearer-, API-kulcs- vagy Basic-titok titkosítva, szerveroldalon tárolódik, és nem kerül vissza a böngészőbe.',
      empty: 'Még nincs mentett célpont.',
      name: 'Megjelenítési név',
      url: wordpress ? 'WordPress webhely URL-je' : 'Publikálási végpont',
      urlPlaceholder: wordpress ? 'https://example.org' : 'https://example.org/api/omi-newsletter',
      authentication: 'Hitelesítés',
      none: 'Nincs',
      username: 'Felhasználónév',
      applicationPassword: 'WordPress alkalmazásjelszó',
      secret: 'API-titok / jelszó',
      secretStored: 'Titok mentve',
      noSecret: 'Nincs tárolt titok',
      leaveBlank: 'Hagyd üresen a meglévő titok megtartásához',
      save: 'Mentés',
      edit: 'Szerkesztés',
      delete: 'Törlés',
      cancel: 'Mégse',
      test: 'Beállítás ellenőrzése',
      working: 'Folyamatban…',
      saved: 'A webes publikálási célpont mentve.',
      deleted: 'A webes publikálási célpont törölve.',
      valid: 'A beállítás érvényes.',
      required: 'Add meg a nevet és az URL-t.',
      usernameRequired: 'Ehhez a hitelesítéshez felhasználónév szükséges.',
      secretRequired: 'Ehhez a hitelesítéshez titok szükséges.',
      deleteConfirmation: (name: string) => `Biztosan törlöd ezt a célpontot: ${name}?`,
    };
  }
  if (locale === 'de') {
    return {
      title: wordpress ? 'WordPress-Ziele' : 'Allgemeine Web-Ziele',
      security: wordpress
        ? 'Studio speichert nur ein WordPress-Anwendungspasswort verschlüsselt; verwenden Sie nicht Ihr normales WordPress-Passwort.'
        : 'Bearer-, API-Key- oder Basic-Geheimnisse werden verschlüsselt serverseitig gespeichert und nicht an den Browser zurückgegeben.',
      empty: 'Noch kein Ziel gespeichert.',
      name: 'Anzeigename',
      url: wordpress ? 'WordPress-Website-URL' : 'Publikationsendpunkt',
      urlPlaceholder: wordpress ? 'https://example.org' : 'https://example.org/api/omi-newsletter',
      authentication: 'Authentifizierung',
      none: 'Keine',
      username: 'Benutzername',
      applicationPassword: 'WordPress-Anwendungspasswort',
      secret: 'API-Geheimnis / Passwort',
      secretStored: 'Geheimnis gespeichert',
      noSecret: 'Kein Geheimnis gespeichert',
      leaveBlank: 'Leer lassen, um das vorhandene Geheimnis zu behalten',
      save: 'Speichern',
      edit: 'Bearbeiten',
      delete: 'Löschen',
      cancel: 'Abbrechen',
      test: 'Konfiguration prüfen',
      working: 'Wird verarbeitet…',
      saved: 'Web-Publikationsziel gespeichert.',
      deleted: 'Web-Publikationsziel gelöscht.',
      valid: 'Die Konfiguration ist gültig.',
      required: 'Name und URL sind erforderlich.',
      usernameRequired: 'Für diese Authentifizierung ist ein Benutzername erforderlich.',
      secretRequired: 'Für diese Authentifizierung ist ein Geheimnis erforderlich.',
      deleteConfirmation: (name: string) => `Dieses Ziel wirklich löschen: ${name}?`,
    };
  }
  return {
    title: wordpress ? 'WordPress targets' : 'Generic web targets',
    security: wordpress
      ? 'Studio stores only a WordPress application password, encrypted server-side. Do not enter the normal WordPress account password.'
      : 'Bearer, API-key, or Basic secrets are encrypted server-side and are never returned to the browser.',
    empty: 'No target has been saved yet.',
    name: 'Display name',
    url: wordpress ? 'WordPress site URL' : 'Publishing endpoint',
    urlPlaceholder: wordpress ? 'https://example.org' : 'https://example.org/api/omi-newsletter',
    authentication: 'Authentication',
    none: 'None',
    username: 'Username',
    applicationPassword: 'WordPress application password',
    secret: 'API secret / password',
    secretStored: 'Secret stored',
    noSecret: 'No stored secret',
    leaveBlank: 'Leave blank to keep the existing secret',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    test: 'Validate configuration',
    working: 'Working…',
    saved: 'The web publishing target was saved.',
    deleted: 'The web publishing target was deleted.',
    valid: 'The configuration is valid.',
    required: 'Enter a name and URL.',
    usernameRequired: 'This authentication mode requires a username.',
    secretRequired: 'This authentication mode requires a secret.',
    deleteConfirmation: (name: string) => `Delete this target: ${name}?`,
  };
}
