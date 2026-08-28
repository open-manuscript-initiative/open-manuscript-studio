import { ChevronDown, ChevronUp, Replace, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { stageMottoChange, stageSubtitleChange } from '../app/manuscriptFrontMatterActions';
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
import type { OmiBlock } from '../types/omi';
import './SearchReplaceOverlay.css';

type SearchMode = 'find' | 'replace';
type ObjectScope = 'visuals' | 'images' | 'tables' | 'charts' | 'equations';
type SearchScope = 'all' | 'current-section' | 'headings' | 'body' | 'notes' | 'metadata' | ObjectScope;
type SearchTarget = 'title' | 'subtitle' | 'motto' | 'abstract' | 'section-title' | 'body' | 'note' | 'object';

interface SearchResult {
  key: string;
  target: SearchTarget;
  occurrenceIndex: number;
  sectionId?: string;
  blockId?: string;
  noteId?: string;
  objectKind?: string;
}

type Manuscript = ReturnType<typeof useStudioStore.getState>['manuscript'];
type Mutators = {
  setTitle: (value: string) => void;
  setAbstract: (value: string) => void;
  updateBlock: (blockId: string, content: string) => void;
};

const OBJECT_SCOPES = new Set<SearchScope>(['visuals', 'images', 'tables', 'charts', 'equations']);

export function SearchReplaceOverlay() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const setTitle = useStudioStore((state) => state.setTitle);
  const setAbstract = useStudioStore((state) => state.setAbstract);
  const updateBlock = useStudioStore((state) => state.updateBlock);
  const [mode, setMode] = useState<SearchMode | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [scope, setScope] = useState<SearchScope>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealRequestId, setRevealRequestId] = useState(0);
  const queryRef = useRef<HTMLInputElement>(null);
  const handledRevealRequestId = useRef(0);
  const copy = getCopy(locale);
  const options = useMemo<ManuscriptSearchOptions>(() => ({ caseSensitive, wholeWord }), [caseSensitive, wholeWord]);
  const objectMode = OBJECT_SCOPES.has(scope);

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
    requestAnimationFrame(() => { queryRef.current?.focus(); queryRef.current?.select(); });
  }, [mode]);

  const results = useMemo(
    () => searchSubmitted
      ? collectResults(manuscript, selectedSectionId, scope, submittedQuery, options)
      : [],
    [manuscript, options, scope, searchSubmitted, selectedSectionId, submittedQuery],
  );

  useEffect(() => {
    setActiveIndex((current) => results.length === 0 ? 0 : Math.min(current, results.length - 1));
  }, [results.length]);

  const activeResult = results[activeIndex];
  useEffect(() => {
    if (revealRequestId === 0 || handledRevealRequestId.current === revealRequestId) return;
    handledRevealRequestId.current = revealRequestId;
    if (!searchSubmitted || !activeResult) return;
    if (!submittedQuery && activeResult.target !== 'object') return;
    revealResult(activeResult, submittedQuery, options);
  }, [activeResult, options, revealRequestId, searchSubmitted, submittedQuery]);

  if (!mode) return null;

  const resetPendingSearch = () => {
    setSearchSubmitted(false);
    setActiveIndex(0);
    clearSearchHighlights();
  };

  const submitSearch = () => {
    setSubmittedQuery(query);
    setSearchSubmitted(true);
    setActiveIndex(0);
    setRevealRequestId((current) => current + 1);
  };

  const move = (delta: number) => {
    if (!results.length) return;
    setActiveIndex((current) => (current + delta + results.length) % results.length);
    setRevealRequestId((current) => current + 1);
  };
  const mutators = { setTitle, setAbstract, updateBlock };

  return (
    <aside className="omi-search-replace" role="search" aria-label={mode === 'replace' ? copy.replaceTitle : copy.findTitle}>
      <div className="omi-search-replace__row">
        {mode === 'replace' ? <Replace size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
        <input
          ref={queryRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPendingSearch();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (!searchSubmitted || query !== submittedQuery) submitSearch();
              else move(event.shiftKey ? -1 : 1);
            }
            if (event.key === 'Escape') setMode(null);
          }}
          placeholder={objectMode ? copy.objectPlaceholder : copy.findPlaceholder}
          aria-label={objectMode ? copy.objectPlaceholder : copy.findPlaceholder}
        />
        <span className="omi-search-replace__count" aria-live="polite">
          {searchSubmitted ? copy.position(results.length ? activeIndex + 1 : 0, results.length) : ''}
        </span>
        <div className="omi-search-replace__navigation">
          <button type="button" className="omi-search-replace__icon-button" disabled={!results.length} aria-label={copy.previous} title={copy.previous} onClick={() => move(-1)}><ChevronUp size={17} aria-hidden="true" /></button>
          <button type="button" className="omi-search-replace__icon-button" disabled={!results.length} aria-label={copy.next} title={copy.next} onClick={() => move(1)}><ChevronDown size={17} aria-hidden="true" /></button>
        </div>
        <button type="button" className="omi-search-replace__icon-button" aria-label={copy.close} title={copy.close} onClick={() => setMode(null)}><X size={17} aria-hidden="true" /></button>
      </div>

      {mode === 'replace' && !objectMode ? (
        <div className="omi-search-replace__row omi-search-replace__row--replace">
          <span aria-hidden="true" className="omi-search-replace__indent" />
          <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder={copy.replacePlaceholder} aria-label={copy.replacePlaceholder} />
          <button type="button" className="omi-search-replace__action" disabled={!activeResult} onClick={() => submittedQuery && activeResult && replaceResult(activeResult, manuscript, submittedQuery, replacement, options, mutators)}>{copy.replace}</button>
          <button type="button" className="omi-search-replace__action" disabled={!searchSubmitted || !submittedQuery || !results.length} onClick={() => submittedQuery && replaceAllInScope(manuscript, selectedSectionId, scope, submittedQuery, replacement, options, mutators)}>{copy.replaceAll}</button>
        </div>
      ) : null}

      <div className="omi-search-replace__options">
        <label><input type="checkbox" checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.target.checked); resetPendingSearch(); }} />{copy.caseSensitive}</label>
        <label><input type="checkbox" checked={wholeWord} onChange={(event) => { setWholeWord(event.target.checked); resetPendingSearch(); }} />{copy.wholeWord}</label>
        <label className="omi-search-replace__scope-label">
          <span>{copy.scope}</span>
          <select value={scope} onChange={(event) => { setScope(event.target.value as SearchScope); resetPendingSearch(); }}>
            <option value="all">{copy.scopes.all}</option>
            <option value="current-section">{copy.scopes.currentSection}</option>
            <option value="headings">{copy.scopes.headings}</option>
            <option value="body">{copy.scopes.body}</option>
            <option value="notes">{copy.scopes.notes}</option>
            <option value="metadata">{copy.scopes.metadata}</option>
            <option value="visuals">{copy.scopes.visuals}</option>
            <option value="images">{copy.scopes.images}</option>
            <option value="tables">{copy.scopes.tables}</option>
            <option value="charts">{copy.scopes.charts}</option>
            <option value="equations">{copy.scopes.equations}</option>
          </select>
        </label>
      </div>
      {activeResult ? <div className="omi-search-replace__location">{copy.location(labelForResult(activeResult, manuscript, locale))}</div> : null}
    </aside>
  );
}

