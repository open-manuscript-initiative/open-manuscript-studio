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
import type { DocxManuscriptImportPlan } from '../services/docxManuscriptImport';
import { applyDocxImportPlan } from '../app/docxImportActions';
import { useTranslation } from '../i18n';
import { getDocxImportCopy } from '../i18n/docxImport';
import {
  parseDocxForStudio,
  type DocxImportStage,
} from '../services/docxImportStrategy';
import { PdfImportPanel } from './PdfImportPanel';
import { ExternalDocumentSourceReview } from './ExternalDocumentSourceReview';
import { ExchangeReportView } from './ExchangeReportView';
import { OfficeImportPreparationError, prepareOfficeImport, type OfficeImportReceipt } from '../services/exchangeSession';
import { finishExchangeReport } from '../model/exchange';
import { useStudioStore } from '../app/useStudioStore';
import { exchangeCopy } from '../i18n/exchange';

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
  const [pendingPlan, setPendingPlan] = useState<DocxManuscriptImportPlan | null>(null);
  const [source, setSource] = useState('');
  const [selfAuthoredExternal, setSelfAuthoredExternal] = useState(false);
  const [receipt, setReceipt] = useState<OfficeImportReceipt | null>(null);
  const base = useRef(useStudioStore.getState().manuscript);
  const [failedReceipt, setFailedReceipt] = useState<OfficeImportPreparationError | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file || parsing) return;
    setParsing(true);
    setImportStage('preparing');
    setLargeDocumentMode(false);
    setError(null);
    setPendingPlan(null);
    setReceipt(null); setFailedReceipt(null);
    base.current = useStudioStore.getState().manuscript;
    setSelfAuthoredExternal(false);

    try {
      await yieldToBrowser();
      const prepared = await prepareOfficeImport(file, 'docx', (input) => parseDocxForStudio(input, {
        onProgress: ({ stage, largeDocumentMode: large }) => {
          setImportStage(stage);
          setLargeDocumentMode(large);
        },
      }));
      const plan = prepared.plan;
      await yieldToBrowser();

      setPendingPlan(plan);
      setReceipt(prepared);
      setSource(plan.fileName);
    } catch (cause) {
      if (cause instanceof OfficeImportPreparationError) setFailedReceipt(cause);
      setError(cause instanceof OfficeImportPreparationError ? exchangeCopy(locale).failed : cause instanceof Error ? cause.message : String(cause));
    } finally {
      setParsing(false);
      setImportStage(null);
      setLargeDocumentMode(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function confirmImport(): void {
    if (!pendingPlan || (!selfAuthoredExternal && !source.trim())) return;
    try {
      if (base.current !== useStudioStore.getState().manuscript) throw new Error(exchangeCopy(locale).changed);
      applyDocxImportPlan(pendingPlan, {
        importDetectedAuthors: pendingPlan.authors.length > 0,
        source,
        selfAuthoredExternal,
      });
      if (receipt) setReceipt({ ...receipt, report: finishExchangeReport(receipt.report,
        new TextEncoder().encode(JSON.stringify(useStudioStore.getState().manuscript))) });
      setPendingPlan(null);
      clearDocumentClosedState();
      onImported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
      {failedReceipt ? <ExchangeReportView report={failedReceipt.report} original={failedReceipt.original} /> : null}
      {receipt ? <ExchangeReportView report={receipt.report} original={receipt.original} /> : null}
      {pendingPlan && <ExternalDocumentSourceReview
        key={pendingPlan.fileName}
        locale={locale}
        summary={pendingPlan.title}
        source={source}
        selfAuthoredExternal={selfAuthoredExternal}
        onSelfAuthoredExternalChange={setSelfAuthoredExternal}
        onSourceChange={setSource}
        onConfirm={confirmImport}
        onCancel={() => { setPendingPlan(null); setSource(''); if (receipt) setReceipt({ ...receipt, report: { ...receipt.report, status: 'cancelled' } }); }}
      />}
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
