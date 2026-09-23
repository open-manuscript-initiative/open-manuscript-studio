import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  isVerifiedPublicationVenue,
  type OmiPublicationVenueReference,
  type OmiPublicationVenueType,
} from '../model/scholarlyMetadata';
import {
  createPublicationVenue,
  createPublicationVenueDomainClaim,
  getPublicationVenueAuthority,
  getPublicationVenues,
  grantPublicationVenueEditor,
  revokePublicationVenueEditor,
  verifyPublicationVenueDomainClaim,
  type CreatePublicationVenueInput,
  type PublicationVenueAuthorityOverview,
  type PublicationVenueDomainChallenge,
} from '../services/publicationVenueApi';
import {
  getIntegrationCatalog,
  type IntegrationConnection,
} from '../services/integrationApi';
import { useTranslation } from '../i18n';

const LABELS = {
  en: {
    label: 'Journal or book publisher',
    hint: 'Shared list for all signed-in Studio users.',
    kind: 'Type',
    selection: 'Select from shared list',
    journal: 'Journal',
    bookPublisher: 'Book publisher',
    none: 'Not selected',
    search: 'Filter shared list',
    searchPlaceholder: 'Search by name',
    loading: 'Loading…',
    loadFailed: 'The shared list could not be loaded.',
    add: 'Add a new journal or publisher',
    addTitle: 'Register a journal or book publisher',
    name: 'Name',
    website: 'Website',
    issn: 'ISSN',
    isbnPrefix: 'ISBN prefix',
    save: 'Save and select',
    cancel: 'Cancel',
    required: 'Enter a name first.',
    saveFailed: 'The new entry could not be saved.',
    integration: 'Verified publishing connection',
    chooseIntegration: 'Select an active OJS/OMP connection',
    noConnections: 'No active publishing connection is available. Configure and test an OJS or OMP connection in Integrations first.',
    connectionRequired: 'Select an active publishing connection first.',
    verificationMethod: 'Verification method',
    viaIntegration: 'OJS / OMP integration',
    viaDns: 'DNS TXT domain verification',
    domain: 'Journal / publisher domain',
    domainPlaceholder: 'journal.example.org',
    dnsHelp: 'Studio will create a one-time TXT challenge. Domain control verifies the publication venue; it does not by itself prove peer review.',
    dnsChallenge: 'Add this DNS TXT record, then verify it in Studio.',
    dnsRecordName: 'TXT name',
    dnsRecordValue: 'TXT value',
    verifyDns: 'Verify DNS',
    dnsVerified: 'Domain verified. You are now the domain administrator for this publication venue.',
    authorityTitle: 'Publication venue authority',
    currentRole: 'Your venue role',
    editorEmail: 'Editor Studio e-mail',
    editorRole: 'Editor role',
    editor: 'Editor',
    editorInChief: 'Editor-in-chief',
    addEditor: 'Authorize editor',
    revokeEditor: 'Revoke',
    noEditors: 'No editors have been authorized yet.',
    authorityLoading: 'Loading publication venue authority…',
  },
  hu: {
    label: 'Folyóirat vagy könyvkiadó',
    hint: 'A lista minden bejelentkezett Studio-felhasználóval közös.',
    kind: 'Típus',
    selection: 'Kiválasztás a közös listából',
    journal: 'Folyóirat',
    bookPublisher: 'Könyvkiadó',
    none: 'Nincs kiválasztva',
    search: 'Közös lista szűrése',
    searchPlaceholder: 'Keresés név alapján',
    loading: 'Betöltés…',
    loadFailed: 'A közös lista nem tölthető be.',
    add: 'Új folyóirat vagy kiadó hozzáadása',
    addTitle: 'Folyóirat vagy könyvkiadó regisztrálása',
    name: 'Név',
    website: 'Weboldal',
    issn: 'ISSN',
    isbnPrefix: 'ISBN-előtag',
    save: 'Mentés és kiválasztás',
    cancel: 'Mégse',
    required: 'Előbb add meg a nevet.',
    saveFailed: 'Az új bejegyzés nem menthető.',
    integration: 'Ellenőrzött kiadói kapcsolat',
    chooseIntegration: 'Válassz aktív OJS/OMP-kapcsolatot',
    noConnections: 'Nincs aktív kiadói kapcsolat. Előbb állíts be és tesztelj egy OJS- vagy OMP-kapcsolatot az Integrációk menüben.',
    connectionRequired: 'Előbb válassz aktív kiadói kapcsolatot.',
    verificationMethod: 'Hitelesítés módja',
    viaIntegration: 'OJS / OMP integráció',
    viaDns: 'DNS TXT domainhitelesítés',
    domain: 'A folyóirat / kiadó domainje',
    domainPlaceholder: 'folyoirat.hu',
    dnsHelp: 'A Studio egyszer használatos TXT-kihívást hoz létre. A domain feletti rendelkezés a folyóiratot/kiadót hitelesíti; önmagában nem bizonyít lektorálást.',
    dnsChallenge: 'Add hozzá ezt a DNS TXT rekordot, majd ellenőrizd a Studioban.',
    dnsRecordName: 'TXT név',
    dnsRecordValue: 'TXT érték',
    verifyDns: 'DNS ellenőrzése',
    dnsVerified: 'A domain hitelesítve. Mostantól te vagy ennek a publikációs helynek a domain-adminisztrátora.',
    authorityTitle: 'Folyóirati / kiadói autoritás',
    currentRole: 'Saját szerepköröd',
    editorEmail: 'Szerkesztő Studio e-mail-címe',
    editorRole: 'Szerkesztői szerepkör',
    editor: 'Szerkesztő',
    editorInChief: 'Főszerkesztő',
    addEditor: 'Szerkesztő felhatalmazása',
    revokeEditor: 'Visszavonás',
    noEditors: 'Még nincs felhatalmazott szerkesztő.',
    authorityLoading: 'A folyóirati autoritás betöltése…',
  },
  de: {
    label: 'Zeitschrift oder Buchverlag',
    hint: 'Gemeinsame Liste für alle angemeldeten Studio-Nutzer.',
    kind: 'Typ',
    selection: 'Aus gemeinsamer Liste auswählen',
    journal: 'Zeitschrift',
    bookPublisher: 'Buchverlag',
    none: 'Nicht ausgewählt',
    search: 'Gemeinsame Liste filtern',
    searchPlaceholder: 'Nach Namen suchen',
    loading: 'Wird geladen…',
    loadFailed: 'Die gemeinsame Liste konnte nicht geladen werden.',
    add: 'Neue Zeitschrift oder Verlag hinzufügen',
    addTitle: 'Zeitschrift oder Buchverlag registrieren',
    name: 'Name',
    website: 'Webseite',
    issn: 'ISSN',
    isbnPrefix: 'ISBN-Präfix',
    save: 'Speichern und auswählen',
    cancel: 'Abbrechen',
    required: 'Bitte zuerst einen Namen eingeben.',
    saveFailed: 'Der neue Eintrag konnte nicht gespeichert werden.',
    integration: 'Verifizierte Verlagsverbindung',
    chooseIntegration: 'Aktive OJS/OMP-Verbindung auswählen',
    noConnections: 'Keine aktive Verlagsverbindung verfügbar. Zuerst eine OJS- oder OMP-Verbindung unter Integrationen konfigurieren und testen.',
    connectionRequired: 'Bitte zuerst eine aktive Verlagsverbindung auswählen.',
    verificationMethod: 'Verifizierungsmethode',
    viaIntegration: 'OJS-/OMP-Integration',
    viaDns: 'DNS-TXT-Domainverifizierung',
    domain: 'Domain der Zeitschrift / des Verlags',
    domainPlaceholder: 'zeitschrift.example.org',
    dnsHelp: 'Studio erzeugt eine einmalige TXT-Challenge. Die Domainkontrolle verifiziert die Publikationsstelle; sie beweist für sich allein kein Peer Review.',
    dnsChallenge: 'Fügen Sie diesen DNS-TXT-Eintrag hinzu und prüfen Sie ihn anschließend in Studio.',
    dnsRecordName: 'TXT-Name',
    dnsRecordValue: 'TXT-Wert',
    verifyDns: 'DNS prüfen',
    dnsVerified: 'Domain verifiziert. Sie sind jetzt Domain-Administrator dieser Publikationsstelle.',
    authorityTitle: 'Autorität der Publikationsstelle',
    currentRole: 'Ihre Rolle',
    editorEmail: 'Studio-E-Mail der Redaktion',
    editorRole: 'Redaktionelle Rolle',
    editor: 'Redakteur/in',
    editorInChief: 'Chefredakteur/in',
    addEditor: 'Redaktion autorisieren',
    revokeEditor: 'Widerrufen',
    noEditors: 'Noch keine Redaktionsmitglieder autorisiert.',
    authorityLoading: 'Autorität der Publikationsstelle wird geladen…',
  },
} as const;

