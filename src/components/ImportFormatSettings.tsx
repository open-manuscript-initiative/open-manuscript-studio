import { useState } from 'react';
import { useTranslation } from '../i18n';
import { DEFAULT_IMPORT_FORMAT_SETTINGS, loadImportFormatSettings, saveImportFormatSettings, type ImportFormatSettings } from '../services/importSettings';

const FORMAT_LABELS = {
  docx: ['DOCX', 'Word-dokumentumok'], xlsx: ['XLSX', 'Táblázatok és diagramok'], csv: ['CSV/TSV', 'Tagolt táblázatok'], html: ['HTML', 'HTML-tartalom'], tex: ['TeX', 'LaTeX-egyenletek'], images: ['Képek', 'PNG, JPEG, GIF, WebP és SVG'], musicXml: ['MusicXML', 'Szerkeszthető kották'], midi: ['MIDI', 'MIDI-hangjegyek'],
} as const;

export function ImportFormatSettings() {
  const { locale } = useTranslation();
  const [settings, setSettings] = useState<ImportFormatSettings>(() => loadImportFormatSettings());
  const labels = locale === 'hu'
    ? { title: 'Importformátumok', description: 'Kapcsold ki azokat az importálókat, amelyekre nincs szükséged. A kikapcsolt formátumok nem jelennek meg támogatott importként.', reset: 'Alapbeállítások', enabled: 'Engedélyezve' }
    : locale === 'de'
      ? { title: 'Importformate', description: 'Deaktiviere Importer, die du nicht benötigst.', reset: 'Standards', enabled: 'Aktiviert' }
      : { title: 'Import formats', description: 'Disable importers you do not need. Disabled formats are not offered as supported imports.', reset: 'Reset defaults', enabled: 'Enabled' };
  function update(key: keyof ImportFormatSettings, value: boolean) { const next = { ...settings, [key]: value }; setSettings(next); saveImportFormatSettings(next); }
  return <section className="omi-settings-section">
    <h4>{labels.title}</h4><p>{labels.description}</p>
    <div className="omi-import-format-settings">{(Object.keys(FORMAT_LABELS) as Array<keyof ImportFormatSettings>).map((key) => { const [name, description] = FORMAT_LABELS[key]; return <label key={key} className="omi-setting-toggle"><input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} /><span><strong>{name}</strong><small>{description}</small></span><em>{labels.enabled}</em></label>; })}</div>
    <button type="button" className="omi-secondary-button" onClick={() => { setSettings({ ...DEFAULT_IMPORT_FORMAT_SETTINGS }); saveImportFormatSettings(DEFAULT_IMPORT_FORMAT_SETTINGS); }}>{labels.reset}</button>
  </section>;
}
