import {
  Search,
  Replace,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  countMatchesInBlockContent,
  replaceInBlockContent,
} from '../model/manuscriptSearch';
import './SearchReplaceOverlay.css';

type SearchMode = 'find' | 'replace';

export function SearchReplaceOverlay() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const updateBlock = useStudioStore((state) => state.updateBlock);
  const [mode, setMode] = useState<SearchMode | null>(null);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const queryRef = useRef<HTMLInputElement>(null);
  const copy = getCopy(locale);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'f' && key !== 'h') return;

      event.preventDefault();
      setMode(key === 'h' ? 'replace' : 'find');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!mode) return;
    requestAnimationFrame(() => {
      queryRef.current?.focus();
      queryRef.current?.select();
    });
  }, [mode]);

  const matchCount = useMemo(() => {
    if (!query) return 0;
    return manuscript.sections.reduce(
      (sectionTotal, section) =>
        sectionTotal + section.blocks.reduce(
          (blockTotal, block) =>
            blockTotal + countMatchesInBlockContent(block.content, query, {
              caseSensitive,
              wholeWord,
            }),
          0,
        ),
      0,
    );
  }, [caseSensitive, manuscript.sections, query, wholeWord]);

  if (!mode) return null;

  const replaceAll = () => {
    if (!query) return;

    for (const section of manuscript.sections) {
      for (const block of section.blocks) {
        const result = replaceInBlockContent(
          block.content,
          query,
          replacement,
          { caseSensitive, wholeWord },
        );
        if (result.replacements > 0) {
          updateBlock(block.id, result.content);
        }
      }
    }
  };

  return (
    <aside
      className="omi-search-replace"
      role="search"
      aria-label={mode === 'replace' ? copy.replaceTitle : copy.findTitle}
    >
      <div className="omi-search-replace__row">
        {mode === 'replace' ? (
          <Replace size={17} aria-hidden="true" />
        ) : (
          <Search size={17} aria-hidden="true" />
        )}
        <input
          ref={queryRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.findPlaceholder}
          aria-label={copy.findPlaceholder}
        />
        <span className="omi-search-replace__count" aria-live="polite">
          {query ? copy.matches(matchCount) : ''}
        </span>
        <button
          type="button"
          className="omi-search-replace__icon-button"
          aria-label={copy.close}
          title={copy.close}
          onClick={() => setMode(null)}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      {mode === 'replace' ? (
        <div className="omi-search-replace__row omi-search-replace__row--replace">
          <span aria-hidden="true" className="omi-search-replace__indent" />
          <input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            placeholder={copy.replacePlaceholder}
            aria-label={copy.replacePlaceholder}
          />
          <button
            type="button"
            className="omi-search-replace__action"
            disabled={!query || matchCount === 0}
            onClick={replaceAll}
          >
            {copy.replaceAll}
          </button>
        </div>
      ) : null}

      <div className="omi-search-replace__options">
        <label>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(event) => setCaseSensitive(event.target.checked)}
          />
          {copy.caseSensitive}
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(event) => setWholeWord(event.target.checked)}
          />
          {copy.wholeWord}
        </label>
        <span>{copy.scope}</span>
      </div>
    </aside>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      findTitle: 'Keresés',
      replaceTitle: 'Keresés és csere',
      findPlaceholder: 'Keresés a kézirat törzsszövegében…',
      replacePlaceholder: 'Csere erre…',
      replaceAll: 'Összes cseréje',
      caseSensitive: 'Kis-/nagybetű érzékeny',
      wholeWord: 'Teljes szó',
      close: 'Bezárás',
      scope: 'Hatókör: törzsszöveg',
      matches: (count: number) => `${count} találat`,
    };
  }

  if (locale === 'de') {
    return {
      findTitle: 'Suchen',
      replaceTitle: 'Suchen und Ersetzen',
      findPlaceholder: 'Im Manuskripttext suchen…',
      replacePlaceholder: 'Ersetzen durch…',
      replaceAll: 'Alle ersetzen',
      caseSensitive: 'Groß-/Kleinschreibung',
      wholeWord: 'Ganzes Wort',
      close: 'Schließen',
      scope: 'Bereich: Fließtext',
      matches: (count: number) => `${count} Treffer`,
    };
  }

  return {
    findTitle: 'Find',
    replaceTitle: 'Find and replace',
    findPlaceholder: 'Find in manuscript body…',
    replacePlaceholder: 'Replace with…',
    replaceAll: 'Replace all',
    caseSensitive: 'Match case',
    wholeWord: 'Whole word',
    close: 'Close',
    scope: 'Scope: body text',
    matches: (count: number) => `${count} ${count === 1 ? 'match' : 'matches'}`,
  };
}
