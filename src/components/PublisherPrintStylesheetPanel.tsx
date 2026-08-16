import { FileDown, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';

import { stagePublicationProfileChange } from '../app/publicationProfileActions';
import { useTranslation } from '../i18n';
import { isPublisherProfileReadOnly } from '../model/publisherProfileProtection';
import {
  createPublisherPrintStylesheet,
  MAX_PUBLISHER_EXPORT_CSS_BYTES,
} from '../model/publisherExportStyle';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import { savePublisherProfile } from '../services/publisherProfileStorage';

const PRINT_CSS_TEMPLATE = `@page {
  /* size and margins come from the publisher profile unless overridden here */
}

@media print {
  .omi-scholarly-article {
    /* print-specific publisher rules */
  }

  h1, h2, h3, h4 {
    break-after: avoid;
  }

  figure, table, blockquote, pre {
    break-inside: avoid;
  }
}
`;

export function PublisherPrintStylesheetPanel({
  profile,
}: {
  profile: OmiPublicationProfile;
}) {
  const { locale } = useTranslation();
  const labels = copy(locale);
  const [fileName, setFileName] = useState(profile.printStylesheet?.fileName ?? 'publisher-print.css');
  const [cssText, setCssText] = useState(profile.printStylesheet?.cssText ?? '');
  const [message, setMessage] = useState('');
  const customProfile = profile.id.startsWith('publisher:');
  const readOnly = isPublisherProfileReadOnly(profile);

  useEffect(() => {
    setFileName(profile.printStylesheet?.fileName ?? 'publisher-print.css');
    setCssText(profile.printStylesheet?.cssText ?? '');
    setMessage('');
  }, [profile.id, profile.version, profile.printStylesheet?.addedAt]);

  function handleCssFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.css') && file.type !== 'text/css') {
      setMessage(labels.cssOnly);
      return;
    }
    if (file.size > MAX_PUBLISHER_EXPORT_CSS_BYTES) {
      setMessage(labels.tooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setCssText(String(reader.result ?? ''));
      setMessage('');
    };
    reader.readAsText(file);
  }

  function saveStylesheet() {
    if (!customProfile || readOnly || !cssText.trim()) return;
    try {
      const printStylesheet = createPublisherPrintStylesheet(fileName, cssText);
      const updated: OmiPublicationProfile = {
        ...profile,
        version: new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ''),
        printStylesheet,
      };
      savePublisherProfile(updated);
      stagePublicationProfileChange(updated);
      setMessage(labels.saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.failed);
    }
  }

  function removeStylesheet() {
    if (!customProfile || readOnly || !profile.printStylesheet) return;
    const updated: OmiPublicationProfile = {
      ...profile,
      version: new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ''),
      printStylesheet: undefined,
    };
    savePublisherProfile(updated);
    stagePublicationProfileChange(updated);
    setCssText('');
    setFileName('publisher-print.css');
    setMessage(labels.removed);
  }

  return (
    <section className="publisher-profile-editor" aria-labelledby="publisher-print-css-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="publisher-print-css-title"><FileDown size={17} aria-hidden="true" /> {labels.title}</h4>
          <p>{labels.description}</p>
        </div>
      </div>

      {!customProfile ? <div className="publication-profile-experimental-note">{labels.customRequired}</div> : null}
      {readOnly ? <div className="publication-profile-experimental-note">{labels.readOnly}</div> : null}

      <fieldset className="publisher-profile-editable-fields" disabled={!customProfile || readOnly}>
        <div className="publisher-profile-form-grid">
          <label className="publisher-profile-wide publisher-profile-logo-upload">
            <span>{labels.file}</span>
            <span className="publisher-profile-file-button"><Upload size={16} aria-hidden="true" />{labels.choose}</span>
            <input type="file" accept="text/css,.css" onChange={handleCssFile} />
            <small>{fileName} · {Math.ceil(new TextEncoder().encode(cssText).byteLength / 1024)} KB / {MAX_PUBLISHER_EXPORT_CSS_BYTES / 1024} KB</small>
          </label>
          <label className="publisher-profile-wide">
            <span>{labels.editor}</span>
            <textarea
              rows={14}
              value={cssText}
              spellCheck={false}
              onChange={(event) => setCssText(event.target.value)}
              placeholder={PRINT_CSS_TEMPLATE}
            />
          </label>
        </div>
        <p className="studio-settings-hint">{labels.hint}</p>
      </fieldset>

      <div className="publisher-profile-actions">
        <div>
          {profile.printStylesheet ? <code>{profile.printStylesheet.fileName}</code> : <span>{labels.none}</span>}
          {message ? <span role="status">{message}</span> : null}
        </div>
        <div className="publisher-profile-action-buttons">
          {!cssText.trim() && !profile.printStylesheet ? (
            <button type="button" className="studio-menu-secondary-action" disabled={!customProfile || readOnly} onClick={() => setCssText(PRINT_CSS_TEMPLATE)}>
              {labels.template}
            </button>
          ) : null}
          {profile.printStylesheet ? (
            <button type="button" className="studio-menu-secondary-action" disabled={!customProfile || readOnly} onClick={removeStylesheet}>
              <Trash2 size={16} aria-hidden="true" />{labels.remove}
            </button>
          ) : null}
          <button type="button" className="studio-menu-primary-action" disabled={!customProfile || readOnly || !cssText.trim()} onClick={saveStylesheet}>
            <Save size={16} aria-hidden="true" />{labels.save}
          </button>
        </div>
      </div>
    </section>
  );
}

