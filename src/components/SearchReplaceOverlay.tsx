import {
  ChevronDown,
  ChevronUp,
  Replace,
  Search,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  stageMottoChange,
  stageSubtitleChange,
} from '../app/manuscriptFrontMatterActions';
import { stageUpdateNote } from '../app/noteActions';
import { stageSectionTitleChange } from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  countMatchesInBlockContent,
  countMatchesInText,
  findTextMatchRanges,
  replaceInBlockContent,
  replaceInText,
  replaceMatchInBlockContent,
  replaceMatchInText,
  type ManuscriptSearchOptions,
} from '../model/manuscriptSearch';
import { isNoteAnnotation } from '../model/notes';
import './SearchReplaceOverlay.css';

type SearchMode = 'find' | 'replace';
type SearchScope =
  | 'all'
  | 'current-section'
  | 'headings'
  | 'body'
  | 'notes'
  | 'metadata';

type SearchTarget =
  | 'title'
  | 'subtitle'
  | 'motto'
  | 'abstract'
  | 'section-title'
  | 'body'
  | 'note';

interface SearchResult {
  key: string;
  target: SearchTarget;
  occurrenceIndex: number;
  sectionId?: string;
  blockId?: string;
  noteId?: string;
}

export function SearchReplaceOverlay() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const setTitle = useStudioStore((state) => state.setTitle);
  const setAbstract = useStudioStore((state) => state.setAbstract);
  const updateBlock = useStudioStore((state) => state.updateBlock);
  const [mode, setMode] = useState<SearchMode | null>(null);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [scope, setScope] = useState<SearchScope>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const queryRef = useRef<HTMLInputElement>(null);
  const copy = getCopy(locale);
  const options = useMemo<ManuscriptSearchOptions>(
    () => ({ caseSensitive, wholeWord }),
    [caseSensitive, wholeWord],
  );

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

  const results = useMemo(
    () => collectResults(manuscript, selectedSectionId, scope, query, options),
    [manuscript, options, query, scope, selectedSectionId],
  );

  useEffect(() => {
    setActiveIndex((current) =>
      results.length === 0 ? 0 : Math.min(current, results.length - 1),
    );
  }, [results.length]);

  const activeResult = results[activeIndex];

  useEffect(() => {
    if (!activeResult || !query) return;
    revealResult(activeResult, query, options);
  }, [activeResult, options, query]);

  if (!mode) return null;

  const move = (delta: number) => {
    if (results.length === 0) return;
    setActiveIndex((current) => (current + delta + results.length) % results.length);
  };

  const replaceCurrent = () => {
    if (!query || !activeResult) return;
    replaceResult(activeResult, manuscript, query, replacement, options, {
      setTitle,
      setAbstract,
      updateBlock,
    });
  };

  const replaceAll = () => {
    if (!query) return;
    replaceAllInScope(manuscript, selectedSectionId, scope, query, replacement, options, {
      setTitle,
      setAbstract,
      updateBlock,
    });
  };

  return (
    <aside
      className="omi-search-replace"
      role="search"
      aria-label={mode === 'replace' ? copy.replaceTitle : copy.findTitle}
    >
      <div className="omi-search-replace__row">
        {mode === 'replace' ? <Replace size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
        <input
          ref={queryRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              move(event.shiftKey ? -1 : 1);
            }
            if (event.key === 'Escape') setMode(null);
          }}
          placeholder={copy.findPlaceholder}
          aria-label={copy.findPlaceholder}
        />
        <span className="omi-search-replace__count" aria-live="polite">
          {query ? copy.position(results.length ? activeIndex + 1 : 0, results.length) : ''}
        </span>
        <div className="omi-search-replace__navigation">
          <button type="button" className="omi-search-replace__icon-button" disabled={!results.length} aria-label={copy.previous} title={copy.previous} onClick={() => move(-1)}><ChevronUp size={17} aria-hidden="true" /></button>
          <button type="button" className="omi-search-replace__icon-button" disabled={!results.length} aria-label={copy.next} title={copy.next} onClick={() => move(1)}><ChevronDown size={17} aria-hidden="true" /></button>
        </div>
        <button type="button" className="omi-search-replace__icon-button" aria-label={copy.close} title={copy.close} onClick={() => setMode(null)}><X size={17} aria-hidden="true" /></button>
      </div>

      {mode === 'replace' ? (
        <div className="omi-search-replace__row omi-search-replace__row--replace">
          <span aria-hidden="true" className="omi-search-replace__indent" />
          <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder={copy.replacePlaceholder} aria-label={copy.replacePlaceholder} />
          <button type="button" className="omi-search-replace__action" disabled={!activeResult} onClick={replaceCurrent}>{copy.replace}</button>
          <button type="button" className="omi-search-replace__action" disabled={!query || results.length === 0} onClick={replaceAll}>{copy.replaceAll}</button>
        </div>
      ) : null}

      <div className="omi-search-replace__options">
        <label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />{copy.caseSensitive}</label>
        <label><input type="checkbox" checked={wholeWord} onChange={(event) => setWholeWord(event.target.checked)} />{copy.wholeWord}</label>
        <label className="omi-search-replace__scope-label">
          <span>{copy.scope}</span>
          <select value={scope} onChange={(event) => { setScope(event.target.value as SearchScope); setActiveIndex(0); }}>
            <option value="all">{copy.scopes.all}</option>
            <option value="current-section">{copy.scopes.currentSection}</option>
            <option value="headings">{copy.scopes.headings}</option>
            <option value="body">{copy.scopes.body}</option>
            <option value="notes">{copy.scopes.notes}</option>
            <option value="metadata">{copy.scopes.metadata}</option>
          </select>
        </label>
      </div>
      {activeResult ? <div className="omi-search-replace__location">{copy.location(labelForResult(activeResult, manuscript, locale))}</div> : null}
    </aside>
  );
}

