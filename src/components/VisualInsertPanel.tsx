import {
  BarChart3,
  BookA,
  FileInput,
  FunctionSquare,
  ImagePlus,
  Images,
  ListPlus,
  ListTree,
  Table2,
} from 'lucide-react';
import {
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react';

import {
  externalizeBlocksForManuscript,
  stageAssetAttachments,
} from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { stageInsertBlocks } from '../app/visualBlockActions';
import { useTranslation } from '../i18n';
import { getVisualElementsCopy } from '../i18n/visualElements';
import type { OmiGeneratedListKind } from '../model/generatedLists';
import type { OmiTableOfContents } from '../model/tableOfContents';
import {
  createChartBlock,
  createEquationBlock,
  createTableBlock,
} from '../model/visualBlocks';
import {
  importVisualBlocksFromClipboardData,
  importVisualBlocksFromFile,
} from '../services/officeImport';

interface VisualInsertPanelProps {
  compact?: boolean;
  onInserted?: () => void;
}

/**
 * Visual elements target the selected semantic section. Generated lists remain
 * manuscript-level so they aggregate every independently edited study.
 */
export function VisualInsertPanel({
  compact = false,
  onInserted,
}: VisualInsertPanelProps) {
  const { locale, t } = useTranslation();
  const copy = getVisualElementsCopy(locale);
  const listCopy = getListInsertCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selectedSection =
    manuscript.sections.find((section) => section.id === selectedSectionId) ??
    manuscript.sections[0];

  if (!selectedSection) {
    return <p className="omi-empty-section">{t('studio.noSection')}</p>;
  }

  const gapIndex = selectedSection.blocks.length;

  function insert(blocks: Parameters<typeof stageInsertBlocks>[2]): boolean {
    const inserted = stageInsertBlocks(selectedSection.id, gapIndex, blocks);
    if (inserted) {
      setError(null);
      onInserted?.();
    }
    return inserted;
  }

  function persistGeneratedList(kind: OmiGeneratedListKind, title: string): void {
    useStudioStore.setState((state) => {
      const current = state.manuscript.generatedListDefinitions ?? [];
      const exists = kind === 'custom'
        ? current.some((item) => item.kind === kind && item.title === title)
        : current.some((item) => item.kind === kind);
      if (exists) return state;
      return {
        manuscript: {
          ...state.manuscript,
          generatedListDefinitions: [...current, { id: crypto.randomUUID(), kind, title }],
          updatedAt: new Date().toISOString(),
        },
      };
    });
    setError(null);
    onInserted?.();
  }

  function insertGeneratedList(kind: 'toc' | 'figures' | 'tables' | 'index'): void {
    if (kind === 'toc') {
      useStudioStore.setState((state) => {
        if (state.manuscript.tableOfContents) return state;
        const toc: OmiTableOfContents = {
          id: crypto.randomUUID(),
          title: listCopy.toc,
          minLevel: 1,
          maxLevel: 3,
          hyperlinks: true,
          useOutlineLevels: true,
          source: { format: 'manual' },
        };
        return {
          manuscript: {
            ...state.manuscript,
            tableOfContents: toc,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    }
    const title = kind === 'toc'
      ? listCopy.toc
      : kind === 'figures'
        ? listCopy.figures
        : kind === 'tables'
          ? listCopy.tables
          : listCopy.indexes;
    persistGeneratedList(kind, title);
  }

  function insertCustomList(): void {
    const title = window.prompt(listCopy.customPrompt)?.trim();
    if (!title) return;
    persistGeneratedList('custom', title);
  }

  async function insertImported(
    imported: Parameters<typeof stageInsertBlocks>[2],
  ): Promise<void> {
    const externalized = await externalizeBlocksForManuscript(
      manuscript.id,
      imported,
    );
    if (insert(externalized.blocks)) {
      stageAssetAttachments(externalized.assets);
    }
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      const imported = (
        await Promise.all(files.map((file) => importVisualBlocksFromFile(file)))
      ).flat();
      if (imported.length === 0) {
        setError(copy.noImportableElements);
        return;
      }
      await insertImported(imported);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : copy.importFailed);
    } finally {
      setBusy(false);
    }
  }

  async function paste(event: ClipboardEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const imported = await importVisualBlocksFromClipboardData(event.clipboardData);
      if (imported.length === 0) {
        setError(copy.noImportableElements);
        return;
      }
      await insertImported(imported);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : copy.importFailed);
    } finally {
      setBusy(false);
    }
  }

  const palette = (
    <>
      <div className="omi-visual-insert-actions">
        <button type="button" onClick={() => imageInputRef.current?.click()}>
          <ImagePlus size={17} aria-hidden="true" />
          {copy.image}
        </button>
        <button type="button" onClick={() => insert([createTableBlock()])}>
          <Table2 size={17} aria-hidden="true" />
          {copy.table}
        </button>
        <button type="button" onClick={() => insert([createChartBlock()])}>
          <BarChart3 size={17} aria-hidden="true" />
          {copy.chart}
        </button>
        <button type="button" onClick={() => insert([createEquationBlock()])}>
          <FunctionSquare size={17} aria-hidden="true" />
          {copy.equation}
        </button>
        <button type="button" onClick={() => importInputRef.current?.click()}>
          <FileInput size={17} aria-hidden="true" />
          {copy.import}
        </button>
      </div>

      <div className="omi-visual-format-hint"><strong>{listCopy.title}</strong></div>
      <div className="omi-visual-insert-actions">
        <button type="button" onClick={() => insertGeneratedList('toc')}>
          <ListTree size={17} aria-hidden="true" />
          {listCopy.toc}
        </button>
        <button type="button" onClick={() => insertGeneratedList('figures')}>
          <Images size={17} aria-hidden="true" />
          {listCopy.figures}
        </button>
        <button type="button" onClick={() => insertGeneratedList('tables')}>
          <Table2 size={17} aria-hidden="true" />
          {listCopy.tables}
        </button>
        <button type="button" onClick={() => insertGeneratedList('index')}>
          <BookA size={17} aria-hidden="true" />
          {listCopy.indexes}
        </button>
        <button type="button" onClick={insertCustomList}>
          <ListPlus size={17} aria-hidden="true" />
          {listCopy.custom}
        </button>
      </div>

      <div
        className="omi-office-paste-target"
        role="textbox"
        tabIndex={0}
        onPaste={paste}
        aria-label={copy.paste}
      >
        <strong>{busy ? copy.importing : copy.paste}</strong>
        <span>{copy.pasteHint}</span>
      </div>

      <small className="omi-visual-format-hint">{copy.fileFormats}</small>
      {error ? <p className="omi-visual-import-error" role="alert">{error}</p> : null}

      <input
        ref={imageInputRef}
        className="omi-visually-hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={importFiles}
      />
      <input
        ref={importInputRef}
        className="omi-visually-hidden-input"
        type="file"
        multiple
        accept=".docx,.xlsx,.csv,.tsv,.txt,.html,.htm,.tex,image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        onChange={importFiles}
      />
    </>
  );

  if (compact) {
    return (
      <div className="omi-visual-insert-palette omi-visual-insert-palette--compact">
        {palette}
      </div>
    );
  }

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{copy.insertElement}</h3>
          <p>{selectedSection.title}</p>
        </div>
      </div>

      <div className="omi-visual-insert-palette">{palette}</div>
    </section>
  );
}

function getListInsertCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Közös jegyzékek',
    toc: 'Tartalomjegyzék',
    figures: 'Képek jegyzéke',
    tables: 'Táblázatok jegyzéke',
    indexes: 'Mutató',
    custom: 'Egyéni jegyzék',
    customPrompt: 'Jegyzék neve',
  };
  if (locale === 'de') return {
    title: 'Gemeinsame Verzeichnisse',
    toc: 'Inhaltsverzeichnis',
    figures: 'Abbildungsverzeichnis',
    tables: 'Tabellenverzeichnis',
    indexes: 'Register',
    custom: 'Benutzerdefiniert',
    customPrompt: 'Name des Verzeichnisses',
  };
  return {
    title: 'Shared volume lists',
    toc: 'Table of contents',
    figures: 'List of figures',
    tables: 'List of tables',
    indexes: 'Index',
    custom: 'Custom list',
    customPrompt: 'List name',
  };
}
