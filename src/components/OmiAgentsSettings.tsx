import { Bot, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '../i18n';
import {
  getIntegrationCatalog,
  saveIntegrationConnection,
  testIntegrationConnection,
  type IntegrationProviderStatus,
} from '../services/integrationApi';

const AGENTS = [
  'language-editor',
  'metadata-assistant',
  'summarizer',
  'citation-checker',
] as const;

type AgentId = typeof AGENTS[number];

type AgentPermission =
  | 'document.read'
  | 'document.suggest'
  | 'document.write'
  | 'metadata.read'
  | 'metadata.write'
  | 'references.read';

const SAFE_PERMISSIONS: AgentPermission[] = [
  'document.read',
  'document.suggest',
  'metadata.read',
  'references.read',
];

interface StoredConfig {
  version?: unknown;
  enabledAgents?: unknown;
  permissions?: unknown;
  reviewRequired?: unknown;
}

export function OmiAgentsSettings() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [enabled, setEnabled] = useState(true);
  const [reviewRequired, setReviewRequired] = useState(true);
  const [enabledAgents, setEnabledAgents] = useState<AgentId[]>([...AGENTS]);
  const [permissions, setPermissions] = useState<AgentPermission[]>(SAFE_PERMISSIONS);
  const [status, setStatus] = useState<IntegrationProviderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const directWriteEnabled = permissions.includes('document.write') || permissions.includes('metadata.write');
  const canSave = enabledAgents.length > 0 && permissions.includes('document.suggest');

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void Promise.all([getIntegrationCatalog(), testIntegrationConnection('omi-agents')])
      .then(([catalog, nextStatus]) => {
        if (cancelled) return;
        const provider = catalog.find((item) => item.id === 'omi-agents');
        const connection = provider?.connections.find((item) => item.connectionKey === 'default');
        if (connection) {
          setEnabled(connection.enabled);
          const config = connection.config as StoredConfig | null;
          if (config) {
            const storedAgents = Array.isArray(config.enabledAgents)
              ? config.enabledAgents.filter((item): item is AgentId => typeof item === 'string' && AGENTS.includes(item as AgentId))
              : [];
            const storedPermissions = Array.isArray(config.permissions)
              ? config.permissions.filter(isAgentPermission)
              : [];
            if (storedAgents.length) setEnabledAgents(Array.from(new Set(storedAgents)));
            if (storedPermissions.length) setPermissions(Array.from(new Set(storedPermissions)));
            setReviewRequired(config.reviewRequired !== false);
          }
        }
        setStatus(nextStatus);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);

  const permissionRows = useMemo(() => ([
    ['document.read', copy.permissions.documentRead, false],
    ['document.suggest', copy.permissions.documentSuggest, false],
    ['metadata.read', copy.permissions.metadataRead, false],
    ['references.read', copy.permissions.referencesRead, false],
    ['metadata.write', copy.permissions.metadataWrite, true],
    ['document.write', copy.permissions.documentWrite, true],
  ] as const), [copy]);

  function toggleAgent(agentId: AgentId) {
    setEnabledAgents((current) => current.includes(agentId)
      ? current.filter((item) => item !== agentId)
      : [...current, agentId]);
  }

  function togglePermission(permission: AgentPermission) {
    if (permission === 'document.suggest') return;
    setPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  }

  async function saveAndTest() {
    if (!canSave) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveIntegrationConnection('omi-agents', {
        connectionKey: 'default',
        displayName: 'OMI Agents',
        authenticationMode: 'none',
        enabled,
        config: {
          version: 1,
          enabledAgents,
          permissions,
          reviewRequired,
        },
      });
      const nextStatus = await testIntegrationConnection('omi-agents');
      setStatus(nextStatus);
      setNotice(nextStatus.healthy ? copy.savedReady : nextStatus.message ?? copy.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function testOnly() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const nextStatus = await testIntegrationConnection('omi-agents');
      setStatus(nextStatus);
      setNotice(nextStatus.message ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="omi-agents-settings">
      <div className="omi-integrations-security-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>{copy.safetyTitle}</strong><p>{copy.safetyDescription}</p></div>
      </div>

      <label className="omi-agent-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span><strong>{copy.enableAgents}</strong><small>{copy.enableAgentsHelp}</small></span>
      </label>

      <div className="omi-agent-settings-section">
        <strong><Bot size={16} aria-hidden="true" /> {copy.agentsTitle}</strong>
        <p>{copy.agentsDescription}</p>
        <div className="omi-agent-settings-options">
          {AGENTS.map((agentId) => (
            <label key={agentId}>
              <input type="checkbox" checked={enabledAgents.includes(agentId)} onChange={() => toggleAgent(agentId)} />
              <span><strong>{copy.agents[agentId].title}</strong><small>{copy.agents[agentId].description}</small></span>
            </label>
          ))}
        </div>
      </div>

      <div className="omi-agent-settings-section">
        <strong>{copy.permissionsTitle}</strong>
        <p>{copy.permissionsDescription}</p>
        <div className="omi-agent-settings-options">
          {permissionRows.map(([permission, label, dangerous]) => (
            <label key={permission} className={dangerous ? 'omi-agent-permission--dangerous' : undefined}>
              <input
                type="checkbox"
                checked={permissions.includes(permission)}
                disabled={permission === 'document.suggest'}
                onChange={() => togglePermission(permission)}
              />
              <span><strong>{label}</strong>{dangerous ? <small>{copy.directWriteWarning}</small> : null}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="omi-agent-toggle">
        <input
          type="checkbox"
          checked={reviewRequired}
          disabled={!directWriteEnabled}
          onChange={(event) => setReviewRequired(event.target.checked)}
        />
        <span><strong>{copy.reviewEverySuggestion}</strong><small>{copy.reviewEverySuggestionHelp}</small></span>
      </label>

      {directWriteEnabled && !reviewRequired ? (
        <p className="omi-integration-error" role="alert">{copy.directWriteEnabledWarning}</p>
      ) : null}

      <div className="omi-integration-card__actions">
        <button type="button" className="studio-menu-primary-action" disabled={busy || !canSave} onClick={() => void saveAndTest()}>
          {busy ? copy.checking : copy.saveAndTest}
        </button>
        <button type="button" className="studio-menu-secondary-action" disabled={busy || !status?.configured} onClick={() => void testOnly()}>
          {copy.test}
        </button>
      </div>

      <dl>
        <div><dt>{copy.configured}</dt><dd>{status?.configured ? copy.yes : copy.no}</dd></div>
        <div><dt>{copy.health}</dt><dd>{status?.healthy === true ? copy.ready : status?.healthy === false ? copy.notReady : copy.unknown}</dd></div>
      </dl>
      {status?.message ? <p className="omi-integration-secret-note">{status.message}</p> : null}
      {notice ? <p>{notice}</p> : null}
      {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
    </div>
  );
}

function isAgentPermission(value: unknown): value is AgentPermission {
  return value === 'document.read'
    || value === 'document.suggest'
    || value === 'document.write'
    || value === 'metadata.read'
    || value === 'metadata.write'
    || value === 'references.read';
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    safetyTitle: 'Korlátozott jogosultságú ügynökök',
    safetyDescription: 'Az OMI Agents csak az itt engedélyezett műveleteket használhatja. Alapértelmezésben kizárólag ellenőrizhető javaslatot készít, a kéziratot nem módosítja közvetlenül.',
    enableAgents: 'OMI Agents engedélyezése', enableAgentsHelp: 'Az ügynökök külön kapcsolóval kikapcsolhatók anélkül, hogy a beállításaik elvesznének.',
    agentsTitle: 'Aktív ügynökök', agentsDescription: 'Válaszd ki, mely beépített asszisztensek használhatók.',
    agents: {
      'language-editor': { title: 'Nyelvi szerkesztő', description: 'Nyelvhelyességi és stilisztikai javaslatok.' },
      'metadata-assistant': { title: 'Metaadat-asszisztens', description: 'Cím, absztrakt, kulcsszavak és más metaadatok ellenőrzése.' },
      summarizer: { title: 'Összefoglaló', description: 'Szakasz- vagy kéziratszintű összegzés.' },
      'citation-checker': { title: 'Hivatkozás-ellenőrző', description: 'Idézések és bibliográfiai kapcsolatok vizsgálata.' },
    },
    permissionsTitle: 'Jogosultságok', permissionsDescription: 'A minimálisan szükséges jogosultságokat add meg. A közvetlen írás külön, emelt jogosultság.',
    permissions: { documentRead: 'Kézirat olvasása', documentSuggest: 'Javaslat létrehozása', metadataRead: 'Metaadatok olvasása', referencesRead: 'Hivatkozások olvasása', metadataWrite: 'Metaadatok közvetlen módosítása', documentWrite: 'Kézirat közvetlen módosítása' },
    directWriteWarning: 'Emelt jogosultság: csak kifejezett felhasználói megerősítéssel használható.',
    reviewEverySuggestion: 'Minden javaslat kézi jóváhagyást igényel', reviewEverySuggestionHelp: 'Ajánlott. Bekapcsolva a közvetlen írási jogosultságok sem hajthatók végre automatikusan.',
    directWriteEnabledWarning: 'A közvetlen írás engedélyezve van és a kötelező kézi ellenőrzés ki van kapcsolva. Ezt csak tudatosan használd.',
    saveAndTest: 'Mentés és tesztelés', test: 'Teszt', checking: 'Ellenőrzés…', configured: 'Konfigurálva', health: 'Állapot', yes: 'Igen', no: 'Nem', ready: 'Használatra kész', notReady: 'Nem kész', unknown: 'Ismeretlen', savedReady: 'Az OMI Agents beállítása mentve és használatra kész.', saved: 'A beállítás mentve.',
  };
  if (locale === 'de') return {
    safetyTitle: 'Agenten mit begrenzten Rechten', safetyDescription: 'OMI Agents dürfen nur die hier gewährten Aktionen verwenden. Standardmäßig erzeugen sie nur überprüfbare Vorschläge und ändern das Manuskript nicht direkt.',
    enableAgents: 'OMI Agents aktivieren', enableAgentsHelp: 'Agenten können ausgeschaltet werden, ohne ihre Einstellungen zu verlieren.',
    agentsTitle: 'Aktive Agenten', agentsDescription: 'Wählen Sie die verfügbaren integrierten Assistenten.',
    agents: {
      'language-editor': { title: 'Sprachredaktion', description: 'Sprachliche und stilistische Vorschläge.' },
      'metadata-assistant': { title: 'Metadaten-Assistent', description: 'Prüfung von Titel, Abstract, Schlagwörtern und weiteren Metadaten.' },
      summarizer: { title: 'Zusammenfassung', description: 'Zusammenfassungen für Abschnitt oder Manuskript.' },
      'citation-checker': { title: 'Zitationsprüfung', description: 'Prüfung von Zitaten und bibliografischen Beziehungen.' },
    },
    permissionsTitle: 'Berechtigungen', permissionsDescription: 'Gewähren Sie nur die erforderlichen Rechte. Direkter Schreibzugriff ist eine erhöhte Berechtigung.',
    permissions: { documentRead: 'Manuskript lesen', documentSuggest: 'Vorschläge erstellen', metadataRead: 'Metadaten lesen', referencesRead: 'Literaturangaben lesen', metadataWrite: 'Metadaten direkt ändern', documentWrite: 'Manuskript direkt ändern' },
    directWriteWarning: 'Erhöhte Berechtigung; nur mit ausdrücklicher Bestätigung verwenden.', reviewEverySuggestion: 'Jeden Vorschlag manuell prüfen', reviewEverySuggestionHelp: 'Empfohlen. Direkte Schreibrechte werden nicht automatisch ausgeführt.', directWriteEnabledWarning: 'Direktes Schreiben ist erlaubt und die verpflichtende Prüfung ist deaktiviert.',
    saveAndTest: 'Speichern und testen', test: 'Testen', checking: 'Prüfung…', configured: 'Konfiguriert', health: 'Status', yes: 'Ja', no: 'Nein', ready: 'Bereit', notReady: 'Nicht bereit', unknown: 'Unbekannt', savedReady: 'OMI Agents wurden gespeichert und sind einsatzbereit.', saved: 'Einstellung gespeichert.',
  };
  return {
    safetyTitle: 'Scoped agent permissions', safetyDescription: 'OMI Agents may use only the actions granted here. By default they produce reviewable suggestions and never modify the manuscript directly.',
    enableAgents: 'Enable OMI Agents', enableAgentsHelp: 'Agents can be disabled without losing their saved configuration.',
    agentsTitle: 'Active agents', agentsDescription: 'Choose which built-in assistants may be used.',
    agents: {
      'language-editor': { title: 'Language editor', description: 'Language and style suggestions.' },
      'metadata-assistant': { title: 'Metadata assistant', description: 'Review title, abstract, keywords, and other metadata.' },
      summarizer: { title: 'Summarizer', description: 'Section- or manuscript-level summaries.' },
      'citation-checker': { title: 'Citation checker', description: 'Review citations and bibliographic relationships.' },
    },
    permissionsTitle: 'Permissions', permissionsDescription: 'Grant only the permissions required. Direct write access is an elevated permission.',
    permissions: { documentRead: 'Read manuscript', documentSuggest: 'Create suggestions', metadataRead: 'Read metadata', referencesRead: 'Read references', metadataWrite: 'Modify metadata directly', documentWrite: 'Modify manuscript directly' },
    directWriteWarning: 'Elevated permission; usable only with explicit confirmation.', reviewEverySuggestion: 'Require manual review for every suggestion', reviewEverySuggestionHelp: 'Recommended. When enabled, direct-write permissions cannot execute automatically.', directWriteEnabledWarning: 'Direct write is enabled and mandatory manual review is disabled.',
    saveAndTest: 'Save and test', test: 'Test', checking: 'Checking…', configured: 'Configured', health: 'Status', yes: 'Yes', no: 'No', ready: 'Ready', notReady: 'Not ready', unknown: 'Unknown', savedReady: 'OMI Agents configuration was saved and is ready.', saved: 'Setting saved.',
  };
}