function collectResults(
  manuscript: ReturnType<typeof useStudioStore.getState>['manuscript'],
  selectedSectionId: string | null,
  scope: SearchScope,
  query: string,
  options: ManuscriptSearchOptions,
): SearchResult[] {
  if (!query) return [];
  const results: SearchResult[] = [];
  const includeMetadata = scope === 'all' || scope === 'metadata';
  const includeHeadings = scope === 'all' || scope === 'headings';
  const includeBody = scope === 'all' || scope === 'body' || scope === 'current-section';
  const includeNotes = scope === 'all' || scope === 'notes' || scope === 'current-section';
  const sections = scope === 'current-section'
    ? manuscript.sections.filter((section) => section.id === selectedSectionId)
    : manuscript.sections;

  if (includeMetadata) {
    pushTextResults(results, 'title', manuscript.title, query, options, 'title');
    pushTextResults(results, 'subtitle', manuscript.subtitle ?? '', query, options, 'subtitle');
    pushTextResults(results, 'motto', manuscript.motto ?? '', query, options, 'motto');
    pushTextResults(results, 'abstract', manuscript.abstract ?? '', query, options, 'abstract');
  } else if (scope === 'headings') {
    pushTextResults(results, 'title', manuscript.title, query, options, 'title');
  }

  if (includeHeadings || scope === 'current-section') {
    for (const section of sections) {
      pushTextResults(results, 'section-title', section.title, query, options, `section:${section.id}`, section.id);
    }
  }

  if (includeBody) {
    for (const section of sections) {
      for (const block of section.blocks) {
        const count = countMatchesInBlockContent(block.content, query, options);
        for (let index = 0; index < count; index += 1) {
          results.push({ key: `body:${block.id}:${index}`, target: 'body', blockId: block.id, sectionId: section.id, occurrenceIndex: index });
        }
      }
    }
  }

  if (includeNotes) {
    const allowedBlockIds = new Set(sections.flatMap((section) => section.blocks.map((block) => block.id)));
    for (const annotation of manuscript.annotations) {
      if (!isNoteAnnotation(annotation)) continue;
      if (scope === 'current-section' && (!annotation.targetBlockId || !allowedBlockIds.has(annotation.targetBlockId))) continue;
      const count = countMatchesInBlockContent(annotation.body ?? '', query, options);
      for (let index = 0; index < count; index += 1) {
        results.push({ key: `note:${annotation.id}:${index}`, target: 'note', noteId: annotation.id, blockId: annotation.targetBlockId, occurrenceIndex: index });
      }
    }
  }

  return results;
}

function pushTextResults(
  results: SearchResult[],
  target: SearchTarget,
  text: string,
  query: string,
  options: ManuscriptSearchOptions,
  key: string,
  sectionId?: string,
): void {
  const count = countMatchesInText(text, query, options);
  for (let index = 0; index < count; index += 1) {
    results.push({ key: `${key}:${index}`, target, occurrenceIndex: index, sectionId });
  }
}

type Mutators = {
  setTitle: (value: string) => void;
  setAbstract: (value: string) => void;
  updateBlock: (blockId: string, content: string) => void;
};

