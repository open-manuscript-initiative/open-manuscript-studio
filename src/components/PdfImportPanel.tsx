import { AlertTriangle, FileText, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';

import { clearDocumentClosedState } from '../app/documentCloseState';
import { applyPdfImportResult } from '../app/pdfImportActions';
import { useTranslation } from '../i18n';
import {
  importPdfForStudio,
  type PdfImportProgress,
  type PdfImportResult,
} from '../services/pdfImport';

interface PdfImportPanelProps {
  onImported?: () => void;
}

export function PdfImportPanel({ onImported }: PdfImportPanelProps) {
  const { locale } = useTranslation();
  const copy = getPdfImportCopy(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PdfImportProgress | null>(null);
  const [summary, setSummary] = useState<PdfImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file || busy) return;
    setBusy(true);
    setProgress({ status: 'queued', pagesProcessed: 0, pagesTotal: 0 });
    setSummary(null);
    setError(null);
    try {
      const result = await importPdfForStudio(file, setProgress);
      applyPdfImportResult(result);
      clearDocumentClosedState();
      setSummary(result);
      onImported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const progressText = progress && progress.pagesTotal > 0
    ? copy.progress(progress.pagesProcessed, progress.pagesTotal)
    : copy.processing;

  return (
    <section className="docx-import-card" aria-labelledby="pdf-import-title">
      <div className="docx-import-card-header">
        <div>
          <h4 id="pdf-import-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <FileText size={22} aria-hidden="true" />
      </div>

      <input
        ref={inputRef}
        className="docx-import-file-input"
        type="file"
        accept=".pdf,application/pdf"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        className="studio-menu-secondary-action"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <LoaderCircle className="docx-import-spinner" size={16} aria-hidden="true" />
        ) : (
          <FileText size={16} aria-hidden="true" />
        )}
        {busy ? copy.processing : copy.chooseFile}
      </button>

      {busy ? (
        <p className="docx-import-hint" role="status" aria-live="polite">
          {progressText}
        </p>
      ) : null}

      {summary ? (
        <p className="docx-import-hint" role="status" aria-live="polite">
          {copy.summary(summary)}
        </p>
      ) : null}

      {summary?.warnings.length ? (
        <div className="docx-import-error" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{copy.reviewWarnings(summary.warnings.length)}</span>
        </div>
      ) : null}

      {error ? (
        <div className="docx-import-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  );
}

function getPdfImportCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') {
    return {
      title: 'PDF importálása',
      description: 'Szöveges PDF megnyitása szerkeszthető OMI-kéziratként. A Studio rekonstruálja az olvasási sorrendet, bekezdéseket, címsorokat, futófejeket és valószínű lábjegyzeteket.',
      chooseFile: 'PDF kiválasztása',
      processing: 'PDF feldolgozása…',
      progress: (done: number, total: number) => `PDF feldolgozása: ${done}/${total} oldal`,
      summary: (result: PdfImportResult) => `${result.source.pageCount} oldal · ${result.stats.headings} címsor · ${result.stats.paragraphs} bekezdés · ${result.stats.footnotes} lehetséges lábjegyzet`,
      reviewWarnings: (count: number) => `${count} bizonytalan importelem ellenőrzése javasolt.`,
    };
  }
  if (language === 'de') {
    return {
      title: 'PDF importieren',
      description: 'Ein textbasiertes PDF als bearbeitbares OMI-Manuskript öffnen. Studio rekonstruiert Lesereihenfolge, Absätze, Überschriften, Kolumnentitel und wahrscheinliche Fußnoten.',
      chooseFile: 'PDF auswählen',
      processing: 'PDF wird verarbeitet…',
      progress: (done: number, total: number) => `PDF wird verarbeitet: ${done}/${total} Seiten`,
      summary: (result: PdfImportResult) => `${result.source.pageCount} Seiten · ${result.stats.headings} Überschriften · ${result.stats.paragraphs} Absätze · ${result.stats.footnotes} mögliche Fußnoten`,
      reviewWarnings: (count: number) => `${count} unsichere Importelemente sollten geprüft werden.`,
    };
  }
  return {
    title: 'Import PDF',
    description: 'Open a text-based PDF as an editable OMI manuscript. Studio reconstructs reading order, paragraphs, headings, running headers and probable footnotes.',
    chooseFile: 'Choose PDF',
    processing: 'Processing PDF…',
    progress: (done: number, total: number) => `Processing PDF: ${done}/${total} pages`,
    summary: (result: PdfImportResult) => `${result.source.pageCount} pages · ${result.stats.headings} headings · ${result.stats.paragraphs} paragraphs · ${result.stats.footnotes} probable footnotes`,
    reviewWarnings: (count: number) => `${count} uncertain import items should be reviewed.`,
  };
}
