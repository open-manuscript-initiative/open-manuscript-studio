import {
  AlertTriangle,
  CircleX,
  FileUp,
  FolderOpen,
  LoaderCircle,
} from 'lucide-react';
import {
  useRef,
  useState,
} from 'react';

import {
  clearDocumentClosedState,
  isDocumentClosedState,
} from '../app/documentCloseState';
import { closeCurrentDocument } from '../app/documentLifecycle';
import { applyDocxImportPlan } from '../app/docxImportActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getDocxImportCopy } from '../i18n/docxImport';
import { getLocalFileLabels } from '../i18n/nativeStorageTranslations';
import { getStudioPlatform } from '../mobile/platform/platform';
import {
  isNativeStudio,
  openLocalManuscript,
} from '../services/nativeManuscriptFile';
import {
  parseDocxForStudio,
  type DocxImportStage,
} from '../services/docxImportStrategy';
import type { OmiManuscript } from '../types/omi';

interface DocxImportPanelProps {
  onImported?: () => void;
}

export function DocxImportPanel({ onImported }: DocxImportPanelProps) {
  const { locale } = useTranslation();
  const copy = getDocxImportCopy(locale);
  const description = getCurrentDocxImportDescription(locale);
  const platform = getStudioPlatform();
  const localFileLabels = getLocalFileLabels(locale, platform);
  const loadManuscript = useStudioStore((state) => state.loadManuscript);
  const inputRef = useRef<HTMLInputElement>(null);
  const omiInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [importStage, setImportStage] = useState<DocxImportStage | null>(null);
  const [largeDocumentMode, setLargeDocumentMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentMessage, setDocumentMessage] = useState('');
  const [documentClosed, setDocumentClosed] = useState(() => isDocumentClosedState());

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
      setDocumentClosed(false);
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

  async function openOmiDocument(file?: File): Promise<void> {
    setDocumentMessage('');
    try {
      if (isNativeStudio()) {
        const result = await openLocalManuscript();
        if (!result) return;
        loadManuscript(result.manuscript);
      } else {
        if (!file) {
          omiInputRef.current?.click();
          return;
        }
        const raw = await file.text();
        const parsed = JSON.parse(raw) as unknown;
        if (!isOmiManuscript(parsed)) {
          throw new Error(getInvalidDocumentMessage(locale));
        }
        loadManuscript(parsed);
      }

      clearDocumentClosedState();
      setDocumentClosed(false);
      setDocumentMessage(localFileLabels.opened);
    } catch (cause) {
      setDocumentMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (omiInputRef.current) omiInputRef.current.value = '';
    }
  }

  const closeCopy = getCloseDocumentCopy(locale);

  return (
    <>
      <section className="studio-tool-card" aria-label={localFileLabels.open}>
        <div>
          <strong>{localFileLabels.openTitle}</strong>
          <p>{localFileLabels.openDescription}</p>
          {documentMessage ? <p role="status" aria-live="polite">{documentMessage}</p> : null}
        </div>
        <div className="studio-tool-actions">
          <input
            ref={omiInputRef}
            type="file"
            accept=".omi.json,.json,application/json,application/vnd.openmanuscript+json"
            hidden
            onChange={(event) => void openOmiDocument(event.target.files?.[0])}
          />
          <button
            type="button"
            className="studio-menu-primary-action"
            onClick={() => void openOmiDocument()}
          >
            <FolderOpen size={16} aria-hidden="true" />
            {localFileLabels.open}
          </button>
          {!documentClosed ? (
            <button
              type="button"
              className="studio-menu-secondary-action studio-menu-danger-action"
              onClick={() => {
                if (window.confirm(closeCopy.confirm)) void closeCurrentDocument();
              }}
            >
              <CircleX size={16} aria-hidden="true" />
              {closeCopy.label}
            </button>
          ) : null}
        </div>
      </section>

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
    </>
  );
}

function isOmiManuscript(value: unknown): value is OmiManuscript {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OmiManuscript>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && Array.isArray(candidate.sections);
}

function getInvalidDocumentMessage(locale: string): string {
  if (locale === 'hu') return 'A kiválasztott fájl nem érvényes OMI-kézirat.';
  if (locale === 'de') return 'Die ausgewählte Datei ist kein gültiges OMI-Manuskript.';
  return 'The selected file is not a valid OMI manuscript.';
}

function getCloseDocumentCopy(locale: string) {
  if (locale === 'hu') return {
    label: 'Dokumentum bezárása',
    confirm: 'Bezárja az aktuális dokumentumot? A dokumentum kikerül a visszaállított munkamenetből. A külön fájlba vagy külső rendszerbe még el nem mentett tartalom elveszhet.',
  };
  if (locale === 'de') return {
    label: 'Dokument schließen',
    confirm: 'Aktuelles Dokument schließen? Es wird aus der wiederhergestellten Sitzung entfernt. Inhalte, die noch nicht in einer separaten Datei oder einem externen System gespeichert wurden, können verloren gehen.',
  };
  return {
    label: 'Close document',
    confirm: 'Close the current document? It will be removed from the restored session. Content not yet saved to a separate file or external system may be lost.',
  };
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
