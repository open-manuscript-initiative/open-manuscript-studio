import { useMemo, useState } from 'react';

import {
  setOjsOpenScienceField,
  setScholarlyLocalizedTerms,
  setScholarlyLocalizedText,
  setScholarlyScalar,
} from '../app/scholarlyMetadataActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';

const LABELS = {
  en: {
    title: 'Extended metadata',
    description: 'Portable publication metadata imported from OJS and stored with the manuscript.',
    subjects: 'Subjects',
    disciplines: 'Disciplines',
    supportingAgencies: 'Supporting agencies',
    coverage: 'Coverage',
    rights: 'Rights',
    source: 'Source',
    type: 'Type',
    dataAvailability: 'Data availability statement',
    languages: 'Languages',
    publisherId: 'Publisher ID',
    licenseUrl: 'License URL',
    copyrightHolder: 'Copyright holder',
    copyrightYear: 'Copyright year',
    openScience: 'Open Science (OJS extension)',
    openData: 'Open Data',
    openMaterials: 'Open Materials',
    preregistered: 'Preregistered',
    preregisteredPlus: 'Preregistered Plus',
    termsHint: 'Separate terms with commas or semicolons.',
  },
  hu: {
    title: 'Kibővített metaadatok',
    description: 'Az OJS-ből importált, a kézirattal együtt hordozható publikációs metaadatok.',
    subjects: 'Témák',
    disciplines: 'Tudományterületek',
    supportingAgencies: 'Támogató szervezetek',
    coverage: 'Lefedettség',
    rights: 'Jogok',
    source: 'Forrás',
    type: 'Típus',
    dataAvailability: 'Adatelérhetőségi nyilatkozat',
    languages: 'Nyelvek',
    publisherId: 'Kiadói azonosító',
    licenseUrl: 'Licenc URL',
    copyrightHolder: 'Szerzői jog jogosultja',
    copyrightYear: 'Szerzői jog éve',
    openScience: 'Nyílt tudomány (OJS-kiterjesztés)',
    openData: 'Nyílt adatok',
    openMaterials: 'Nyílt anyagok',
    preregistered: 'Előregisztrált',
    preregisteredPlus: 'Előregisztrált Plus',
    termsHint: 'A kifejezéseket vesszővel vagy pontosvesszővel válaszd el.',
  },
  de: {
    title: 'Erweiterte Metadaten',
    description: 'Aus OJS importierte, mit dem Manuskript portable Publikationsmetadaten.',
    subjects: 'Themen',
    disciplines: 'Fachgebiete',
    supportingAgencies: 'Förderorganisationen',
    coverage: 'Abdeckung',
    rights: 'Rechte',
    source: 'Quelle',
    type: 'Typ',
    dataAvailability: 'Erklärung zur Datenverfügbarkeit',
    languages: 'Sprachen',
    publisherId: 'Verlags-ID',
    licenseUrl: 'Lizenz-URL',
    copyrightHolder: 'Rechteinhaber',
    copyrightYear: 'Copyright-Jahr',
    openScience: 'Open Science (OJS-Erweiterung)',
    openData: 'Offene Daten',
    openMaterials: 'Offene Materialien',
    preregistered: 'Präregistriert',
    preregisteredPlus: 'Präregistriert Plus',
    termsHint: 'Begriffe mit Kommas oder Semikolons trennen.',
  },
} as const;