function collectResults(manuscript: Manuscript, selectedSectionId: string | null, scope: SearchScope, query: string, options: ManuscriptSearchOptions): SearchResult[] {
  const results: SearchResult[] = [];
  if (OBJECT_SCOPES.has(scope)) {
    for (const section of manuscript.sections) {
      for (const block of flattenBlocks(section.blocks)) {
        if (!matchesObjectScope(block, scope as ObjectScope)) continue;
        const searchable = objectSearchText(block);
        if (query && countMatchesInText(searchable, query, options) === 0) continue;
        results.push({ key: `object:${block.id}`, target: 'object', blockId: block.id, sectionId: section.id, occurrenceIndex: 0, objectKind: objectKind(block) });
      }
    }
    return results;
  }
  if (!query) return results;
  const includeMetadata = scope === 'all' || scope === 'metadata';
  const includeHeadings = scope === 'all' || scope === 'headings';
  const includeBody = scope === 'all' || scope === 'body' || scope === 'current-section';
  const includeNotes = scope === 'all' || scope === 'notes' || scope === 'current-section';
  const sections = scope === 'current-section' ? manuscript.sections.filter((section) => section.id === selectedSectionId) : manuscript.sections;

  if (includeMetadata) {
    pushTextResults(results, 'title', manuscript.title, query, options, 'title');
    pushTextResults(results, 'subtitle', manuscript.subtitle ?? '', query, options, 'subtitle');
    pushTextResults(results, 'motto', manuscript.motto ?? '', query, options, 'motto');
    pushTextResults(results, 'abstract', manuscript.abstract ?? '', query, options, 'abstract');
  } else if (scope === 'headings') pushTextResults(results, 'title', manuscript.title, query, options, 'title');

  if (includeHeadings || scope === 'current-section') for (const section of sections) pushTextResults(results, 'section-title', section.title, query, options, `section:${section.id}`, section.id);
  if (includeBody) for (const section of sections) for (const block of flattenBlocks(section.blocks)) {
    const count = countMatchesInBlockContent(block.content, query, options);
    for (let index = 0; index < count; index += 1) results.push({ key: `body:${block.id}:${index}`, target: 'body', blockId: block.id, sectionId: section.id, occurrenceIndex: index });
  }
  if (includeNotes) {
    const allowedBlockIds = new Set(sections.flatMap((section) => flattenBlocks(section.blocks).map((block) => block.id)));
    for (const annotation of manuscript.annotations) {
      if (!isNoteAnnotation(annotation)) continue;
      if (scope === 'current-section' && (!annotation.targetBlockId || !allowedBlockIds.has(annotation.targetBlockId))) continue;
      const count = countMatchesInBlockContent(annotation.body ?? '', query, options);
      for (let index = 0; index < count; index += 1) results.push({ key: `note:${annotation.id}:${index}`, target: 'note', noteId: annotation.id, blockId: annotation.targetBlockId, occurrenceIndex: index });
    }
  }
  return results;
}

