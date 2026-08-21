import { ExternalLink, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { useTranslation } from '../i18n';
import { getOrcidLookupCopy } from '../i18n/orcidLookup';
import { isValidOrcid } from '../model/user';
import {
  searchOrcidRegistry,
  type OrcidSuggestion,
} from '../services/orcidLookup';

interface AuthOrcidLookupFieldProps {
  fullName: string;
  affiliation: string;
  rorId: string;
  value: string;
  label: string;
  placeholder: string;
  hint: string;
  invalidMessage: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const SEARCH_DELAY_MS = 350;

export function AuthOrcidLookupField({
  fullName,
  affiliation,
  rorId,
  value,
  label,
  placeholder,
  hint,
  invalidMessage,
  disabled = false,
  onChange,
}: AuthOrcidLookupFieldProps) {
  const { locale } = useTranslation();
  const copy = getOrcidLookupCopy(locale);
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<OrcidSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);

  const { givenName, familyName } = splitFullName(fullName);
  const canSearch = fullName.trim().length >= 4;
  const valid = !value.trim() || isValidOrcid(value);
  const orcidProfileUrl = value && valid
    ? `https://orcid.org/${encodeURIComponent(value.trim())}`
    : undefined;
  const publicSearchUrl = useMemo(() => {
    const url = new URL('https://orcid.org/orcid-search/search');
    url.searchParams.set('searchQuery', fullName.trim() || affiliation);
    return url.toString();
  }, [affiliation, fullName]);

  useEffect(() => {
    if (!hasFocus || value.trim() || !canSearch) {
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
        { givenName, familyName, affiliation, rorId },
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
  }, [affiliation, canSearch, familyName, givenName, hasFocus, rorId, value]);

  const showDropdown =
    hasFocus &&
    !value.trim() &&
    canSearch &&
    (isLoading || hasSearched || suggestions.length > 0);

  return (
    <div className="auth-field orcid-lookup-field">
      <label htmlFor={`${listboxId}-input`}>{label}</label>
      <div className="orcid-lookup-input-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          id={`${listboxId}-input`}
          name="orcid"
          type="text"
          role="combobox"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!valid}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showDropdown}
          onFocus={() => setHasFocus(true)}
          onBlur={() => setHasFocus(false)}
          onChange={(event) => {
            onChange(event.target.value);
            setSuggestions([]);
            setHasSearched(false);
          }}
        />
      </div>

      {!valid ? <small className="field-error">{invalidMessage}</small> : null}

      {orcidProfileUrl ? (
        <div className="orcid-lookup-linked">
          <span>{copy.selected}</span>
          <a href={orcidProfileUrl} target="_blank" rel="noopener noreferrer" title={copy.openProfile}>
            {value}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <small>{copy.notAuthenticated}</small>
        </div>
      ) : null}

      {showDropdown ? (
        <div className="orcid-lookup-popover">
          {isLoading ? <div className="orcid-lookup-status">{copy.searching}</div> : null}
          {!isLoading && searchError ? (
            <div className="orcid-lookup-status orcid-lookup-status--error">{copy.unavailable}</div>
          ) : null}
          {!isLoading && !searchError && hasSearched && suggestions.length === 0 ? (
            <div className="orcid-lookup-status">{copy.noResults}</div>
          ) : null}
          {!isLoading && suggestions.length > 0 ? (
            <div id={listboxId} className="orcid-lookup-results" role="listbox" aria-label={copy.suggestions}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.orcid}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="orcid-lookup-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(suggestion.orcid);
                    setSuggestions([]);
                    setHasSearched(false);
                  }}
                >
                  <span className="orcid-lookup-result-main">
                    <strong>{displayName(suggestion)}</strong>
                    <small>{suggestion.currentInstitution || suggestion.pastInstitution || '—'}</small>
                  </span>
                  <span className="orcid-lookup-result-id">{suggestion.orcid}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="orcid-lookup-footer">
            <span>{copy.poweredBy}</span>
            <a href={publicSearchUrl} target="_blank" rel="noopener noreferrer">
              ORCID <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}

      {!value && !hasFocus ? <div className="auth-field-hint">{hint}</div> : null}
    </div>
  );
}

function splitFullName(fullName: string): { givenName: string; familyName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: '', familyName: '' };
  if (parts.length === 1) return { givenName: '', familyName: parts[0] ?? '' };
  return {
    givenName: parts.slice(0, -1).join(' '),
    familyName: parts[parts.length - 1] ?? '',
  };
}

function displayName(suggestion: OrcidSuggestion): string {
  return suggestion.creditName || [suggestion.givenName, suggestion.familyName].filter(Boolean).join(' ') || suggestion.orcid;
}
