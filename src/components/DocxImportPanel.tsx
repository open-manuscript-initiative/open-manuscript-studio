import {
  AlertTriangle,
  FileUp,
  LoaderCircle,
} from 'lucide-react';
import {
  useRef,
  useState,
} from 'react';

import { applyDocxImportPlan } from '../app/docxImportActions';
import { useTranslation } from '../i18n';
import { getDocxImportCopy } from '../i18n/docxImport';
import { parseDocxManuscriptWithInlineSemantics } from '../services/docxInlineSemanticsImport';

interface DocxImportPanelProps {
  onImported?: () => void;
}

export function DocxImportPanel({ onImported }: DocxImportPanelProps) {
  const { locale } = useTranslation();
  const copy = getDocxImportCopy(locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file || parsing) return;
    setParsing(true);
    setError(null);

    try {
      // Let the file-picker event finish and allow the busy state to paint before
      // the CPU-intensive Open XML parsing starts.
      await yieldToBrowser();
      const plan = await parseDocxManuscriptWithInlineSemantics(file);
      await yieldToBrowser();

      // A DOCX import is already defined as a new OMI manuscript/revision root.
      // Open it immediately instead of asking the user to confirm a second time.
      applyDocxImportPlan(plan, {
        importDetectedAuthors: plan.authors.length > 0,
      });
      onImported?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="docx-import-card" aria-labelledby="docx-import-title">
      <div className="docx-import-card-header">
        <div>
          <h4 id="docx-import-title">{copy.title}</h4>
          <p>{copy.description}</p>
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
        <p className="docx-import-hint" role="status" aria-live="polite">
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
  );
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
