import {
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getOrcidLookupCopy } from '../i18n/orcidLookup';
import { isValidOrcid } from '../model/identity';
import {
  searchOrcidRegistry,
  type OrcidSuggestion,
} from '../services/orcidLookup';

interface OrcidLookupFieldProps {
  agentId: string;
  givenName: string;
  familyName: string;
  affiliation: string;
  rorId: string;
  orcid: string;
  label: string;
  invalidMessage: string;
}

const SEARCH_DELAY_MS = 350;

export function OrcidLookupField({
  agentId,
  givenName,
  familyName,
  affiliation,
  rorId,
  orcid,
  label,
  invalidMessage,
}: OrcidLookupFieldProps) {
  const { locale } = useTranslation();
  const copy = getOrcidLookupCopy(locale);
  const updateContributor = useStudioStore((state) => state.updateContributor);
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<OrcidSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);

  const searchableName = `${givenName} ${familyName}`.trim();
  const canSearch = familyName.trim().length >= 2 || searchableName.length >= 4;
  const orcidIsValid = isValidOrcid(orcid);
  const publicSearchUrl = useMemo(() => {
    const url = new URL('https://orcid.org/orcid-search/search');
    url.searchParams.set('searchQuery', searchableName || affiliation);
    return url.toString();
  }, [affiliation, searchableName]);

  useEffect(() => {
    if (!hasFocus || orcid.trim() || !canSearch) {
      setSuggestions([]);
      setIsLoading(false);
      setHasSearched(false);
      setSearchError(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setSearchError(false);

      void searchOrcidRegistry(
        {
          givenName,
          familyName,
          affiliation,
          rorId,
        },
        { signal: controller.signal },
      )
        .then((results) => {
          setSuggestions(results);
          setHasSearched(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setSuggestions([]);
          setHasSearched(true);
          setSearchError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [affiliation, canSearch, familyName, givenName, hasFocus, orcid, rorId]);

  function changeOrcid(value: string): void {
    updateContributor(agentId, { orcid: value });
    setSuggestions([]);
    setHasSearched(false);
    setSearchError(false);
  }

  function selectOrcid(suggestion: OrcidSuggestion): void {
    updateContributor(agentId, { orcid: suggestion.orcid });
    setSuggestions([]);
    setHasSearched(false);
    setSearchError(false);
  }

  const showDropdown =
    hasFocus &&
    !orcid.trim() &&
    canSearch &&
    (isLoading || hasSearched || suggestions.length > 0);

  return (
    <div className="contributor-wide-field orcid-lookup-field">
      <label htmlFor={`${listboxId}-input`}>
        <span>{label}</span>
      </label>

      <div className="orcid-lookup-input-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          value={orcid}
          aria-invalid={!orcidIsValid}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showDropdown}
          aria-describedby={!orcidIsValid ? `${listboxId}-error` : undefined}
          placeholder="0000-0000-0000-0000"
          onFocus={() => setHasFocus(true)}
          onBlur={() => setHasFocus(false)}
          onChange={(event) => changeOrcid(event.target.value)}
        />
      </div>

      {!orcidIsValid ? (
        <small className="field-error" id={`${listboxId}-error`}>
          {invalidMessage}
        </small>
      ) : null}

      {orcid && orcidIsValid ? (
        <div className="orcid-lookup-linked">
          <span>{copy.selected}</span>
          <a
            href={`https://orcid.org/${orcid}`}
            target="_blank"
            rel="noopener noreferrer"
            title={copy.openProfile}
          >
            {orcid}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <small>{copy.notAuthenticated}</small>
        </div>
      ) : null}

      {showDropdown ? (
        <div className="orcid-lookup-popover">
          {isLoading ? (
            <div className="orcid-lookup-status" aria-live="polite">
              {copy.searching}
            </div>
          ) : null}

          {!isLoading && searchError ? (
            <div className="orcid-lookup-status orcid-lookup-status--error">
              {copy.unavailable}
            </div>
          ) : null}

          {!isLoading && !searchError && hasSearched && suggestions.length === 0 ? (
            <div className="orcid-lookup-status">{copy.noResults}</div>
          ) : null}

          {!isLoading && suggestions.length > 0 ? (
            <div
              id={listboxId}
              className="orcid-lookup-results"
              role="listbox"
              aria-label={copy.suggestions}
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.orcid}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="orcid-lookup-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOrcid(suggestion)}
                >
                  <span className="orcid-lookup-result-main">
                    <strong>{displayName(suggestion)}</strong>
                    <small>{displayInstitution(suggestion)}</small>
                  </span>
                  <span className="orcid-lookup-result-id">{suggestion.orcid}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="orcid-lookup-footer">
            <span>{copy.poweredBy}</span>
            <a href={publicSearchUrl} target="_blank" rel="noopener noreferrer">
              ORCID
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}

      {!orcid && !hasFocus ? (
        <small className="orcid-lookup-hint">{copy.manualEntry}</small>
      ) : null}
    </div>
  );
}

function displayName(suggestion: OrcidSuggestion): string {
  return (
    suggestion.creditName ||
    [suggestion.givenName, suggestion.familyName].filter(Boolean).join(' ') ||
    suggestion.orcid
  );
}

function displayInstitution(suggestion: OrcidSuggestion): string {
  return suggestion.currentInstitution || suggestion.pastInstitution || '—';
}