export function ScholarlyMetadataPanel() {
  const { locale: interfaceLocale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const [metadataLocale, setMetadataLocale] = useState(manuscript.locale);
  const copy = LABELS[interfaceLocale as keyof typeof LABELS] ?? LABELS.en;
  const metadata = useMemo(
    () => manuscript.metadata ?? {},
    [manuscript.metadata],
  );
  const openScience = manuscript.extensions?.['org.pkp.ojs']?.openScience ?? {};

  const locales = useMemo(() => {
    const values = new Set<string>([manuscript.locale, 'hu', 'en', 'de']);
    for (const field of [
      metadata.subjects,
      metadata.disciplines,
      metadata.supportingAgencies,
      metadata.coverage,
      metadata.rights,
      metadata.source,
      metadata.type,
      metadata.dataAvailability,
      metadata.languages,
      metadata.copyrightHolder,
    ]) {
      Object.keys(field ?? {}).forEach((value) => values.add(value));
    }
    return [...values];
  }, [manuscript.locale, metadata]);

  const termsValue = (key: 'subjects' | 'disciplines' | 'supportingAgencies') =>
    (metadata[key]?.[metadataLocale] ?? []).join(', ');
  const textValue = (
    key: 'coverage' | 'rights' | 'source' | 'type' | 'dataAvailability' | 'languages' | 'copyrightHolder',
  ) => metadata[key]?.[metadataLocale] ?? '';
  const openScienceValue = (
    key: 'openData' | 'openMaterials' | 'preregistered' | 'preregisteredPlus',
  ) => openScience[key]?.[metadataLocale] ?? '';

  return (
    <section className="studio-metadata-card">
      <div className="studio-metadata-card-header">
        <div>
          <h4>{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <select
          value={metadataLocale}
          aria-label="Metadata language"
          onChange={(event) => setMetadataLocale(event.target.value)}
        >
          {locales.map((item) => (
            <option key={item} value={item}>{item.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="studio-metadata-grid">
        <TermsField label={copy.subjects} value={termsValue('subjects')} hint={copy.termsHint}
          onChange={(value) => setScholarlyLocalizedTerms('subjects', metadataLocale, splitTerms(value))} />
        <TermsField label={copy.disciplines} value={termsValue('disciplines')} hint={copy.termsHint}
          onChange={(value) => setScholarlyLocalizedTerms('disciplines', metadataLocale, splitTerms(value))} />
        <TermsField label={copy.supportingAgencies} value={termsValue('supportingAgencies')} hint={copy.termsHint}
          onChange={(value) => setScholarlyLocalizedTerms('supportingAgencies', metadataLocale, splitTerms(value))} />

        <TextField label={copy.coverage} value={textValue('coverage')}
          onChange={(value) => setScholarlyLocalizedText('coverage', metadataLocale, value)} />
        <TextField label={copy.rights} value={textValue('rights')}
          onChange={(value) => setScholarlyLocalizedText('rights', metadataLocale, value)} />
        <TextField label={copy.source} value={textValue('source')}
          onChange={(value) => setScholarlyLocalizedText('source', metadataLocale, value)} />
        <TextField label={copy.type} value={textValue('type')}
          onChange={(value) => setScholarlyLocalizedText('type', metadataLocale, value)} />
        <TextField label={copy.languages} value={textValue('languages')}
          onChange={(value) => setScholarlyLocalizedText('languages', metadataLocale, value)} />
        <TextField label={copy.copyrightHolder} value={textValue('copyrightHolder')}
          onChange={(value) => setScholarlyLocalizedText('copyrightHolder', metadataLocale, value)} />

        <label className="studio-metadata-field studio-metadata-field--wide">
          <span>{copy.dataAvailability}</span>
          <textarea value={textValue('dataAvailability')}
            onChange={(event) => setScholarlyLocalizedText('dataAvailability', metadataLocale, event.target.value)} />
        </label>

        <TextField label={copy.publisherId} value={metadata.publisherId ?? ''}
          onChange={(value) => setScholarlyScalar('publisherId', value)} />
        <TextField label={copy.licenseUrl} value={metadata.licenseUrl ?? ''}
          onChange={(value) => setScholarlyScalar('licenseUrl', value)} />
        <TextField label={copy.copyrightYear} value={metadata.copyrightYear?.toString() ?? ''}
          onChange={(value) => setScholarlyScalar('copyrightYear', value)} />
      </div>

      <details className="studio-technical-details studio-open-science-details">
        <summary>{copy.openScience}</summary>
        <div className="studio-metadata-grid studio-metadata-grid--inside">
          <TextField label={copy.openData} value={openScienceValue('openData')}
            onChange={(value) => setOjsOpenScienceField('openData', metadataLocale, value)} />
          <TextField label={copy.openMaterials} value={openScienceValue('openMaterials')}
            onChange={(value) => setOjsOpenScienceField('openMaterials', metadataLocale, value)} />
          <TextField label={copy.preregistered} value={openScienceValue('preregistered')}
            onChange={(value) => setOjsOpenScienceField('preregistered', metadataLocale, value)} />
          <TextField label={copy.preregisteredPlus} value={openScienceValue('preregisteredPlus')}
            onChange={(value) => setOjsOpenScienceField('preregisteredPlus', metadataLocale, value)} />
        </div>
      </details>
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="studio-metadata-field">
      <span>{label}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TermsField({ label, value, hint, onChange }: { label: string; value: string; hint: string; onChange: (value: string) => void }) {
  return (
    <label className="studio-metadata-field">
      <span>{label}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      <small>{hint}</small>
    </label>
  );
}

function splitTerms(value: string): string[] {
  return value.split(/[;,]/u).map((item) => item.trim()).filter(Boolean);
}