function flattenBlocks(blocks: OmiBlock[]): OmiBlock[] { return blocks.flatMap((block) => [block, ...flattenBlocks(block.children ?? [])]); }
function objectKind(block: OmiBlock): string { return block.visual?.kind ?? block.type; }
function matchesObjectScope(block: OmiBlock, scope: ObjectScope): boolean {
  const kind = objectKind(block);
  if (scope === 'visuals') return ['figure', 'image', 'table', 'chart', 'equation'].includes(kind) || ['figure', 'image', 'table', 'chart', 'equation'].includes(block.type);
  if (scope === 'images') return kind === 'image' || block.type === 'image' || block.type === 'figure';
  if (scope === 'tables') return kind === 'table' || block.type === 'table';
  if (scope === 'charts') return kind === 'chart' || block.type === 'chart';
  return kind === 'equation' || block.type === 'equation';
}
function objectSearchText(block: OmiBlock): string {
  const visual = block.visual;
  if (!visual) return block.content;
  if (visual.kind === 'image') return [visual.fileName, visual.alt, visual.caption].filter(Boolean).join('\n');
  if (visual.kind === 'table') return [visual.caption, ...visual.cells.flat()].filter(Boolean).join('\n');
  if (visual.kind === 'chart') return [visual.title, visual.caption, ...visual.cells.flat()].filter(Boolean).join('\n');
  return [visual.label, visual.caption, visual.latex, visual.source].filter(Boolean).join('\n');
}

