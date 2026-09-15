import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type {
  OmiPublicationVenueReference,
  OmiPublicationVenueType,
} from '../model/scholarlyMetadata';
import {
  createPublicationVenue,
  getPublicationVenues,
  type CreatePublicationVenueInput,
} from '../services/publicationVenueApi';
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
  },
} as const;

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
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<OmiPublicationVenueType>(
    value?.type ?? 'JOURNAL',
  );
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
    const currentRequestId = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void getPublicationVenues(venueType, query)
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
    }, query.trim() ? 250 : 0);

    return () => window.clearTimeout(timer);
  }, [copy.loadFailed, query, venueType]);

  const options = useMemo(() => {
    const byId = new Map<string, OmiPublicationVenueReference>();
    if (value && value.type === venueType) byId.set(value.id, value);
    venues.forEach((venue) => byId.set(venue.id, venue));
    return [...byId.values()];
  }, [value, venues, venueType]);

  function handleTypeChange(nextType: OmiPublicationVenueType): void {
    setVenueType(nextType);
    setQuery('');
    if (value && value.type !== nextType) onChange(undefined);
  }

  function openCreateForm(): void {
    setCreateType(venueType);
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
    } catch {
      setError(copy.saveFailed);
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
            value={value?.type === venueType ? value.id : ''}
            aria-label={copy.selection}
            onChange={(event) => {
              const selected = options.find((venue) => venue.id === event.target.value);
              onChange(selected);
            }}
          >
            <option value="">{copy.none}</option>
            {options.map((venue) => (
              <option key={venue.id} value={venue.id}>{venue.name}</option>
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
              <span>{copy.kind}</span>
              <select
                value={createType}
                onChange={(event) => setCreateType(event.target.value as OmiPublicationVenueType)}
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
          <div className="studio-publication-venue-create-actions">
            <button type="submit" className="studio-menu-primary-action" disabled={saving}>
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
