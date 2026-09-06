import { Download, FileCode2, FileText, Printer } from 'lucide-react';
import { useState } from 'react';

import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { createPublisherExportStylesheet } from '../model/publisherExportStyle';
import { resolvePublicationProfile } from '../model/publicationProfile';
import { buildPublisherHtmlPackage } from '../services/exportPublisherHtmlPackage';
import {
  applyPdfInteractionMode,
  buildPdfPrintDocument,
  type PdfContentMode,
  type PdfExportMode,
} from '../services/exportPdf';
import {
  buildPublicationStyleCss,
  loadPublicationStyle,
  renderStyleBasedHtml,
} from '../services/publicationStyleExport';

export function PublicationStyleExportPanel() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [busy, setBusy] = useState<'pdf' | 'html' | null>(null);
  const [pdfContentMode, setPdfContentMode] = useState<PdfContentMode>('publication');
  const [pdfMode, setPdfMode] = useState<PdfExportMode>('print');
  const [message, setMessage] = useState('');
  const selectedContentDescription = pdfContentMode === 'publication'
    ? copy.pdfPublicationDescription
    : copy.pdfEditorialDescription;
  const selectedModeDescription = pdfMode === 'print'
    ? copy.pdfPrintDescription
    : copy.pdfInteractiveDescription;

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
      const html = pdfContentMode === 'publication'
        ? applyPdfInteractionMode(
            await renderStyleBasedHtml(committed, profile, 'print'),
            pdfMode,
            'publication',
          )
        : buildPdfPrintDocument(committed, profile, pdfMode, 'editorial');

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
            <strong>PDF / {copy.print}</strong>
            <p>{copy.pdfDescription}</p>
            <div className="studio-manuscript-fields">
              <label>
                <span>{copy.pdfContent}</span>
                <select value={pdfContentMode} disabled={busy !== null} onChange={(event) => setPdfContentMode(event.target.value as PdfContentMode)}>
                  <option value="publication">{copy.pdfPublication}</option>
                  <option value="editorial">{copy.pdfEditorial}</option>
                </select>
              </label>
              <label>
                <span>{copy.pdfMode}</span>
                <select value={pdfMode} disabled={busy !== null} onChange={(event) => setPdfMode(event.target.value as PdfExportMode)}>
                  <option value="print">{copy.pdfPrint}</option>
                  <option value="interactive">{copy.pdfInteractive}</option>
                </select>
              </label>
            </div>
            <p className="studio-settings-hint" data-pdf-content={pdfContentMode}>{selectedContentDescription}</p>
            <p className="studio-settings-hint" data-pdf-mode={pdfMode}>{selectedModeDescription}</p>
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
    title: 'Nyomtatás és export',
    description: 'Nyomtatás előtt kiválasztható a semleges szerkesztői kéziratnézet vagy az Élő kiadványszerkesztőben kialakított tördelt kiadvány.',
    print: 'nyomtatás',
    pdfDescription: 'A választott nézetet a rendszer nyomtatási/PDF párbeszédben nyitja meg, így közvetlenül nyomtatható vagy PDF-ként menthető.',
    pdfContent: 'Nyomtatási nézet',
    pdfPublication: 'Tördelt kiadvány',
    pdfEditorial: 'Nyers / szerkesztői',
    pdfPublicationDescription: 'A Stílus szerkesztőben látható WYSIWYG tördelést, oldalméretet, margókat, élőfejet, jegyzeteket és tördelési korrektúrákat használja.',
    pdfEditorialDescription: 'Semleges kéziratnyomat: a tartalmi szerkezet, jegyzetek és hivatkozások megmaradnak, a kiadói tipográfia és végleges oldaltördelés nem.',
    pdfMode: 'PDF változat',
    pdfPrint: 'Nyomtatott',
    pdfInteractive: 'Interaktív',
    pdfPrintDescription: 'A fizikai nyomtatásra és archiválásra szánt változat nem tartalmaz aktív hiperhivatkozásokat.',
    pdfInteractiveDescription: 'A belső és külső hivatkozások kattinthatók maradnak a PDF-ben.',
    htmlDescription: 'Folyamatos webes nézet ugyanazzal a tipográfiával, de élőfej, oldalszám, lapméret és oldaltörés nélkül.',
    exportPdf: 'Nyomtatás / PDF', exportHtml: 'HTML export', preparing: 'Előkészítés…', preparingPdf: 'Nyomtatási nézet előkészítése…',
    pdfReady: 'A nyomtatási/PDF párbeszéd megnyílt.', htmlReady: 'A stílusozott HTML-csomag elkészült.',
    popupBlocked: 'A böngésző blokkolta a nyomtatási/PDF ablakot. Engedélyezze a felugró ablakokat ehhez az oldalhoz.',
    exportError: 'A nyomtatási/export nézet nem készíthető el.',
    note: 'A tördelt változat a mentett kiadványstílus nyomdai geometriáját használja. A nyers/szerkesztői változat csak a dokumentum szemantikai szerkezetét és tartalmát formázza olvasható nyomattá.'
  };
  if (locale === 'de') return {
    title: 'Drucken und Exportieren', description: 'Vor dem Drucken kann zwischen einer neutralen redaktionellen Manuskriptansicht und der im Live-Publikationseditor gesetzten Publikation gewählt werden.',
    print: 'Drucken',
    pdfDescription: 'Die gewählte Ansicht wird im Druck-/PDF-Dialog geöffnet und kann direkt gedruckt oder als PDF gespeichert werden.',
    pdfContent: 'Druckansicht', pdfPublication: 'Gesetzte Publikation', pdfEditorial: 'Redaktionell / Manuskript',
    pdfPublicationDescription: 'Verwendet den im Stil-Editor sichtbaren WYSIWYG-Satz einschließlich Seitengröße, Rändern, Kolumnentiteln, Fußnoten und Satzkorrekturen.',
    pdfEditorialDescription: 'Neutraler Manuskriptausdruck: Struktur, Anmerkungen und Verweise bleiben erhalten, Verlagstypografie und endgültiger Satz werden nicht angewendet.',
    pdfMode: 'PDF-Variante', pdfPrint: 'Druck', pdfInteractive: 'Interaktiv',
    pdfPrintDescription: 'Die für physischen Druck und Archivierung bestimmte Variante enthält keine aktiven Hyperlinks.',
    pdfInteractiveDescription: 'Interne und externe Verweise bleiben im PDF anklickbar.',
    htmlDescription: 'Fortlaufende Webansicht mit derselben Typografie, jedoch ohne Kolumnentitel, Seitenzahlen, Seitengröße oder Seitenumbrüche.',
    exportPdf: 'Drucken / PDF', exportHtml: 'HTML exportieren', preparing: 'Wird vorbereitet…', preparingPdf: 'Druckansicht wird vorbereitet…',
    pdfReady: 'Der Druck-/PDF-Dialog wurde geöffnet.', htmlReady: 'Das formatierte HTML-Paket wurde erstellt.',
    popupBlocked: 'Das Druck-/PDF-Fenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite zulassen.', exportError: 'Die Druck-/Exportansicht konnte nicht erstellt werden.',
    note: 'Die gesetzte Variante verwendet die gespeicherte Druckgeometrie des Publikationsstils. Die redaktionelle Variante formatiert nur die semantische Struktur und den Inhalt als lesbaren Ausdruck.'
  };
  return {
    title: 'Print and export', description: 'Before printing, choose either a neutral editorial manuscript view or the typeset publication created in the Live Publication Editor.',
    print: 'print',
    pdfDescription: 'The selected view opens in the print/PDF dialog and can be printed directly or saved as PDF.',
    pdfContent: 'Print view', pdfPublication: 'Typeset publication', pdfEditorial: 'Editorial / manuscript',
    pdfPublicationDescription: 'Uses the WYSIWYG layout shown in the Style editor, including page size, margins, running headers, notes and typesetting corrections.',
    pdfEditorialDescription: 'Neutral manuscript print: structure, notes and references remain, while publisher typography and final pagination are not applied.',
    pdfMode: 'PDF variant', pdfPrint: 'Print', pdfInteractive: 'Interactive',
    pdfPrintDescription: 'The physical-print and archive variant contains no active hyperlinks.',
    pdfInteractiveDescription: 'Internal and external references remain clickable in the PDF.',
    htmlDescription: 'Continuous web view with the same typography, but no running header, page numbers, page size or page breaks.',
    exportPdf: 'Print / PDF', exportHtml: 'Export HTML', preparing: 'Preparing…', preparingPdf: 'Preparing print view…',
    pdfReady: 'The print/PDF dialog has opened.', htmlReady: 'The styled HTML package is ready.',
    popupBlocked: 'The browser blocked the print/PDF window. Allow pop-ups for this site and try again.', exportError: 'The print/export view could not be created.',
    note: 'The typeset variant uses the saved publication-style print geometry. The editorial variant formats only the document semantic structure and content as a readable printout.'
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