function pushTextResults(results: SearchResult[], target: SearchTarget, text: string, query: string, options: ManuscriptSearchOptions, key: string, sectionId?: string): void {
  const count = countMatchesInText(text, query, options);
  for (let index = 0; index < count; index += 1) results.push({ key: `${key}:${index}`, target, occurrenceIndex: index, sectionId });
}
function findBlock(manuscript: Manuscript, id: string) { return manuscript.sections.flatMap((section) => flattenBlocks(section.blocks)).find((block) => block.id === id); }

function replaceResult(result: SearchResult, manuscript: Manuscript, query: string, replacement: string, options: ManuscriptSearchOptions, mutators: Mutators): void {
  if (result.target === 'object') return;
  if (result.target === 'title') mutators.setTitle(replaceMatchInText(manuscript.title, query, replacement, result.occurrenceIndex, options).text);
  else if (result.target === 'subtitle') stageSubtitleChange(replaceMatchInText(manuscript.subtitle ?? '', query, replacement, result.occurrenceIndex, options).text);
  else if (result.target === 'motto') stageMottoChange(replaceMatchInText(manuscript.motto ?? '', query, replacement, result.occurrenceIndex, options).text);
  else if (result.target === 'abstract') mutators.setAbstract(replaceMatchInText(manuscript.abstract ?? '', query, replacement, result.occurrenceIndex, options).text);
  else if (result.target === 'section-title' && result.sectionId) {
    const section = manuscript.sections.find((item) => item.id === result.sectionId);
    if (section) stageSectionTitleChange(section.id, replaceMatchInText(section.title, query, replacement, result.occurrenceIndex, options).text);
  } else if (result.target === 'body' && result.blockId) {
    const block = findBlock(manuscript, result.blockId);
    if (block) { const next = replaceMatchInBlockContent(block.content, query, replacement, result.occurrenceIndex, options); if (next.replacements) mutators.updateBlock(block.id, next.content); }
  } else if (result.target === 'note' && result.noteId) {
    const note = manuscript.annotations.find((item) => item.id === result.noteId && isNoteAnnotation(item));
    if (note) { const next = replaceMatchInBlockContent(note.body ?? '', query, replacement, result.occurrenceIndex, options); if (next.replacements) stageUpdateNote(note.id, { body: next.content }); }
  }
}

function replaceAllInScope(manuscript: Manuscript, selectedSectionId: string | null, scope: SearchScope, query: string, replacement: string, options: ManuscriptSearchOptions, mutators: Mutators): void {
  if (OBJECT_SCOPES.has(scope)) return;
  const unique = new Map<string, SearchResult>();
  for (const result of collectResults(manuscript, selectedSectionId, scope, query, options)) {
    const key = `${result.target}:${result.sectionId ?? ''}:${result.blockId ?? ''}:${result.noteId ?? ''}`;
    if (!unique.has(key)) unique.set(key, result);
  }
  for (const result of unique.values()) {
    if (result.target === 'title') mutators.setTitle(replaceInText(manuscript.title, query, replacement, options).text);
    else if (result.target === 'subtitle') stageSubtitleChange(replaceInText(manuscript.subtitle ?? '', query, replacement, options).text);
    else if (result.target === 'motto') stageMottoChange(replaceInText(manuscript.motto ?? '', query, replacement, options).text);
    else if (result.target === 'abstract') mutators.setAbstract(replaceInText(manuscript.abstract ?? '', query, replacement, options).text);
    else if (result.target === 'section-title' && result.sectionId) { const section = manuscript.sections.find((item) => item.id === result.sectionId); if (section) stageSectionTitleChange(section.id, replaceInText(section.title, query, replacement, options).text); }
    else if (result.target === 'body' && result.blockId) { const block = findBlock(manuscript, result.blockId); if (block) { const next = replaceInBlockContent(block.content, query, replacement, options); if (next.replacements) mutators.updateBlock(block.id, next.content); } }
    else if (result.target === 'note' && result.noteId) { const note = manuscript.annotations.find((item) => item.id === result.noteId && isNoteAnnotation(item)); if (note) { const next = replaceInBlockContent(note.body ?? '', query, replacement, options); if (next.replacements) stageUpdateNote(note.id, { body: next.content }); } }
  }
}