function publishingProviderId(type: OmiPublicationVenueType): 'ojs' | 'omp' {
  return type === 'JOURNAL' ? 'ojs' : 'omp';
}

function publishingConnectionLabel(connection: IntegrationConnection): string {
  const configuredBaseUrl = connection.config
    && typeof connection.config.baseUrl === 'string'
    ? connection.config.baseUrl.trim()
    : '';
  return connection.displayName?.trim() || configuredBaseUrl || connection.connectionKey;
}

export function PublicationVenueField({
  value,
  onChange,
}: {
  value?: OmiPublicationVenueReference;
  onChange: (value: OmiPublicationVenueReference | undefined) => void;
}) {
  const { locale: interfaceLocale } = useTranslation();
  const copy = LABELS[interfaceLocale as keyof typeof LABELS] ?? LABELS.en;
  const [venueType, setVenueType] = useState<OmiPublicationVenueType>(
    value?.type ?? 'JOURNAL',
  );
  const [venues, setVenues] = useState<OmiPublicationVenueReference[]>([]);
  const [publishingConnections, setPublishingConnections] = useState<IntegrationConnection[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<OmiPublicationVenueType>(
    value?.type ?? 'JOURNAL',
  );
  const [createConnectionId, setCreateConnectionId] = useState('');
  const [verificationMethod, setVerificationMethod] =
    useState<'integration' | 'dns'>('integration');
  const [createDomain, setCreateDomain] = useState('');
  const [domainChallenge, setDomainChallenge] =
    useState<PublicationVenueDomainChallenge | null>(null);
  const [authorityOverview, setAuthorityOverview] =
    useState<PublicationVenueAuthorityOverview | null>(null);
  const [authorityLoading, setAuthorityLoading] = useState(false);
  const [editorEmail, setEditorEmail] = useState('');
  const [editorRole, setEditorRole] =
    useState<'EDITOR' | 'EDITOR_IN_CHIEF'>('EDITOR');
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createWebsite, setCreateWebsite] = useState('');
  const [createIssn, setCreateIssn] = useState('');
  const [createIsbnPrefix, setCreateIsbnPrefix] = useState('');
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (value?.type && value.type !== venueType) setVenueType(value.type);
  }, [value?.type, venueType]);

  useEffect(() => {
    if (!createOpen) return;
    let active = true;
    setConnectionsLoading(true);
    void getIntegrationCatalog()
      .then((catalog) => {
        if (!active) return;
        const connections = catalog
          .filter((provider) => provider.id === 'ojs' || provider.id === 'omp')
          .flatMap((provider) => provider.connections)
          .filter((connection) =>
            connection.enabled && connection.status.toLowerCase() === 'connected',
          );
        setPublishingConnections(connections);
      })
      .catch(() => {
        if (active) setPublishingConnections([]);
      })
      .finally(() => {
        if (active) setConnectionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [createOpen]);

  useEffect(() => {
    let active = true;
    const venueId = value?.authority?.method === 'DNS_TXT' ? value.id : undefined;
    if (!venueId) {
      setAuthorityOverview(null);
      return () => {
        active = false;
      };
    }
    setAuthorityLoading(true);
    void getPublicationVenueAuthority(venueId)
      .then((overview) => {
        if (active) setAuthorityOverview(overview);
      })
      .catch(() => {
        if (active) setAuthorityOverview(null);
      })
      .finally(() => {
        if (active) setAuthorityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [value?.authority?.method, value?.id]);

  useEffect(() => {
    const currentRequestId = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void getPublicationVenues(venueType)
        .then((nextVenues) => {
          if (currentRequestId !== requestId.current) return;
          setVenues(nextVenues);
        })
        .catch(() => {
          if (currentRequestId !== requestId.current) return;
          setError(copy.loadFailed);
        })
        .finally(() => {
          if (currentRequestId === requestId.current) setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [copy.loadFailed, venueType]);

  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const verifiedVenues = venues.filter((venue) =>
      venue.type === venueType && isVerifiedPublicationVenue(venue),
    );
    const filtered = verifiedVenues.filter((venue) =>
      !normalizedQuery
      || venue.name.toLocaleLowerCase().includes(normalizedQuery),
    );
    const selected = isVerifiedPublicationVenue(value) && value?.type === venueType
      ? verifiedVenues.find((venue) => venue.id === value.id)
      : undefined;
    if (selected && !filtered.some((venue) => venue.id === selected.id)) {
      return [selected, ...filtered];
    }
    return filtered;
  }, [query, value, venues, venueType]);

  const availablePublishingConnections = useMemo(
    () => publishingConnections.filter((connection) =>
      connection.providerId === publishingProviderId(createType)
      && connection.enabled
      && connection.status.toLowerCase() === 'connected',
    ),
    [createType, publishingConnections],
  );

  function handleTypeChange(nextType: OmiPublicationVenueType): void {
    setVenueType(nextType);
    setQuery('');
    if (value && value.type !== nextType) onChange(undefined);
  }

  function openCreateForm(): void {
    setCreateType(venueType);
    setCreateConnectionId('');
    setVerificationMethod('integration');
    setCreateDomain('');
    setDomainChallenge(null);
    setPublishingConnections([]);
    setConnectionsLoading(false);
    setCreateName('');
    setCreateWebsite('');
    setCreateIssn('');
    setCreateIsbnPrefix('');
    setError('');
    setCreateOpen(true);
  }

  function closeCreateForm(): void {
    if (saving) return;
    setCreateOpen(false);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!createName.trim()) {
      setError(copy.required);
      return;
    }
    if (verificationMethod === 'integration' && !createConnectionId) {
      setError(copy.connectionRequired);
      return;
    }
    if (verificationMethod === 'dns' && !createDomain.trim()) {
      setError(copy.domain + ' is required.');
      return;
    }

    const input: CreatePublicationVenueInput = {
      type: createType,
      name: createName.trim(),
      ...(createWebsite.trim() ? { website: createWebsite.trim() } : {}),
      ...(createType === 'JOURNAL' && createIssn.trim()
        ? { issn: createIssn.trim() }
        : {}),
      ...(createType === 'BOOK_PUBLISHER' && createIsbnPrefix.trim()
        ? { isbnPrefix: createIsbnPrefix.trim() }
        : {}),
      integrationConnectionId: createConnectionId,
    };

    setSaving(true);
    setError('');
    try {
      if (verificationMethod === 'dns') {
        const result = await createPublicationVenueDomainClaim({
          type: createType,
          name: createName.trim(),
          domain: createDomain.trim(),
          ...(createWebsite.trim() ? { website: createWebsite.trim() } : {}),
          ...(createType === 'JOURNAL' && createIssn.trim()
            ? { issn: createIssn.trim() }
            : {}),
          ...(createType === 'BOOK_PUBLISHER' && createIsbnPrefix.trim()
            ? { isbnPrefix: createIsbnPrefix.trim() }
            : {}),
        });
        setDomainChallenge(result.challenge);
        setVenueType(result.venue.type);
        return;
      }

      const venue = await createPublicationVenue(input);
      setVenueType(venue.type);
      setQuery('');
      setVenues((current) => [
        venue,
        ...current.filter((candidate) => candidate.id !== venue.id),
      ]);
      onChange(venue);
      setCreateOpen(false);
      setCreateName('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function verifyDnsChallenge(): Promise<void> {
    if (!domainChallenge) return;
    setSaving(true);
    setError('');
    try {
      const venue = await verifyPublicationVenueDomainClaim(domainChallenge.claimId);
      setVenues((current) => [
        venue,
        ...current.filter((candidate) => candidate.id !== venue.id),
      ]);
      onChange(venue);
      setVenueType(venue.type);
      setDomainChallenge(null);
      setCreateOpen(false);
      setCreateName('');
      const overview = await getPublicationVenueAuthority(venue.id);
      setAuthorityOverview(overview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function authorizeEditor(): Promise<void> {
    if (!value || !editorEmail.trim()) return;
    setSaving(true);
    setError('');
    try {
      await grantPublicationVenueEditor(value.id, {
        email: editorEmail.trim(),
        role: editorRole,
      });
      setEditorEmail('');
      setAuthorityOverview(await getPublicationVenueAuthority(value.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function revokeEditorMembership(membershipId: string): Promise<void> {
    if (!value) return;
    setSaving(true);
    setError('');
    try {
      await revokePublicationVenueEditor(value.id, membershipId);
      setAuthorityOverview(await getPublicationVenueAuthority(value.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="studio-metadata-field studio-metadata-field--wide studio-publication-venue-field">
      <span>{copy.label}</span>
      <small>{copy.hint}</small>
      <div className="studio-publication-venue-controls">
        <label>
          <span>{copy.kind}</span>
          <select
            value={venueType}
            aria-label={copy.kind}
            onChange={(event) => handleTypeChange(event.target.value as OmiPublicationVenueType)}
          >
            <option value="JOURNAL">{copy.journal}</option>
            <option value="BOOK_PUBLISHER">{copy.bookPublisher}</option>
          </select>
        </label>
        <label>
          <span>{copy.search}</span>
          <input
            type="search"
            value={query}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>{copy.selection}</span>
          <select
            value={
              value?.type === venueType && options.some((venue) => venue.id === value.id)
                ? value.id
                : ''
            }
            aria-label={copy.selection}
            onChange={(event) => {
              const selected = options.find((venue) => venue.id === event.target.value);
              onChange(selected);
            }}
          >
            <option value="">{copy.none}</option>
            {options.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
                {venue.authority?.method ? ' (' + venue.authority.method + ')' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="studio-publication-venue-add"
          onClick={openCreateForm}
        >
          + {copy.add}
        </button>
      </div>
      {loading ? <small aria-live="polite">{copy.loading}</small> : null}
      {error ? <small className="studio-publication-venue-error" role="alert">{error}</small> : null}

      {createOpen ? (
        <form className="studio-publication-venue-create" onSubmit={(event) => void submitCreate(event)}>
          <strong>{copy.addTitle}</strong>
          <div className="studio-publication-venue-create-grid">
            <label>
              <span>{copy.verificationMethod}</span>
              <select
                value={verificationMethod}
                onChange={(event) => {
                  setVerificationMethod(event.target.value as 'integration' | 'dns');
                  setDomainChallenge(null);
                  setError('');
                }}
              >
                <option value="integration">{copy.viaIntegration}</option>
                <option value="dns">{copy.viaDns}</option>
              </select>
            </label>
            {verificationMethod === 'integration' ? (
              <label>
                <span>{copy.integration}</span>
                <select
                  required
                  value={createConnectionId}
                  disabled={!availablePublishingConnections.length}
                  onChange={(event) => setCreateConnectionId(event.target.value)}
                >
                  <option value="">{copy.chooseIntegration}</option>
                  {availablePublishingConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {publishingConnectionLabel(connection)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                <span>{copy.domain}</span>
                <input
                  type="text"
                  required
                  maxLength={253}
                  value={createDomain}
                  placeholder={copy.domainPlaceholder}
                  onChange={(event) => setCreateDomain(event.target.value)}
                />
                <small>{copy.dnsHelp}</small>
              </label>
            )}
            <label>
              <span>{copy.kind}</span>
              <select
                value={createType}
                onChange={(event) => {
                  setCreateType(event.target.value as OmiPublicationVenueType);
                  setCreateConnectionId('');
                }}
              >
                <option value="JOURNAL">{copy.journal}</option>
                <option value="BOOK_PUBLISHER">{copy.bookPublisher}</option>
              </select>
            </label>
            <label>
              <span>{copy.name}</span>
              <input
                type="text"
                required
                maxLength={300}
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </label>
            <label>
              <span>{copy.website}</span>
              <input
                type="url"
                maxLength={2048}
                value={createWebsite}
                onChange={(event) => setCreateWebsite(event.target.value)}
              />
            </label>
            {createType === 'JOURNAL' ? (
              <label>
                <span>{copy.issn}</span>
                <input
                  type="text"
                  maxLength={32}
                  value={createIssn}
                  onChange={(event) => setCreateIssn(event.target.value)}
                />
              </label>
            ) : (
              <label>
                <span>{copy.isbnPrefix}</span>
                <input
                  type="text"
                  maxLength={64}
                  value={createIsbnPrefix}
                  onChange={(event) => setCreateIsbnPrefix(event.target.value)}
                />
              </label>
            )}
          </div>
          {verificationMethod === 'integration' && connectionsLoading
            ? <small aria-live="polite">{copy.loading}</small>
            : null}
          {verificationMethod === 'integration' &&
          !connectionsLoading && !availablePublishingConnections.length ? (
            <small className="studio-publication-venue-error" role="alert">
              {copy.noConnections}
            </small>
          ) : null}
          <div className="studio-publication-venue-create-actions">
            <button
              type="submit"
              className="studio-menu-primary-action"
              disabled={
                saving ||
                (verificationMethod === 'integration'
                  ? !createConnectionId || !availablePublishingConnections.length
                  : !createDomain.trim())
              }
            >
              {copy.save}
            </button>
            <button type="button" className="studio-menu-secondary-action" disabled={saving} onClick={closeCreateForm}>
              {copy.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {domainChallenge ? (
        <div className="studio-publication-venue-create" role="status">
          <strong>{copy.dnsChallenge}</strong>
          <p>
            {copy.dnsRecordName}: <code>{domainChallenge.txtName}</code>
          </p>
          <p>
            {copy.dnsRecordValue}: <code>{domainChallenge.txtValue}</code>
          </p>
          <button
            type="button"
            className="studio-menu-primary-action"
            disabled={saving}
            onClick={() => void verifyDnsChallenge()}
          >
            {copy.verifyDns}
          </button>
        </div>
      ) : null}

      {value?.authority?.method === 'DNS_TXT' ? (
        <div className="studio-publication-venue-create">
          <strong>{copy.authorityTitle}</strong>
          {authorityLoading ? (
            <small aria-live="polite">{copy.authorityLoading}</small>
          ) : authorityOverview ? (
            <>
              {authorityOverview.currentMemberships.length ? (
                <p>
                  {copy.currentRole}:{' '}
                  <strong>
                    {authorityOverview.currentMemberships
                      .map((membership) => membership.role)
                      .join(', ')}
                  </strong>
                </p>
              ) : null}
              {authorityOverview.canManageEditors ? (
                <>
                  <div className="studio-publication-venue-create-grid">
                    <label>
                      <span>{copy.editorEmail}</span>
                      <input
                        type="email"
                        value={editorEmail}
                        onChange={(event) => setEditorEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{copy.editorRole}</span>
                      <select
                        value={editorRole}
                        onChange={(event) =>
                          setEditorRole(event.target.value as 'EDITOR' | 'EDITOR_IN_CHIEF')}
                      >
                        <option value="EDITOR">{copy.editor}</option>
                        <option value="EDITOR_IN_CHIEF">{copy.editorInChief}</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="studio-menu-secondary-action"
                    disabled={saving || !editorEmail.trim()}
                    onClick={() => void authorizeEditor()}
                  >
                    {copy.addEditor}
                  </button>
                  {authorityOverview.members.filter((member) =>
                    member.role === 'EDITOR' || member.role === 'EDITOR_IN_CHIEF'
                  ).length ? (
                    <ul>
                      {authorityOverview.members
                        .filter((member) =>
                          member.role === 'EDITOR' || member.role === 'EDITOR_IN_CHIEF'
                        )
                        .map((member) => (
                          <li key={member.id}>
                            {member.user.fullName} · {member.user.email} · {member.role}{' '}
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void revokeEditorMembership(member.id)}
                            >
                              {copy.revokeEditor}
                            </button>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <small>{copy.noEditors}</small>
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