function replaceResult(
  result: SearchResult,
  manuscript: ReturnType<typeof useStudioStore.getState>['manuscript'],
  query: string,
  replacement: string,
  options: ManuscriptSearchOptions,
  mutators: Mutators,
): void {
  if (result.target === 'title') {
    mutators.setTitle(replaceMatchInText(manuscript.title, query, replacement, result.occurrenceIndex, options).text);
  } else if (result.target === 'subtitle') {
    stageSubtitleChange(replaceMatchInText(manuscript.subtitle ?? '', query, replacement, result.occurrenceIndex, options).text);
  } else if (result.target === 'motto') {
    stageMottoChange(replaceMatchInText(manuscript.motto ?? '', query, replacement, result.occurrenceIndex, options).text);
  } else if (result.target === 'abstract') {
    mutators.setAbstract(replaceMatchInText(manuscript.abstract ?? '', query, replacement, result.occurrenceIndex, options).text);
  } else if (result.target === 'section-title' && result.sectionId) {
    const section = manuscript.sections.find((item) => item.id === result.sectionId);
    if (section) stageSectionTitleChange(section.id, replaceMatchInText(section.title, query, replacement, result.occurrenceIndex, options).text);
  } else if (result.target === 'body' && result.blockId) {
    const block = manuscript.sections.flatMap((section) => section.blocks).find((item) => item.id === result.blockId);
    if (block) {
      const next = replaceMatchInBlockContent(block.content, query, replacement, result.occurrenceIndex, options);
      if (next.replacements) mutators.updateBlock(block.id, next.content);
    }
  } else if (result.target === 'note' && result.noteId) {
    const note = manuscript.annotations.find((item) => item.id === result.noteId && isNoteAnnotation(item));
    if (note) {
      const next = replaceMatchInBlockContent(note.body ?? '', query, replacement, result.occurrenceIndex, options);
      if (next.replacements) stageUpdateNote(note.id, { body: next.content });
    }
  }
}

function replaceAllInScope(
  manuscript: ReturnType<typeof useStudioStore.getState>['manuscript'],
  selectedSectionId: string | null,
  scope: SearchScope,
  query: string,
  replacement: string,
  options: ManuscriptSearchOptions,
  mutators: Mutators,
): void {
  const targets = collectResults(manuscript, selectedSectionId, scope, query, options);
  const unique = new Map<string, SearchResult>();
  for (const result of targets) {
    const key = `${result.target}:${result.sectionId ?? ''}:${result.blockId ?? ''}:${result.noteId ?? ''}`;
    if (!unique.has(key)) unique.set(key, result);
  }

  for (const result of unique.values()) {
    if (result.target === 'title') mutators.setTitle(replaceInText(manuscript.title, query, replacement, options).text);
    else if (result.target === 'subtitle') stageSubtitleChange(replaceInText(manuscript.subtitle ?? '', query, replacement, options).text);
    else if (result.target === 'motto') stageMottoChange(replaceInText(manuscript.motto ?? '', query, replacement, options).text);
    else if (result.target === 'abstract') mutators.setAbstract(replaceInText(manuscript.abstract ?? '', query, replacement, options).text);
    else if (result.target === 'section-title' && result.sectionId) {
      const section = manuscript.sections.find((item) => item.id === result.sectionId);
      if (section) stageSectionTitleChange(section.id, replaceInText(section.title, query, replacement, options).text);
    } else if (result.target === 'body' && result.blockId) {
      const block = manuscript.sections.flatMap((section) => section.blocks).find((item) => item.id === result.blockId);
      if (block) {
        const next = replaceInBlockContent(block.content, query, replacement, options);
        if (next.replacements) mutators.updateBlock(block.id, next.content);
      }
    } else if (result.target === 'note' && result.noteId) {
      const note = manuscript.annotations.find((item) => item.id === result.noteId && isNoteAnnotation(item));
      if (note) {
        const next = replaceInBlockContent(note.body ?? '', query, replacement, options);
        if (next.replacements) stageUpdateNote(note.id, { body: next.content });
      }
    }
  }
}

