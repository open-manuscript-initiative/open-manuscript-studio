import { Download, FileCode2, FileText, Printer } from 'lucide-react';
import { useState } from 'react';

import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { createPublisherExportStylesheet } from '../model/publisherExportStyle';
import { resolvePublicationProfile } from '../model/publicationProfile';
import { buildPublisherHtmlPackage } from '../services/exportPublisherHtmlPackage';
import {
  buildPublicationStyleCss,
  loadPublicationStyle,
  renderStyleBasedHtml,
} from '../services/publicationStyleExport';

export function PublicationStyleExportPanel() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [busy, setBusy] = useState<'pdf' | 'html' | null>(null);
  const [message, setMessage] = useState('');

  async function exportHtml(): Promise<void> {
    if (busy) return;
    setBusy('html');
    setMessage('');
    try {
      await externalizeActiveManuscriptAssets();
      checkpoint('export');
      const committed = useStudioStore.getState().manuscript;
      const profile = resolvePublicationProfile(committed);
      const style = loadPublicationStyle();
      const htmlCss = buildPublicationStyleCss(style, 'html');
      const styledProfile = {
        ...profile,
        exportStylesheet: createPublisherExportStylesheet(
          `${style.id}-html.css`,
          htmlCss,
        ),
      };
      const result = await buildPublisherHtmlPackage(committed, styledProfile);
      if (!result.validForExport) {
        setMessage(copy.exportError);
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName.replace(/\.html\.zip$/i, '.styled-html.zip');
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(copy.htmlReady);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.exportError);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf(): Promise<void> {
    if (busy) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setMessage(copy.popupBlocked);
      return;
    }

    showPreparingPdf(printWindow, copy.preparingPdf);
    setBusy('pdf');
    setMessage('');
    let printUrl: string | null = null;

    try {
      await externalizeActiveManuscriptAssets();
      checkpoint('export');
      const committed = useStudioStore.getState().manuscript;
      const profile = resolvePublicationProfile(committed);
      const html = await renderStyleBasedHtml(committed, profile, 'print');

      printUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      await navigatePrintWindow(printWindow, printUrl);

      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
        if (printUrl) URL.revokeObjectURL(printUrl);
      }, 350);
      setMessage(copy.pdfReady);
    } catch (error) {
      if (printUrl) URL.revokeObjectURL(printUrl);
      printWindow.close();
      setMessage(error instanceof Error ? error.message : copy.exportError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="publication-style-export-panel" aria-labelledby="publication-style-export-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="publication-style-export-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <Printer size={20} aria-hidden="true" />
      </div>

      <div className="publication-style-export-options">
        <article className="publication-style-export-option">
          <FileText size={22} aria-hidden="true" />
          <div>
            <strong>PDF</strong>
            <p>{copy.pdfDescription}</p>
          </div>
          <button type="button" className="studio-menu-primary-action" disabled={busy !== null} onClick={() => void exportPdf()}>
            <Download size={16} aria-hidden="true" />
            {busy === 'pdf' ? copy.preparing : copy.exportPdf}
          </button>
        </article>

        <article className="publication-style-export-option">
          <FileCode2 size={22} aria-hidden="true" />
          <div>
            <strong>HTML</strong>
            <p>{copy.htmlDescription}</p>
          </div>
          <button type="button" className="studio-menu-primary-action" disabled={busy !== null} onClick={() => void exportHtml()}>
            <Download size={16} aria-hidden="true" />
            {busy === 'html' ? copy.preparing : copy.exportHtml}
          </button>
        </article>
      </div>

      {message ? <p className="publication-style-export-message" role="status">{message}</p> : null}
      <p className="publication-style-export-note">{copy.note}</p>
    </section>
  );
}

function copyFor(locale: string) {
  if (locale === 'hu') return {
    title: 'Export a kiadványstílus alapján',
    description: 'A két export ugyanazokat a Stílus szerkesztőben mentett tipográfiai beállításokat használja.',
    pdfDescription: 'Nyomdai nézet: lapméret, margók, oldaltörések, élőfej és lapalji jegyzetek. A rendszer PDF/nyomtatási párbeszédet nyit.',
    htmlDescription: 'Folyamatos webes nézet ugyanazzal a tipográfiával, de élőfej, oldalszám, lapméret és oldaltörés nélkül.',
    exportPdf: 'PDF export', exportHtml: 'HTML export', preparing: 'Előkészítés…', preparingPdf: 'PDF előkészítése…',
    pdfReady: 'A nyomtatási/PDF párbeszéd megnyílt.', htmlReady: 'A stílusozott HTML-csomag elkészült.',
    popupBlocked: 'A böngésző blokkolta a PDF-ablakot. Engedélyezze a felugró ablakokat ehhez az oldalhoz.',
    exportError: 'Az export nem készíthető el.',
    note: 'A HTML export szándékosan nem tartalmaz nyomdai oldalszerkezetet. A PDF export a mentett stílus nyomdai geometriáját használja.'
  };
  if (locale === 'de') return {
    title: 'Export nach Publikationsstil', description: 'Beide Exporte verwenden die im Stil-Editor gespeicherten typografischen Einstellungen.',
    pdfDescription: 'Druckansicht mit Seitengröße, Rändern, Seitenumbrüchen, Kolumnentitel und Fußnoten. Öffnet den PDF-/Druckdialog.',
    htmlDescription: 'Fortlaufende Webansicht mit derselben Typografie, jedoch ohne Kolumnentitel, Seitenzahlen, Seitengröße oder Seitenumbrüche.',
    exportPdf: 'PDF exportieren', exportHtml: 'HTML exportieren', preparing: 'Wird vorbereitet…', preparingPdf: 'PDF wird vorbereitet…',
    pdfReady: 'Der Druck-/PDF-Dialog wurde geöffnet.', htmlReady: 'Das formatierte HTML-Paket wurde erstellt.',
    popupBlocked: 'Das PDF-Fenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite zulassen.', exportError: 'Der Export konnte nicht erstellt werden.',
    note: 'Der HTML-Export enthält bewusst keine Druckseitenstruktur. Der PDF-Export verwendet die gespeicherte Druckgeometrie.'
  };
  return {
    title: 'Export from publication style', description: 'Both exports use the typographic settings saved in the Publication Style editor.',
    pdfDescription: 'Print view with page size, margins, page breaks, running header and footnotes. Opens the PDF/print dialog.',
    htmlDescription: 'Continuous web view with the same typography, but no running header, page numbers, page size or page breaks.',
    exportPdf: 'Export PDF', exportHtml: 'Export HTML', preparing: 'Preparing…', preparingPdf: 'Preparing PDF…',
    pdfReady: 'The print/PDF dialog has opened.', htmlReady: 'The styled HTML package is ready.',
    popupBlocked: 'The browser blocked the PDF window. Allow pop-ups for this site and try again.', exportError: 'The export could not be created.',
    note: 'HTML intentionally has no print-page structure. PDF uses the saved publication-style page geometry.'
  };
}

function showPreparingPdf(target: Window, message: string): void {
  target.document.title = message;
  const paragraph = target.document.createElement('p');
  paragraph.style.fontFamily = 'sans-serif';
  paragraph.style.padding = '2rem';
  paragraph.textContent = message;
  target.document.body.replaceChildren(paragraph);
}

function navigatePrintWindow(target: Window, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Failed to load the generated print document.'));
    };
    const cleanup = () => {
      target.removeEventListener('load', handleLoad);
      target.removeEventListener('error', handleError);
    };

    target.addEventListener('load', handleLoad, { once: true });
    target.addEventListener('error', handleError, { once: true });
    target.location.replace(url);
  });
}