function revealResult(result: SearchResult, query: string, options: ManuscriptSearchOptions): void {
  clearSearchHighlights();
  if (result.target === 'title') return selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-title'), query, result.occurrenceIndex, options);
  if (result.target === 'subtitle') return selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-subtitle'), query, result.occurrenceIndex, options);
  if (result.target === 'motto') return selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-motto'), query, result.occurrenceIndex, options);
  if (result.target === 'abstract') return selectTextareaMatch(document.querySelector<HTMLTextAreaElement>('#manuscript-abstract'), query, result.occurrenceIndex, options);
  if (result.target === 'section-title' && result.sectionId) {
    const section = document.querySelector<HTMLElement>(`.omi-section-editor[data-section-id="${CSS.escape(result.sectionId)}"]`);
    section?.classList.add('omi-search-current-target');
    return selectTextareaMatch(section?.querySelector<HTMLTextAreaElement>('.omi-section-title-input') ?? null, query, result.occurrenceIndex, options);
  }
  if ((result.target === 'body' || result.target === 'object') && result.blockId) {
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
function selectTextareaMatch(element: HTMLTextAreaElement | null, query: string, occurrenceIndex: number, options: ManuscriptSearchOptions): void {
  if (!element) return;
  const range = findTextMatchRanges(element.value, query, options)[occurrenceIndex];
  element.classList.add('omi-search-current-target');
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (!range) return;
  element.focus({ preventScroll: true });
  element.setSelectionRange(range.start, range.end);
}
function clearSearchHighlights(): void { document.querySelectorAll('.omi-search-current-target').forEach((element) => element.classList.remove('omi-search-current-target')); }

const OBJECT_LABELS: Record<string, Record<string, string>> = {
  bg:{image:'изображение',figure:'фигура',table:'таблица',chart:'диаграма',equation:'формула'}, cs:{image:'obrázek',figure:'obrázek',table:'tabulka',chart:'graf',equation:'rovnice'}, da:{image:'billede',figure:'figur',table:'tabel',chart:'diagram',equation:'ligning'}, de:{image:'Bild',figure:'Abbildung',table:'Tabelle',chart:'Diagramm',equation:'Gleichung'}, el:{image:'εικόνα',figure:'σχήμα',table:'πίνακας',chart:'διάγραμμα',equation:'εξίσωση'}, en:{image:'image',figure:'figure',table:'table',chart:'chart',equation:'equation'}, es:{image:'imagen',figure:'figura',table:'tabla',chart:'gráfico',equation:'ecuación'}, et:{image:'pilt',figure:'joonis',table:'tabel',chart:'diagramm',equation:'võrrand'}, fi:{image:'kuva',figure:'kuvio',table:'taulukko',chart:'kaavio',equation:'yhtälö'}, fr:{image:'image',figure:'figure',table:'tableau',chart:'graphique',equation:'équation'}, ga:{image:'íomhá',figure:'fíor',table:'tábla',chart:'cairt',equation:'cothromóid'}, hr:{image:'slika',figure:'slika',table:'tablica',chart:'grafikon',equation:'jednadžba'}, hu:{image:'kép',figure:'ábra',table:'táblázat',chart:'diagram',equation:'képlet'}, it:{image:'immagine',figure:'figura',table:'tabella',chart:'grafico',equation:'equazione'}, lt:{image:'vaizdas',figure:'paveikslas',table:'lentelė',chart:'diagrama',equation:'lygtis'}, lv:{image:'attēls',figure:'attēls',table:'tabula',chart:'diagramma',equation:'vienādojums'}, mt:{image:'immaġni',figure:'figura',table:'tabella',chart:'grafika',equation:'ekwazzjoni'}, nl:{image:'afbeelding',figure:'figuur',table:'tabel',chart:'grafiek',equation:'vergelijking'}, pl:{image:'obraz',figure:'rysunek',table:'tabela',chart:'wykres',equation:'równanie'}, pt:{image:'imagem',figure:'figura',table:'tabela',chart:'gráfico',equation:'equação'}, ro:{image:'imagine',figure:'figură',table:'tabel',chart:'diagramă',equation:'ecuație'}, sk:{image:'obrázok',figure:'obrázok',table:'tabuľka',chart:'graf',equation:'rovnica'}, sl:{image:'slika',figure:'slika',table:'tabela',chart:'grafikon',equation:'enačba'}, sv:{image:'bild',figure:'figur',table:'tabell',chart:'diagram',equation:'ekvation'}
};

function labelForResult(result: SearchResult, manuscript: Manuscript, locale: string): string {
  if (result.target === 'object') {
    const section = manuscript.sections.find((item) => item.id === result.sectionId)?.title;
    const kind = OBJECT_LABELS[locale]?.[result.objectKind ?? ''] ?? OBJECT_LABELS.en[result.objectKind ?? ''] ?? result.objectKind ?? 'object';
    return section ? `${kind} — ${section}` : kind;
  }
  const labels = locale === 'hu' ? {title:'kézirat címe',subtitle:'alcím',motto:'mottó',abstract:'absztrakt',body:'törzsszöveg',note:'jegyzet'} : locale === 'de' ? {title:'Manuskripttitel',subtitle:'Untertitel',motto:'Motto',abstract:'Zusammenfassung',body:'Fließtext',note:'Anmerkung'} : {title:'manuscript title',subtitle:'subtitle',motto:'motto',abstract:'abstract',body:'body text',note:'note'};
  if (result.target === 'section-title' && result.sectionId) return manuscript.sections.find((section) => section.id === result.sectionId)?.title || labels.title;
  return labels[result.target as keyof typeof labels] ?? labels.body;
}

type ScopeCopy = { visuals:string; images:string; tables:string; charts:string; equations:string };
const SCOPE_TRANSLATIONS: Record<string, ScopeCopy> = {
  bg:{visuals:'Графични елементи',images:'Изображения',tables:'Таблици',charts:'Диаграми',equations:'Формули'}, cs:{visuals:'Grafické prvky',images:'Obrázky',tables:'Tabulky',charts:'Grafy',equations:'Rovnice'}, da:{visuals:'Grafiske elementer',images:'Billeder',tables:'Tabeller',charts:'Diagrammer',equations:'Ligninger'}, de:{visuals:'Grafische Elemente',images:'Bilder',tables:'Tabellen',charts:'Diagramme',equations:'Gleichungen'}, el:{visuals:'Γραφικά στοιχεία',images:'Εικόνες',tables:'Πίνακες',charts:'Διαγράμματα',equations:'Εξισώσεις'}, en:{visuals:'Graphic elements',images:'Images',tables:'Tables',charts:'Charts',equations:'Equations'}, es:{visuals:'Elementos gráficos',images:'Imágenes',tables:'Tablas',charts:'Gráficos',equations:'Ecuaciones'}, et:{visuals:'Graafilised elemendid',images:'Pildid',tables:'Tabelid',charts:'Diagrammid',equations:'Võrrandid'}, fi:{visuals:'Graafiset elementit',images:'Kuvat',tables:'Taulukot',charts:'Kaaviot',equations:'Yhtälöt'}, fr:{visuals:'Éléments graphiques',images:'Images',tables:'Tableaux',charts:'Graphiques',equations:'Équations'}, ga:{visuals:'Eilimintí grafacha',images:'Íomhánna',tables:'Táblaí',charts:'Cairteacha',equations:'Cothromóidí'}, hr:{visuals:'Grafički elementi',images:'Slike',tables:'Tablice',charts:'Grafikoni',equations:'Jednadžbe'}, hu:{visuals:'Grafikus elemek',images:'Képek',tables:'Táblázatok',charts:'Diagramok',equations:'Képletek'}, it:{visuals:'Elementi grafici',images:'Immagini',tables:'Tabelle',charts:'Grafici',equations:'Equazioni'}, lt:{visuals:'Grafiniai elementai',images:'Vaizdai',tables:'Lentelės',charts:'Diagramos',equations:'Lygtys'}, lv:{visuals:'Grafiskie elementi',images:'Attēli',tables:'Tabulas',charts:'Diagrammas',equations:'Vienādojumi'}, mt:{visuals:'Elementi grafiċi',images:'Immaġnijiet',tables:'Tabelli',charts:'Grafiċi',equations:'Ekwazzjonijiet'}, nl:{visuals:'Grafische elementen',images:'Afbeeldingen',tables:'Tabellen',charts:'Grafieken',equations:'Vergelijkingen'}, pl:{visuals:'Elementy graficzne',images:'Obrazy',tables:'Tabele',charts:'Wykresy',equations:'Równania'}, pt:{visuals:'Elementos gráficos',images:'Imagens',tables:'Tabelas',charts:'Gráficos',equations:'Equações'}, ro:{visuals:'Elemente grafice',images:'Imagini',tables:'Tabele',charts:'Diagrame',equations:'Ecuații'}, sk:{visuals:'Grafické prvky',images:'Obrázky',tables:'Tabuľky',charts:'Grafy',equations:'Rovnice'}, sl:{visuals:'Grafični elementi',images:'Slike',tables:'Tabele',charts:'Grafikoni',equations:'Enačbe'}, sv:{visuals:'Grafiska element',images:'Bilder',tables:'Tabeller',charts:'Diagram',equations:'Ekvationer'}
};

function getCopy(locale: string) {
  const extra = SCOPE_TRANSLATIONS[locale] ?? SCOPE_TRANSLATIONS.en;
  if (locale === 'hu') return { findTitle:'Keresés',replaceTitle:'Keresés és csere',findPlaceholder:'Keresés a kéziratban…',objectPlaceholder:'Szűrés felirat, fájlnév vagy tartalom szerint…',replacePlaceholder:'Csere erre…',replace:'Csere',replaceAll:'Összes cseréje',caseSensitive:'Kis-/nagybetű érzékeny',wholeWord:'Teljes szó',close:'Bezárás',previous:'Előző találat',next:'Következő találat',scope:'Hatókör',position:(c:number,t:number)=>`${c}/${t}`,location:(v:string)=>`Találat helye: ${v}`,scopes:{all:'Teljes kézirat',currentSection:'Aktuális fejezet',headings:'Címek',body:'Törzsszöveg',notes:'Jegyzetek',metadata:'Metaadatok',...extra} };
  if (locale === 'de') return { findTitle:'Suchen',replaceTitle:'Suchen und Ersetzen',findPlaceholder:'Im Manuskript suchen…',objectPlaceholder:'Nach Beschriftung, Dateiname oder Inhalt filtern…',replacePlaceholder:'Ersetzen durch…',replace:'Ersetzen',replaceAll:'Alle ersetzen',caseSensitive:'Groß-/Kleinschreibung',wholeWord:'Ganzes Wort',close:'Schließen',previous:'Vorheriger Treffer',next:'Nächster Treffer',scope:'Bereich',position:(c:number,t:number)=>`${c}/${t}`,location:(v:string)=>`Fundstelle: ${v}`,scopes:{all:'Gesamtes Manuskript',currentSection:'Aktueller Abschnitt',headings:'Überschriften',body:'Fließtext',notes:'Anmerkungen',metadata:'Metadaten',...extra} };
  return { findTitle:'Find',replaceTitle:'Find and replace',findPlaceholder:'Find in manuscript…',objectPlaceholder:'Filter by caption, filename, or content…',replacePlaceholder:'Replace with…',replace:'Replace',replaceAll:'Replace all',caseSensitive:'Match case',wholeWord:'Whole word',close:'Close',previous:'Previous match',next:'Next match',scope:'Scope',position:(c:number,t:number)=>`${c}/${t}`,location:(v:string)=>`Match location: ${v}`,scopes:{all:'Whole manuscript',currentSection:'Current section',headings:'Headings',body:'Body text',notes:'Notes',metadata:'Metadata',...extra} };
}