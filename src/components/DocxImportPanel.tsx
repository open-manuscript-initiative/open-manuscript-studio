import {
  AlertTriangle,
  FileUp,
  LoaderCircle,
} from 'lucide-react';
import {
  useRef,
  useState,
} from 'react';

import { clearDocumentClosedState } from '../app/documentCloseState';
import { applyDocxImportPlan } from '../app/docxImportActions';
import { useTranslation } from '../i18n';
import { getDocxImportCopy } from '../i18n/docxImport';
import {
  parseDocxForStudio,
  type DocxImportStage,
} from '../services/docxImportStrategy';
import { PdfImportPanel } from './PdfImportPanel';

interface DocxImportPanelProps {
  onImported?: () => void;
}

export function DocxImportPanel({ onImported }: DocxImportPanelProps) {
  const { locale } = useTranslation();
  const copy = getDocxImportCopy(locale);
  const description = getCurrentDocxImportDescription(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [importStage, setImportStage] = useState<DocxImportStage | null>(null);
  const [largeDocumentMode, setLargeDocumentMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file || parsing) return;
    setParsing(true);
    setImportStage('preparing');
    setLargeDocumentMode(false);
    setError(null);

    try {
      await yieldToBrowser();
      const plan = await parseDocxForStudio(file, {
        onProgress: ({ stage, largeDocumentMode: large }) => {
          setImportStage(stage);
          setLargeDocumentMode(large);
        },
      });
      await yieldToBrowser();

      applyDocxImportPlan(plan, {
        importDetectedAuthors: plan.authors.length > 0,
      });
      clearDocumentClosedState();
      onImported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setParsing(false);
      setImportStage(null);
      setLargeDocumentMode(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <section className="docx-import-card" aria-labelledby="docx-import-title">
        <div className="docx-import-card-header">
          <div>
            <h4 id="docx-import-title">{copy.title}</h4>
            <p>{description}</p>
          </div>
          <FileUp size={22} aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          className="docx-import-file-input"
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        <button
          type="button"
          className="studio-menu-secondary-action"
          disabled={parsing}
          onClick={() => inputRef.current?.click()}
        >
          {parsing ? (
            <LoaderCircle className="docx-import-spinner" size={16} aria-hidden="true" />
          ) : (
            <FileUp size={16} aria-hidden="true" />
          )}
          {parsing ? copy.parsing : copy.chooseFile}
        </button>

        {parsing ? (
          <p
            className="docx-import-hint"
            role="status"
            aria-live="polite"
            data-import-stage={importStage ?? undefined}
            data-large-document-mode={largeDocumentMode ? 'true' : undefined}
          >
            {copy.parsing}
          </p>
        ) : null}

        {error ? (
          <div className="docx-import-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
      </section>
      <PdfImportPanel onImported={onImported} />
    </>
  );
}

function getCurrentDocxImportDescription(locale: string): string {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') {
    return 'Word-kézirat megnyitása új, szerkeszthető OMI-kéziratként, a dokumentumszerkezet, metaadatok, jegyzetek, képek, táblázatok, egyenletek és támogatott hivatkozások felismerésével.';
  }
  if (language === 'de') {
    return 'Ein Word-Manuskript als neues, bearbeitbares OMI-Manuskript öffnen; Dokumentstruktur, Metadaten, Anmerkungen, Bilder, Tabellen, Gleichungen und unterstützte Verweise werden dabei erkannt.';
  }
  return 'Open a Word manuscript as a new editable OMI manuscript, detecting document structure, metadata, notes, images, tables, equations, and supported references.';
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => window.setTimeout(resolve, 0));
      return;
    }
    window.setTimeout(resolve, 0);
  });
}
