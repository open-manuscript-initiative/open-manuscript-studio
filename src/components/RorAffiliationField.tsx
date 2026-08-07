import {
  ExternalLink,
  Link2,
  Link2Off,
  Search,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useState,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getRorAffiliationCopy } from '../i18n/rorAffiliation';
import {
  searchRorOrganizations,
  type RorOrganizationSuggestion,
} from '../services/rorLookup';

interface RorAffiliationFieldProps {
  agentId: string;
  affiliation: string;
  rorId: string;
  label: string;
}

const SEARCH_DELAY_MS = 350;

export function RorAffiliationField({
  agentId,
  affiliation,
  rorId,
  label,
}: RorAffiliationFieldProps) {
  const { locale } = useTranslation();
  const copy = getRorAffiliationCopy(locale);
  const updateContributor = useStudioStore(
    (state) => state.updateContributor,
  );
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<RorOrganizationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);

  useEffect(() => {
    const query = affiliation.trim();

    if (rorId || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setSearchError(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setSearchError(false);

      void searchRorOrganizations(query, {
        signal: controller.signal,
      })
        .then((results) => {
          setSuggestions(results);
          setHasSearched(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }

          setSuggestions([]);
          setHasSearched(true);
          setSearchError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [affiliation, rorId]);

  function changeAffiliation(value: string): void {
    updateContributor(agentId, {
      affiliation: value,
      affiliationRorId: null,
    });
  }

  function selectOrganization(
    organization: RorOrganizationSuggestion,
  ): void {
    updateContributor(agentId, {
      affiliation: organization.displayName,
      affiliationRorId: organization.id,
    });
    setSuggestions([]);
    setHasSearched(false);
    setSearchError(false);
  }

  function removeRorLink(): void {
    updateContributor(agentId, {
      affiliation,
      affiliationRorId: null,
    });
  }

  const showDropdown =
    hasFocus &&
    !rorId &&
    affiliation.trim().length >= 2 &&
    (isLoading || hasSearched || suggestions.length > 0);

  return (
    <div className="contributor-wide-field ror-affiliation-field">
      <label htmlFor={`${listboxId}-input`}>
        <span>{label}</span>
      </label>

      <div className="ror-affiliation-input-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          value={affiliation}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showDropdown}
          onFocus={() => setHasFocus(true)}
          onBlur={() => setHasFocus(false)}
          onChange={(event) => changeAffiliation(event.target.value)}
        />
      </div>

      {rorId ? (
        <div className="ror-affiliation-linked">
          <Link2 size={15} aria-hidden="true" />
          <span>{copy.selected}</span>
          <a
            href={rorId}
            target="_blank"
            rel="noopener noreferrer"
            title={copy.openRor}
          >
            {shortRorId(rorId)}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <button
            type="button"
            className="ror-affiliation-unlink"
            onClick={removeRorLink}
            title={copy.removeLink}
            aria-label={copy.removeLink}
          >
            <Link2Off size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {showDropdown ? (
        <div className="ror-affiliation-popover">
          {isLoading ? (
            <div className="ror-affiliation-status" aria-live="polite">
              {copy.searching}
            </div>
          ) : null}

          {!isLoading && searchError ? (
            <div className="ror-affiliation-status ror-affiliation-status--error">
              {copy.searchUnavailable}
            </div>
          ) : null}

          {!isLoading && !searchError && hasSearched && suggestions.length === 0 ? (
            <div className="ror-affiliation-status">
              {copy.noResults}
            </div>
          ) : null}

          {!isLoading && suggestions.length > 0 ? (
            <div
              id={listboxId}
              className="ror-affiliation-results"
              role="listbox"
              aria-label={copy.suggestions}
            >
              {suggestions.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="ror-affiliation-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOrganization(organization)}
                >
                  <span className="ror-affiliation-result-main">
                    <strong>{organization.displayName}</strong>
                    <small>{formatLocation(organization, copy.locationUnknown)}</small>
                  </span>
                  <span className="ror-affiliation-result-id">
                    {shortRorId(organization.id)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="ror-affiliation-credit">{copy.poweredBy}</div>
        </div>
      ) : null}
    </div>
  );
}

function shortRorId(rorId: string): string {
  return rorId.replace(/^https?:\/\//i, '');
}

function formatLocation(
  organization: RorOrganizationSuggestion,
  fallback: string,
): string {
  const parts = [organization.city, organization.country].filter(Boolean);
  return parts.join(', ') || fallback;
}