function copy(locale: string) {
  if (locale === 'hu') return {
    title: 'Nyomtatási / PDF CSS',
    description: 'Adjon a kiadói profilhoz külön nyomtatási stílust. Az általános export CSS után töltődik be, ezért felülírhatja azt a PDF- és nyomtatási kimenetben.',
    customRequired: 'Nyomtatási CSS mentéséhez előbb mentsen és alkalmazzon egy saját kiadói profilt.',
    readOnly: 'Az írásvédett profil nyomtatási CSS-e nem módosítható. Készítsen új profilverziót.',
    file: 'Nyomtatási CSS-fájl', choose: 'CSS kiválasztása', editor: 'Nyomtatási CSS szerkesztése', cssOnly: 'Csak .css fájl tölthető fel.',
    tooLarge: 'A CSS-fájl legfeljebb 256 KB lehet.', save: 'Nyomtatási CSS mentése', saved: 'A nyomtatási CSS új profilverzióhoz mentve és alkalmazva.',
    failed: 'A nyomtatási CSS mentése nem sikerült.', remove: 'CSS eltávolítása', removed: 'A nyomtatási CSS eltávolítva az új profilverzióból.', none: 'Nincs kapcsolt nyomtatási CSS.', template: 'Minta beszúrása',
    hint: 'Támogatottak a szabványos nyomtatási szabályok, például @page, break-before, break-after és break-inside. A profil oldalmérete és margói automatikusan alapértékként kerülnek a PDF nézetbe; saját @page szabállyal felülírhatók.',
  };
  if (locale === 'de') return {
    title: 'Druck-/PDF-CSS',
    description: 'Fügen Sie dem Verlagsprofil einen eigenen Druckstil hinzu. Er wird nach dem allgemeinen Export-CSS geladen und kann dieses für PDF und Druck überschreiben.',
    customRequired: 'Speichern und aktivieren Sie zuerst ein eigenes Verlagsprofil, um Druck-CSS zu hinterlegen.',
    readOnly: 'Das Druck-CSS eines schreibgeschützten Profils kann nicht geändert werden. Erstellen Sie eine neue Profilversion.',
    file: 'Druck-CSS-Datei', choose: 'CSS auswählen', editor: 'Druck-CSS bearbeiten', cssOnly: 'Nur .css-Dateien können hochgeladen werden.',
    tooLarge: 'Die CSS-Datei darf höchstens 256 KB groß sein.', save: 'Druck-CSS speichern', saved: 'Druck-CSS in einer neuen Profilversion gespeichert und angewendet.',
    failed: 'Druck-CSS konnte nicht gespeichert werden.', remove: 'CSS entfernen', removed: 'Druck-CSS aus der neuen Profilversion entfernt.', none: 'Kein Druck-CSS verknüpft.', template: 'Vorlage einfügen',
    hint: 'Standard-Druckregeln wie @page, break-before, break-after und break-inside werden unterstützt. Seitengröße und Ränder des Profils werden automatisch als PDF-Grundwerte gesetzt und können durch eine eigene @page-Regel überschrieben werden.',
  };
  return {
    title: 'Print / PDF CSS',
    description: 'Attach a dedicated print stylesheet to the publisher profile. It loads after the general export CSS, so it can override that styling for PDF and print output.',
    customRequired: 'Save and apply a custom publisher profile before attaching print CSS.',
    readOnly: 'Print CSS on a read-only profile cannot be changed. Create a new profile version first.',
    file: 'Print CSS file', choose: 'Choose CSS', editor: 'Edit print CSS', cssOnly: 'Only .css files can be uploaded.',
    tooLarge: 'The CSS file must be 256 KB or smaller.', save: 'Save print CSS', saved: 'Print CSS saved in a new profile version and applied.',
    failed: 'Could not save print CSS.', remove: 'Remove CSS', removed: 'Print CSS removed in the new profile version.', none: 'No print CSS attached.', template: 'Insert template',
    hint: 'Standard print rules such as @page, break-before, break-after and break-inside are supported. Profile page size and margins are injected as PDF defaults and can be overridden with your own @page rule.',
  };
}
