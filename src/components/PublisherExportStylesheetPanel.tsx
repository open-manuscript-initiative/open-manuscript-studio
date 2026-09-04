import { FileCode2, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';

import { stagePublicationProfileChange } from '../app/publicationProfileActions';
import { useTranslation } from '../i18n';
import { isPublisherProfileReadOnly } from '../model/publisherProfileProtection';
import {
  createPublisherExportStylesheet,
  MAX_PUBLISHER_EXPORT_CSS_BYTES,
} from '../model/publisherExportStyle';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import { savePublisherProfile } from '../services/publisherProfileStorage';

export function PublisherExportStylesheetPanel({
  profile,
}: {
  profile: OmiPublicationProfile;
}) {
  const { locale } = useTranslation();
  const labels = copy(locale);
  const [fileName, setFileName] = useState(profile.exportStylesheet?.fileName ?? 'publisher.css');
  const [cssText, setCssText] = useState(profile.exportStylesheet?.cssText ?? '');
  const [message, setMessage] = useState('');
  const customProfile = profile.id.startsWith('publisher:');
  const readOnly = isPublisherProfileReadOnly(profile);

  useEffect(() => {
    setFileName(profile.exportStylesheet?.fileName ?? 'publisher.css');
    setCssText(profile.exportStylesheet?.cssText ?? '');
    setMessage('');
  }, [
    profile.id,
    profile.version,
    profile.exportStylesheet?.addedAt,
    profile.exportStylesheet?.cssText,
    profile.exportStylesheet?.fileName,
  ]);

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
      const exportStylesheet = createPublisherExportStylesheet(fileName, cssText);
      const updated: OmiPublicationProfile = {
        ...profile,
        version: new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ''),
        exportStylesheet,
      };
      savePublisherProfile(updated);
      stagePublicationProfileChange(updated);
      setMessage(labels.saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.failed);
    }
  }

  function removeStylesheet() {
    if (!customProfile || readOnly || !profile.exportStylesheet) return;
    const updated: OmiPublicationProfile = {
      ...profile,
      version: new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ''),
      exportStylesheet: undefined,
    };
    savePublisherProfile(updated);
    stagePublicationProfileChange(updated);
    setCssText('');
    setFileName('publisher.css');
    setMessage(labels.removed);
  }

  return (
    <section className="publisher-profile-editor" aria-labelledby="publisher-export-css-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="publisher-export-css-title"><FileCode2 size={17} aria-hidden="true" /> {labels.title}</h4>
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
              rows={12}
              value={cssText}
              spellCheck={false}
              onChange={(event) => setCssText(event.target.value)}
              placeholder=".omi-scholarly-article { … }"
            />
          </label>
        </div>
      </fieldset>

      <div className="publisher-profile-actions">
        <div>
          {profile.exportStylesheet ? <code>{profile.exportStylesheet.fileName}</code> : <span>{labels.none}</span>}
          {message ? <span role="status">{message}</span> : null}
        </div>
        <div className="publisher-profile-action-buttons">
          {profile.exportStylesheet ? (
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
    title: 'Export CSS-stílus',
    description: 'Kapcsoljon CSS-fájlt a kiadói profilhoz. A stílus csak a publikációs exportot módosítja, a Studio szerkesztőfelületét nem.',
    customRequired: 'CSS-fájl mentéséhez előbb mentsen és alkalmazzon egy saját kiadói profilt.',
    readOnly: 'Az írásvédett profil CSS-e nem módosítható. Készítsen új profilverziót a módosításhoz.',
    file: 'CSS-fájl', choose: 'CSS kiválasztása', editor: 'CSS szerkesztése', cssOnly: 'Csak .css fájl tölthető fel.',
    tooLarge: 'A CSS-fájl legfeljebb 256 KB lehet.', save: 'CSS mentése a profilhoz', saved: 'A CSS új profilverzióhoz mentve és alkalmazva.',
    failed: 'A CSS mentése nem sikerült.', remove: 'CSS eltávolítása', removed: 'A CSS eltávolítva az új profilverzióból.', none: 'Nincs kapcsolt export CSS.',
  };
  if (locale === 'de') return {
    title: 'Export-CSS-Stil',
    description: 'Verknüpfen Sie eine CSS-Datei mit dem Verlagsprofil. Der Stil verändert nur den Publikationsexport, nicht die Studio-Oberfläche.',
    customRequired: 'Speichern und aktivieren Sie zuerst ein eigenes Verlagsprofil, um eine CSS-Datei zu hinterlegen.',
    readOnly: 'Das CSS eines schreibgeschützten Profils kann nicht geändert werden. Erstellen Sie dafür eine neue Profilversion.',
    file: 'CSS-Datei', choose: 'CSS auswählen', editor: 'CSS bearbeiten', cssOnly: 'Nur .css-Dateien können hochgeladen werden.',
    tooLarge: 'Die CSS-Datei darf höchstens 256 KB groß sein.', save: 'CSS im Profil speichern', saved: 'CSS in einer neuen Profilversion gespeichert und angewendet.',
    failed: 'CSS konnte nicht gespeichert werden.', remove: 'CSS entfernen', removed: 'CSS aus der neuen Profilversion entfernt.', none: 'Kein Export-CSS verknüpft.',
  };
  return {
    title: 'Export CSS style',
    description: 'Attach a CSS file to the publisher profile. The stylesheet changes publication exports only, not the Studio editing interface.',
    customRequired: 'Save and apply a custom publisher profile before attaching a CSS file.',
    readOnly: 'A read-only profile stylesheet cannot be changed. Create a new profile version first.',
    file: 'CSS file', choose: 'Choose CSS', editor: 'Edit CSS', cssOnly: 'Only .css files can be uploaded.',
    tooLarge: 'The CSS file must be 256 KB or smaller.', save: 'Save CSS to profile', saved: 'CSS saved in a new profile version and applied.',
    failed: 'Could not save CSS.', remove: 'Remove CSS', removed: 'CSS removed in the new profile version.', none: 'No export CSS attached.',
  };
}
