import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  isVerifiedPublicationVenue,
  type OmiPublicationVenueReference,
  type OmiPublicationVenueType,
} from '../model/scholarlyMetadata';
import {
  createPublicationVenue,
  getPublicationVenues,
  type CreatePublicationVenueInput,
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
    if (!createConnectionId) {
      setError(copy.connectionRequired);
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
                {venue.integrationProvider ? ' (' + venue.integrationProvider + ')' : ''}
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
          {connectionsLoading ? <small aria-live="polite">{copy.loading}</small> : null}
          {!connectionsLoading && !availablePublishingConnections.length ? (
            <small className="studio-publication-venue-error" role="alert">
              {copy.noConnections}
            </small>
          ) : null}
          <div className="studio-publication-venue-create-actions">
            <button
              type="submit"
              className="studio-menu-primary-action"
              disabled={saving || !createConnectionId || !availablePublishingConnections.length}
            >
              {copy.save}
            </button>
            <button type="button" className="studio-menu-secondary-action" disabled={saving} onClick={closeCreateForm}>
              {copy.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
