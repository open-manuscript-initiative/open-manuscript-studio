import {
  Archive,
  Braces,
  FileCode2,
  FileText,
  FileType2,
  Printer,
  TabletSmartphone,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { getExportFormatCopy } from '../i18n/exportFormats';
import { useTranslation } from '../i18n';
import { buildDocxExport } from '../services/exportDocx';
import { buildEpubExport } from '../services/exportEpub';
import { renderHtmlArticle, htmlFileName } from '../services/exportHtml';
import { renderJatsArticle, jatsFileName } from '../services/exportJats';
import { downloadOmiJson } from '../services/exportOmi';
import { buildOmiContainer } from '../services/omiContainer';
import { openPdfPrintView } from '../services/exportPdf';

type ExportId = 'omi' | 'omi-json' | 'jats' | 'html' | 'docx' | 'epub' | 'pdf';

export function ExportFormatsPanel() {
  const { locale } = useTranslation();
  const copy = getExportFormatCopy(locale);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [busy, setBusy] = useState<ExportId | null>(null);
  const [error, setError] = useState('');

  const run = async (id: ExportId): Promise<void> => {
    setError('');
    setBusy(id);
    try {
      checkpoint('export');
      const manuscript = useStudioStore.getState().manuscript;
      switch (id) {
        case 'omi': {
          const result = await buildOmiContainer(manuscript);
          if (!result.validForExport) {
            throw new Error(result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('\n'));
          }
          downloadBlob(result.blob, result.fileName);
          break;
        }
        case 'omi-json':
          downloadOmiJson(manuscript);
          break;
        case 'jats': {
          const result = renderJatsArticle(manuscript);
          if (!result.validForExport) {
            throw new Error(result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('\n'));
          }
          downloadText(result.xml, jatsFileName(manuscript), 'application/xml;charset=utf-8');
          break;
        }
        case 'html': {
          const result = renderHtmlArticle(manuscript);
          if (!result.validForExport) {
            throw new Error(result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('\n'));
          }
          downloadText(result.html, htmlFileName(manuscript), 'text/html;charset=utf-8');
          break;
        }
        case 'docx': {
          const result = buildDocxExport(manuscript);
          downloadBlob(result.blob, result.fileName);
          break;
        }
        case 'epub': {
          const result = buildEpubExport(manuscript);
          downloadBlob(result.blob, result.fileName);
          break;
        }
        case 'pdf':
          openPdfPrintView(manuscript);
          break;
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : copy.failed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="studio-export-formats" aria-labelledby="studio-export-formats-title">
      <div className="studio-settings-card-header">
        <div>
          <h4 id="studio-export-formats-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <ExportGroup title={copy.portable}>
        <ExportCard icon={<Archive size={19} aria-hidden="true" />} title={copy.omi} description={copy.omiDescription} busy={busy === 'omi'} action={copy.export} preparing={copy.preparing} onClick={() => void run('omi')} />
        <ExportCard icon={<Braces size={19} aria-hidden="true" />} title={copy.omiJson} description={copy.omiJsonDescription} busy={busy === 'omi-json'} action={copy.export} preparing={copy.preparing} onClick={() => void run('omi-json')} />
      </ExportGroup>

      <ExportGroup title={copy.publication}>
        <ExportCard icon={<FileCode2 size={19} aria-hidden="true" />} title={copy.jats} description={copy.jatsDescription} busy={busy === 'jats'} action={copy.export} preparing={copy.preparing} onClick={() => void run('jats')} />
        <ExportCard icon={<FileText size={19} aria-hidden="true" />} title={copy.html} description={copy.htmlDescription} busy={busy === 'html'} action={copy.export} preparing={copy.preparing} onClick={() => void run('html')} />
        <ExportCard icon={<FileType2 size={19} aria-hidden="true" />} title={copy.docx} description={copy.docxDescription} busy={busy === 'docx'} action={copy.export} preparing={copy.preparing} onClick={() => void run('docx')} />
        <ExportCard icon={<TabletSmartphone size={19} aria-hidden="true" />} title={copy.epub} description={copy.epubDescription} busy={busy === 'epub'} action={copy.export} preparing={copy.preparing} onClick={() => void run('epub')} />
        <ExportCard icon={<Printer size={19} aria-hidden="true" />} title={copy.pdf} description={`${copy.pdfDescription} ${copy.pdfHint}`} busy={busy === 'pdf'} action={copy.export} preparing={copy.preparing} onClick={() => void run('pdf')} />
      </ExportGroup>

      {error ? <div className="studio-export-error" role="alert">{error}</div> : null}
    </section>
  );
}

function ExportGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="studio-export-group">
      <h5>{title}</h5>
      <div className="studio-export-grid">{children}</div>
    </section>
  );
}

function ExportCard({ icon, title, description, busy, action, preparing, onClick }: {
  icon: ReactNode;
  title: string;
  description: string;
  busy: boolean;
  action: string;
  preparing: string;
  onClick: () => void;
}) {
  return (
    <article className="studio-export-card">
      <div className="studio-export-card-copy">
        <span className="studio-export-card-icon">{icon}</span>
        <div><strong>{title}</strong><p>{description}</p></div>
      </div>
      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={onClick}>
        {busy ? preparing : action}
      </button>
    </article>
  );
}

function downloadText(value: string, fileName: string, mediaType: string): void {
  downloadBlob(new Blob([value], { type: mediaType }), fileName);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
