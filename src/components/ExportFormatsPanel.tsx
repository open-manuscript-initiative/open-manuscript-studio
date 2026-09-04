import { useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getExportFormatCopy } from '../i18n/exportFormats';
import { getStudioPlatform } from '../mobile/platform/platform';
import { buildDocxExport } from '../services/exportDocx';
import { buildEpubExport } from '../services/exportEpub';
import { saveExportBlob, saveExportText, type ExportDeliveryResult } from '../services/exportFileDelivery';
import { buildHtmlPackage } from '../services/exportHtmlPackage';
import { buildIdmlExport } from '../services/exportIdml';
import { jatsFileName, renderJatsArticle } from '../services/exportJats';
import { buildLatexExport } from '../services/exportLatex';
import { buildMifExport } from '../services/exportMif';
import { omiJsonFileName, serializeOmiJson } from '../services/exportOmi';
import { openPdfPrintView } from '../services/exportPdf';
import { buildSlaExport } from '../services/exportSla';
import { buildXtgExport } from '../services/exportXtg';
import { buildOmiContainer } from '../services/omiContainer';
import { CustomExportPanel } from './CustomExportPanel';
import { LongTaskStatus } from './LongTaskStatus';

type ExportId = 'omi' | 'omi-json' | 'jats' | 'html' | 'docx' | 'idml' | 'xtg' | 'mif' | 'sla' | 'latex' | 'epub' | 'pdf' | 'custom';
type ExportGroupId = 'portable' | 'publication';

interface ExportFormatOption {
  id: ExportId;
  group: ExportGroupId;
  label: string;
  description: string;
  extension: string;
}

const MOBILE_EXPORT_IDS: ReadonlySet<ExportId> = new Set([
  'omi', 'omi-json', 'jats', 'html', 'docx', 'latex', 'epub', 'custom',
]);

