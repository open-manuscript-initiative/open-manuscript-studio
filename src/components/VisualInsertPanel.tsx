import {
  BarChart3,
  FileInput,
  FunctionSquare,
  ImagePlus,
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
 * Inserts visual/document elements outside the manuscript surface. For now,
 * insertion targets the end of the selected section; once the manuscript uses
 * one Tiptap document this can consume the exact editor cursor position.
 */
export function VisualInsertPanel({
  compact = false,
  onInserted,
}: VisualInsertPanelProps) {
  const { locale, t } = useTranslation();
  const copy = getVisualElementsCopy(locale);
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
