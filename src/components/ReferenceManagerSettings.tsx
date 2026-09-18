import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IntegrationProviderStatus } from '../integrations/contracts';
import {
  deleteIntegrationConnection,
  getIntegrationCatalog,
  getIntegrationStatus,
  saveIntegrationConnection,
  testIntegrationConnection,
  type IntegrationConnection,
} from '../services/integrationApi';
import {
  consumeReferenceManagerOAuthResultFromLocation,
  listenForReferenceManagerOAuthReturn,
  startMendeleyOAuth,
  type ReferenceManagerProviderId,
} from '../services/referenceManagerApi';

interface ReferenceManagerSettingsProps {
  provider: ReferenceManagerProviderId;
  locale: string;
  onStatus?: (status: IntegrationProviderStatus) => void;
}

export function ReferenceManagerSettings({
  provider,
  locale,
  onStatus,
}: ReferenceManagerSettingsProps) {
  const copy = useMemo(() => getCopy(locale), [locale]);
  const [apiKey, setApiKey] = useState('');
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [status, setStatus] = useState<IntegrationProviderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [catalog, nextStatus] = await Promise.all([
      getIntegrationCatalog(),
      getIntegrationStatus(provider),
    ]);
    const nextConnection =
      catalog
        .find((entry) => entry.id === provider)
        ?.connections.find((candidate) => candidate.enabled) ?? null;
    setConnection(nextConnection);
    setStatus(nextStatus);
    onStatus?.(nextStatus);
  }, [provider, onStatus]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void refresh()
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (provider !== 'mendeley') return;
    const fromLocation = consumeReferenceManagerOAuthResultFromLocation();
    if (fromLocation) {
      if (fromLocation.status === 'connected') {
        setNotice(copy.connected);
        void refresh();
      } else {
        setError(copy.oauthFailed);
      }
    }

    let dispose = () => undefined;
    void listenForReferenceManagerOAuthReturn((result) => {
      if (result.status === 'connected') {
        setNotice(copy.connected);
        void refresh();
      } else {
        setError(copy.oauthFailed);
      }
    }).then((unsubscribe) => {
      dispose = unsubscribe;
    });
    return () => dispose();
  }, [provider, refresh, copy.connected, copy.oauthFailed]);

  async function saveZotero() {
    const key = apiKey.trim();
    if (!key) {
      setError(copy.apiKeyRequired);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveIntegrationConnection('zotero', {
        connectionKey: 'personal',
        displayName: 'Zotero personal library',
        authenticationMode: 'user_api_key',
        secret: key,
        enabled: true,
      });
      setApiKey('');
      const checked = await testIntegrationConnection('zotero');
      setStatus(checked);
      onStatus?.(checked);
      await refresh();
      setNotice(checked.healthy ? copy.connected : checked.message ?? copy.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function connectMendeley() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await startMendeleyOAuth();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  async function testCurrent() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const checked = await testIntegrationConnection(provider);
      setStatus(checked);
      onStatus?.(checked);
      setNotice(checked.message ?? (checked.healthy ? copy.connected : copy.testFailed));
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!connection) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteIntegrationConnection(connection.id);
      setConnection(null);
      const nextStatus = await getIntegrationStatus(provider);
      setStatus(nextStatus);
      onStatus?.(nextStatus);
      setNotice(copy.disconnected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="omi-integration-config">
      <strong>
        {provider === 'zotero' ? copy.zoteroTitle : copy.mendeleyTitle}
      </strong>
      <p>
        {provider === 'zotero'
          ? copy.zoteroDescription
          : copy.mendeleyDescription}
      </p>

      {provider === 'zotero' && !connection ? (
        <>
          <label>
            <span>{copy.zoteroApiKey}</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={copy.zoteroApiKeyPlaceholder}
            />
          </label>
          <p className="omi-integration-secret-note">{copy.zoteroSecurity}</p>
          <div className="omi-integration-card__actions">
            <button
              type="button"
              className="studio-menu-primary-action"
              disabled={busy || !apiKey.trim()}
              onClick={() => void saveZotero()}
            >
              {busy ? copy.working : copy.saveAndConnect}
            </button>
          </div>
        </>
      ) : null}

      {provider === 'mendeley' && !connection ? (
        <div className="omi-integration-card__actions">
          <button
            type="button"
            className="studio-menu-primary-action"
            disabled={busy || status?.configured === false}
            onClick={() => void connectMendeley()}
          >
            {busy ? copy.working : copy.connectMendeley}
          </button>
        </div>
      ) : null}

      {connection ? (
        <>
          <dl>
            <div>
              <dt>{copy.connection}</dt>
              <dd>{connection.displayName ?? copy.personalLibrary}</dd>
            </div>
            <div>
              <dt>{copy.health}</dt>
              <dd>
                {status?.healthy === true
                  ? copy.healthy
                  : status?.healthy === false
                    ? copy.unhealthy
                    : copy.unknown}
              </dd>
            </div>
          </dl>
          <div className="omi-integration-card__actions">
            <button
              type="button"
              className="studio-menu-secondary-action"
              disabled={busy}
              onClick={() => void testCurrent()}
            >
              {copy.test}
            </button>
            <button
              type="button"
              className="studio-menu-secondary-action"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {copy.disconnect}
            </button>
          </div>
        </>
      ) : null}

      <p className="omi-integration-secret-note">{copy.readOnly}</p>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? (
        <p className="omi-integration-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      zoteroTitle: 'Zotero személyes könyvtár',
      zoteroDescription:
        'Kapcsold össze a Zotero-fiókod privát bibliográfiai könyvtárát a Stúdióval. A Hivatkozások keresőjében ezután közvetlenül kereshetsz a saját rekordjaid között.',
      zoteroApiKey: 'Személyes Zotero API-kulcs',
      zoteroApiKeyPlaceholder: 'Zotero API key',
      zoteroSecurity:
        'A kulcs titkosítva, szerveroldalon tárolódik. A Stúdió nem kér Zotero-jelszót.',
      mendeleyTitle: 'Mendeley személyes könyvtár',
      mendeleyDescription:
        'A Mendeley-fiók összekapcsolása OAuth 2.0-val történik. A hozzáférési és frissítési token titkosítva marad a Studio szerverén.',
      connectMendeley: 'Mendeley összekapcsolása',
      apiKeyRequired: 'Add meg a Zotero API-kulcsot.',
      saveAndConnect: 'Mentés és kapcsolódás',
      working: 'Feldolgozás…',
      connection: 'Kapcsolat',
      health: 'Állapot',
      personalLibrary: 'Személyes könyvtár',
      healthy: 'Rendben',
      unhealthy: 'Hiba',
      unknown: 'Ismeretlen',
      test: 'Teszt',
      disconnect: 'Leválasztás',
      connected: 'A referenciakezelő sikeresen kapcsolódott.',
      disconnected: 'A kapcsolat leválasztva.',
      saved: 'A kapcsolat mentve.',
      testFailed: 'A kapcsolat ellenőrzése sikertelen.',
      oauthFailed: 'A Mendeley-hitelesítés nem sikerült.',
      readOnly:
        'A jelenlegi integráció csak olvassa és importálja a bibliográfiai rekordokat; a külső Zotero/Mendeley könyvtárat nem módosítja.',
    };
  }
  if (locale === 'de') {
    return {
      zoteroTitle: 'Persönliche Zotero-Bibliothek',
      zoteroDescription:
        'Verbinden Sie Ihre private Zotero-Bibliothek mit Studio. Danach können Sie Ihre eigenen Datensätze direkt unter Referenzen durchsuchen.',
      zoteroApiKey: 'Persönlicher Zotero-API-Schlüssel',
      zoteroApiKeyPlaceholder: 'Zotero API key',
      zoteroSecurity:
        'Der Schlüssel wird verschlüsselt auf dem Server gespeichert. Studio fragt nicht nach Ihrem Zotero-Passwort.',
      mendeleyTitle: 'Persönliche Mendeley-Bibliothek',
      mendeleyDescription:
        'Mendeley wird über OAuth 2.0 verbunden. Zugriffs- und Aktualisierungstoken bleiben verschlüsselt auf dem Studio-Server.',
      connectMendeley: 'Mendeley verbinden',
      apiKeyRequired: 'Geben Sie den Zotero-API-Schlüssel ein.',
      saveAndConnect: 'Speichern und verbinden',
      working: 'Verarbeitung…',
      connection: 'Verbindung',
      health: 'Status',
      personalLibrary: 'Persönliche Bibliothek',
      healthy: 'In Ordnung',
      unhealthy: 'Fehler',
      unknown: 'Unbekannt',
      test: 'Testen',
      disconnect: 'Trennen',
      connected: 'Der Literaturverwaltungsdienst wurde erfolgreich verbunden.',
      disconnected: 'Die Verbindung wurde getrennt.',
      saved: 'Die Verbindung wurde gespeichert.',
      testFailed: 'Die Verbindungsprüfung ist fehlgeschlagen.',
      oauthFailed: 'Die Mendeley-Autorisierung ist fehlgeschlagen.',
      readOnly:
        'Die aktuelle Integration liest und importiert nur bibliografische Datensätze; die externe Zotero-/Mendeley-Bibliothek wird nicht verändert.',
    };
  }
  return {
    zoteroTitle: 'Personal Zotero library',
    zoteroDescription:
      'Connect your private Zotero library to Studio. You can then search your own records directly from References.',
    zoteroApiKey: 'Personal Zotero API key',
    zoteroApiKeyPlaceholder: 'Zotero API key',
    zoteroSecurity:
      'The key is encrypted and stored server-side. Studio never asks for your Zotero password.',
    mendeleyTitle: 'Personal Mendeley library',
    mendeleyDescription:
      'Mendeley connects with OAuth 2.0. Access and refresh tokens remain encrypted on the Studio server.',
    connectMendeley: 'Connect Mendeley',
    apiKeyRequired: 'Enter the Zotero API key.',
    saveAndConnect: 'Save and connect',
    working: 'Working…',
    connection: 'Connection',
    health: 'Status',
    personalLibrary: 'Personal library',
    healthy: 'Healthy',
    unhealthy: 'Error',
    unknown: 'Unknown',
    test: 'Test',
    disconnect: 'Disconnect',
    connected: 'The reference manager was connected successfully.',
    disconnected: 'The connection was disconnected.',
    saved: 'The connection was saved.',
    testFailed: 'The connection test failed.',
    oauthFailed: 'Mendeley authorization failed.',
    readOnly:
      'The current integration only reads and imports bibliographic records; it does not modify the external Zotero/Mendeley library.',
  };
}