function revealResult(result: SearchResult, query: string, options: ManuscriptSearchOptions): void {
  clearSearchHighlights();

  if (result.target === 'title') {
    selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-title'), query, result.occurrenceIndex, options);
    return;
  }
  if (result.target === 'subtitle') {
    selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-subtitle'), query, result.occurrenceIndex, options);
    return;
  }
  if (result.target === 'motto') {
    selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-motto'), query, result.occurrenceIndex, options);
    return;
  }
  if (result.target === 'section-title' && result.sectionId) {
    const section = document.querySelector<HTMLElement>(`.omi-section-editor[data-section-id="${CSS.escape(result.sectionId)}"]`);
    section?.classList.add('omi-search-current-target');
    selectTextareaMatch(section?.querySelector<HTMLTextAreaElement>('.omi-section-title-input') ?? null, query, result.occurrenceIndex, options);
    return;
  }
  if (result.target === 'body' && result.blockId) {
    const block = document.querySelector<HTMLElement>(`.omi-block-editor[data-block-id="${CSS.escape(result.blockId)}"]`);
    block?.classList.add('omi-search-current-target');
    block?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  if (result.target === 'note' && result.noteId) {
    const anchor = document.querySelector<HTMLElement>(`[data-omi-note][data-note-id="${CSS.escape(result.noteId)}"]`);
    anchor?.classList.add('omi-search-current-target');
    anchor?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function selectTextareaMatch(
  element: HTMLTextAreaElement | null,
  query: string,
  occurrenceIndex: number,
  options: ManuscriptSearchOptions,
): void {
  if (!element) return;
  const range = findTextMatchRanges(element.value, query, options)[occurrenceIndex];
  element.classList.add('omi-search-current-target');
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (!range) return;
  element.focus({ preventScroll: true });
  element.setSelectionRange(range.start, range.end);
}

function clearSearchHighlights(): void {
  document.querySelectorAll('.omi-search-current-target').forEach((element) => element.classList.remove('omi-search-current-target'));
}

function labelForResult(
  result: SearchResult,
  manuscript: ReturnType<typeof useStudioStore.getState>['manuscript'],
  locale: string,
): string {
  const labels = locale === 'hu'
    ? { title: 'kézirat címe', subtitle: 'alcím', motto: 'mottó', abstract: 'absztrakt', body: 'törzsszöveg', note: 'jegyzet' }
    : locale === 'de'
      ? { title: 'Manuskripttitel', subtitle: 'Untertitel', motto: 'Motto', abstract: 'Zusammenfassung', body: 'Fließtext', note: 'Anmerkung' }
      : { title: 'manuscript title', subtitle: 'subtitle', motto: 'motto', abstract: 'abstract', body: 'body text', note: 'note' };
  if (result.target === 'section-title' && result.sectionId) {
    return manuscript.sections.find((section) => section.id === result.sectionId)?.title || labels.title;
  }
  return labels[result.target as keyof typeof labels] ?? labels.body;
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    findTitle: 'Keresés', replaceTitle: 'Keresés és csere', findPlaceholder: 'Keresés a kéziratban…', replacePlaceholder: 'Csere erre…', replace: 'Csere', replaceAll: 'Összes cseréje', caseSensitive: 'Kis-/nagybetű érzékeny', wholeWord: 'Teljes szó', close: 'Bezárás', previous: 'Előző találat', next: 'Következő találat', scope: 'Hatókör', position: (current: number, total: number) => `${current}/${total}`, location: (value: string) => `Találat helye: ${value}`, scopes: { all: 'Teljes kézirat', currentSection: 'Aktuális fejezet', headings: 'Címek', body: 'Törzsszöveg', notes: 'Jegyzetek', metadata: 'Metaadatok' },
  };
  if (locale === 'de') return {
    findTitle: 'Suchen', replaceTitle: 'Suchen und Ersetzen', findPlaceholder: 'Im Manuskript suchen…', replacePlaceholder: 'Ersetzen durch…', replace: 'Ersetzen', replaceAll: 'Alle ersetzen', caseSensitive: 'Groß-/Kleinschreibung', wholeWord: 'Ganzes Wort', close: 'Schließen', previous: 'Vorheriger Treffer', next: 'Nächster Treffer', scope: 'Bereich', position: (current: number, total: number) => `${current}/${total}`, location: (value: string) => `Fundstelle: ${value}`, scopes: { all: 'Gesamtes Manuskript', currentSection: 'Aktueller Abschnitt', headings: 'Überschriften', body: 'Fließtext', notes: 'Anmerkungen', metadata: 'Metadaten' },
  };
  return {
    findTitle: 'Find', replaceTitle: 'Find and replace', findPlaceholder: 'Find in manuscript…', replacePlaceholder: 'Replace with…', replace: 'Replace', replaceAll: 'Replace all', caseSensitive: 'Match case', wholeWord: 'Whole word', close: 'Close', previous: 'Previous match', next: 'Next match', scope: 'Scope', position: (current: number, total: number) => `${current}/${total}`, location: (value: string) => `Match location: ${value}`, scopes: { all: 'Whole manuscript', currentSection: 'Current section', headings: 'Headings', body: 'Body text', notes: 'Notes', metadata: 'Metadata' },
  };
}