export function ExportFormatsPanel() {
  const { locale } = useTranslation();
  const copy = getExportFormatCopy(locale);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const platform = getStudioPlatform();
  const mobile = platform === 'android' || platform === 'ios';
  const [selectedId, setSelectedId] = useState<ExportId | ''>('');
  const [busy, setBusy] = useState<ExportId | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const customCopy = locale === 'hu'
    ? { label: 'Egyéni export', description: 'Rendezhető, opcionális blokkokból összeállított DOCX, PDF vagy HTML kimenet.' }
    : locale === 'de'
      ? { label: 'Benutzerdefinierter Export', description: 'DOCX-, PDF- oder HTML-Ausgabe aus sortierbaren optionalen Blöcken.' }
      : { label: 'Custom export', description: 'DOCX, PDF or HTML output built from reorderable optional blocks.' };

  const formats: ExportFormatOption[] = [
    { id: 'omi', group: 'portable', label: copy.omi, description: copy.omiDescription, extension: '.omi.zip' },
    { id: 'omi-json', group: 'portable', label: copy.omiJson, description: copy.omiJsonDescription, extension: '.omi.json' },
    { id: 'jats', group: 'publication', label: copy.jats, description: copy.jatsDescription, extension: '.xml' },
    { id: 'html', group: 'publication', label: copy.html, description: copy.htmlDescription, extension: '.html.zip' },
    { id: 'docx', group: 'publication', label: copy.docx, description: copy.docxDescription, extension: '.docx' },
    { id: 'custom', group: 'publication', label: customCopy.label, description: customCopy.description, extension: 'DOCX / PDF / HTML' },
    { id: 'idml', group: 'publication', label: copy.idml, description: copy.idmlDescription, extension: '.idml' },
    { id: 'xtg', group: 'publication', label: copy.xtg, description: copy.xtgDescription, extension: '.xtg' },
    { id: 'mif', group: 'publication', label: copy.mif, description: copy.mifDescription, extension: '.mif' },
    { id: 'sla', group: 'publication', label: copy.sla, description: copy.slaDescription, extension: '.sla' },
    { id: 'latex', group: 'publication', label: copy.latex, description: copy.latexDescription, extension: '.tex' },
    { id: 'epub', group: 'publication', label: copy.epub, description: copy.epubDescription, extension: '.epub' },
    { id: 'pdf', group: 'publication', label: copy.pdf, description: `${copy.pdfDescription} ${copy.pdfHint}`, extension: '.pdf' },
  ];
  const visibleFormats = mobile ? formats.filter((format) => MOBILE_EXPORT_IDS.has(format.id)) : formats;
  const selectedFormat = selectedId ? visibleFormats.find((format) => format.id === selectedId) ?? null : null;
  const busyFormat = busy ? visibleFormats.find((format) => format.id === busy) ?? null : null;

  const reportDelivery = (delivery: ExportDeliveryResult): void => {
    if (!delivery.saved) {
      setNotice(copy.cancelled);
      return;
    }
    setNotice(delivery.path ? `${copy.saved} ${delivery.path}` : copy.saved);
  };

  const run = async (id: Exclude<ExportId, 'custom'>): Promise<void> => {
    if (mobile && !MOBILE_EXPORT_IDS.has(id)) return;
    setError('');
    setNotice('');
    setBusy(id);
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    try {
      checkpoint('export');
      const manuscript = useStudioStore.getState().manuscript;
      switch (id) {
        case 'omi': {
          const result = await buildOmiContainer(manuscript);
          if (!result.validForExport) throw new Error(result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('\n'));
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'omi-json':
          reportDelivery(await saveExportText(serializeOmiJson(manuscript), omiJsonFileName(manuscript), 'application/vnd.openmanuscript+json;charset=utf-8'));
          break;
        case 'jats': {
          const result = renderJatsArticle(manuscript);
          if (!result.validForExport) throw new Error(result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('\n'));
          reportDelivery(await saveExportText(result.xml, jatsFileName(manuscript), 'application/xml;charset=utf-8'));
          break;
        }
        case 'html': {
          const result = await buildHtmlPackage(manuscript);
          if (!result.validForExport) throw new Error(result.diagnostics.filter((item) => item.severity === 'error').map((item) => item.message).join('\n'));
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'docx': {
          const result = buildDocxExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'idml': {
          const result = buildIdmlExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'xtg': {
          const result = buildXtgExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'mif': {
          const result = buildMifExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'sla': {
          const result = buildSlaExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'latex': {
          const result = buildLatexExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
          break;
        }
        case 'epub': {
          const result = buildEpubExport(manuscript);
          reportDelivery(await saveExportBlob(result.blob, result.fileName));
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
    <section className="studio-export-formats" aria-labelledby="studio-export-formats-title" aria-busy={busy !== null}>
      <div className="studio-settings-card-header"><div><h4 id="studio-export-formats-title">{copy.title}</h4><p>{copy.description}</p></div></div>
      <div className="studio-manuscript-fields">
        <label><span>{copy.format}</span><select value={selectedId} disabled={busy !== null} onChange={(event) => { setSelectedId(event.target.value as ExportId | ''); setError(''); setNotice(''); }}>
          <option value="">{copy.chooseFormat}</option>
          <optgroup label={copy.portable}>{visibleFormats.filter((format) => format.group === 'portable').map((format) => <option value={format.id} key={format.id}>{format.label} ({format.extension})</option>)}</optgroup>
          <optgroup label={copy.publication}>{visibleFormats.filter((format) => format.group === 'publication').map((format) => <option value={format.id} key={format.id}>{format.label} ({format.extension})</option>)}</optgroup>
        </select></label>
      </div>
      {selectedFormat ? <div className="studio-settings-hint"><strong>{selectedFormat.label}</strong><p>{selectedFormat.description}</p></div> : null}
      {selectedId === 'custom' ? <CustomExportPanel /> : (
        <div className="studio-tool-actions"><button type="button" className="studio-menu-primary-action" disabled={!selectedId || busy !== null} onClick={() => { if (selectedId) void run(selectedId); }}>{busy ? copy.preparing : copy.export}</button></div>
      )}
      {busy ? <LongTaskStatus message={busyFormat ? `${busyFormat.label} — ${copy.preparing}` : copy.preparing} /> : null}
      {notice ? <p className="studio-settings-hint" role="status">{notice}</p> : null}
      {error ? <div className="studio-export-error" role="alert">{error}</div> : null}
    </section>
  );
}
