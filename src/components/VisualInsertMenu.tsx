import {
  BarChart3,
  FileInput,
  FunctionSquare,
  ImagePlus,
  Plus,
  Table2,
  X,
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

interface VisualInsertMenuProps {
  sectionId: string;
  gapIndex: number;
}

export function VisualInsertMenu({
  sectionId,
  gapIndex,
}: VisualInsertMenuProps) {
  const { locale } = useTranslation();
  const copy = getVisualElementsCopy(locale);
  const manuscriptId = useStudioStore((state) => state.manuscript.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function insert(blocks: Parameters<typeof stageInsertBlocks>[2]): boolean {
    const inserted = stageInsertBlocks(sectionId, gapIndex, blocks);
    if (inserted) {
      setOpen(false);
      setError(null);
    }
    return inserted;
  }

  async function insertImported(
    imported: Parameters<typeof stageInsertBlocks>[2],
  ): Promise<void> {
    const externalized = await externalizeBlocksForManuscript(
      manuscriptId,
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

  return (
    <div className="omi-visual-insert-gap">
      <button
        type="button"
        className="omi-visual-insert-trigger"
        onClick={() => {
          setOpen((current) => !current);
          setError(null);
        }}
        aria-expanded={open}
      >
        {open ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
        <span>{copy.insertElement}</span>
      </button>

      {open ? (
        <div className="omi-visual-insert-palette">
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
        </div>
      ) : null}

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
    </div>
  );
}
