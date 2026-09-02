import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import {
  stageMottoChange,
  stageSubtitleChange,
  stageTitleMatterChange,
} from '../app/manuscriptFrontMatterActions';
import { stageDocumentStructureChange } from '../app/documentProfileActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getFrontMatterCopy } from '../i18n/frontMatter';
import type { OjsLaunchPayload } from '../integrations/ojs/importOjsLaunch';
import {
  getDocumentStructureProfile,
  type OmiBackMatterPlacement,
  type OmiNoteNumberingScope,
  type OmiVolumeKind,
} from '../model/documentProfile';
import type { OmiTitleMatterField } from '../model/frontMatter';
import { ContributorEditor } from './ContributorEditor';

type OjsContributors = NonNullable<OjsLaunchPayload['contributors']>;
type VolumeFrontMatterTab = 'title-matter' | 'contributors' | 'structure';

interface VolumeFrontMatterEditorProps {
  ojsContributors?: OjsContributors;
}

interface AutoGrowHeadingProps {
  id?: string;
  className: string;
  value: string;
  ariaLabel: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function AutoGrowHeading({
  id,
  className,
  value,
  ariaLabel,
  placeholder,
  onChange,
}: AutoGrowHeadingProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    resize();
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value.replace(/[\r\n]+/g, ' '));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') event.preventDefault();
  };

  return (
    <textarea
      ref={ref}
      id={id}
      className={className}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onInput={resize}
    />
  );
}

function OjsContributorPanel({ contributors }: { contributors: OjsContributors }) {
  if (!contributors.length) return null;

  return (
    <section className="omi-ojs-contributors" aria-label="OJS contributors">
      <h2>OJS contributors</h2>
      <div className="omi-ojs-contributor-list">
        {contributors.map((contributor, index) => {
          const name = [contributor.name?.given, contributor.name?.family]
            .filter(Boolean)
            .join(' ') || `Contributor ${index + 1}`;
          const orcid = contributor.identifiers?.find(
            (identifier) => identifier.scheme?.toLowerCase() === 'orcid',
          )?.value;

          return (
            <article
              className="omi-ojs-contributor-card"
              key={contributor.externalId ?? `${name}-${index}`}
            >
              <strong>{name}</strong>
              {contributor.primaryContact ? <span> · Corresponding author</span> : null}
              {contributor.email ? <div>{contributor.email}</div> : null}
              {contributor.affiliation ? <div>{contributor.affiliation}</div> : null}
              {orcid ? <div>ORCID: {orcid}</div> : null}
              {contributor.country ? <div>{contributor.country}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** A volume-level workspace kept outside every independently edited study. */
export function VolumeFrontMatterEditor({
  ojsContributors = [],
}: VolumeFrontMatterEditorProps) {
  const { t, locale } = useTranslation();
  const frontMatterCopy = getFrontMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const structure = getDocumentStructureProfile(manuscript);
  const copy = getVolumeFrontMatterCopy(locale, structure.kind);
  const setTitle = useStudioStore((state) => state.setTitle);
  const [activeTab, setActiveTab] = useState<VolumeFrontMatterTab>('title-matter');

  useEffect(() => {
    if (structure.kind === 'study' && activeTab === 'structure') {
      setActiveTab('title-matter');
    }
  }, [activeTab, structure.kind]);

  return (
    <section className="omi-volume-front-matter-workspace" aria-labelledby="omi-volume-data-title">
      <div className="omi-volume-workspace-header">
        <div>
          <span className="omi-volume-workspace-eyebrow">{copy.eyebrow}</span>
          <h1 id="omi-volume-data-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <div className="omi-volume-workspace-tabs" role="tablist" aria-label={copy.title}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'title-matter'}
            aria-controls="omi-title-matter-panel"
            className={activeTab === 'title-matter' ? 'is-active' : ''}
            onClick={() => setActiveTab('title-matter')}
          >
            {copy.titleMatter}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'contributors'}
            aria-controls="omi-volume-contributors-panel"
            className={activeTab === 'contributors' ? 'is-active' : ''}
            onClick={() => setActiveTab('contributors')}
          >
            {copy.contributors}
          </button>
          {structure.kind === 'volume' ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'structure'}
              aria-controls="omi-volume-structure-panel"
              className={activeTab === 'structure' ? 'is-active' : ''}
              onClick={() => setActiveTab('structure')}
            >
              {copy.structure}
            </button>
          ) : null}
        </div>
      </div>

      {activeTab === 'title-matter' ? (
        <header
          id="omi-title-matter-panel"
          role="tabpanel"
          className="omi-editor-header omi-continuous-front-matter omi-title-matter-panel"
        >
          <label className="omi-visually-hidden" htmlFor="manuscript-title">
            {t('manuscript.documentTitle')}
          </label>
          <AutoGrowHeading
            id="manuscript-title"
            className="title-input omi-document-title omi-auto-grow-heading"
            value={manuscript.title}
            ariaLabel={t('manuscript.documentTitle')}
            onChange={setTitle}
            placeholder={t('studio.titlePlaceholder')}
          />

          <label className="omi-visually-hidden" htmlFor="manuscript-subtitle">
            {frontMatterCopy.subtitleOptional}
          </label>
          <AutoGrowHeading
            id="manuscript-subtitle"
            className="omi-subtitle-input omi-document-subtitle omi-auto-grow-heading"
            value={manuscript.subtitle ?? ''}
            ariaLabel={frontMatterCopy.subtitleOptional}
            onChange={stageSubtitleChange}
            placeholder={frontMatterCopy.subtitlePlaceholder}
          />

          <label className="omi-visually-hidden" htmlFor="manuscript-motto">
            {frontMatterCopy.mottoOptional}
          </label>
          <textarea
            id="manuscript-motto"
            className="omi-motto-input omi-document-motto"
            rows={2}
            value={manuscript.motto ?? ''}
            onChange={(event) => stageMottoChange(event.target.value)}
            placeholder={frontMatterCopy.mottoPlaceholder}
          />

          {structure.kind === 'volume' ? (
            <TitleMatterFields
              values={manuscript.titleMatter ?? {}}
              copy={copy}
            />
          ) : null}
        </header>
      ) : activeTab === 'contributors' ? (
        <div id="omi-volume-contributors-panel" role="tabpanel">
          <ContributorEditor
            targetId={manuscript.id}
            title={copy.contributorTitle}
            description={copy.contributorDescription}
            className="omi-volume-contributor-editor"
          />
          <OjsContributorPanel contributors={ojsContributors} />
        </div>
      ) : (
        <VolumeStructureEditor
          structure={structure}
          copy={copy}
        />
      )}
    </section>
  );
}

function TitleMatterFields({
  values,
  copy,
}: {
  values: Partial<Record<OmiTitleMatterField, string>>;
  copy: ReturnType<typeof getVolumeFrontMatterCopy>;
}) {
  const fields: Array<{
    key: OmiTitleMatterField;
    label: string;
    wide?: boolean;
    multiline?: boolean;
  }> = [
    { key: 'halfTitle', label: copy.halfTitle, wide: true },
    { key: 'responsibilityStatement', label: copy.responsibility, wide: true },
    { key: 'editionStatement', label: copy.edition },
    { key: 'isbn', label: copy.isbn },
    { key: 'publisherName', label: copy.publisher },
    { key: 'publicationPlace', label: copy.place },
    { key: 'publicationYear', label: copy.year },
    { key: 'copyrightStatement', label: copy.copyright, wide: true, multiline: true },
    { key: 'colophon', label: copy.colophon, wide: true, multiline: true },
  ];

  return (
    <section className="omi-title-matter-details" aria-label={copy.titleMatterDetails}>
      <div>
        <h2>{copy.titleMatterDetails}</h2>
        <p>{copy.titleMatterDetailsDescription}</p>
      </div>
      <div className="omi-title-matter-grid">
        {fields.map((field) => (
          <label key={field.key} className={field.wide ? 'is-wide' : undefined}>
            <span>{field.label}</span>
            {field.multiline ? (
              <textarea
                rows={2}
                value={values[field.key] ?? ''}
                onChange={(event) => stageTitleMatterChange(field.key, event.target.value)}
              />
            ) : (
              <input
                type="text"
                value={values[field.key] ?? ''}
                onChange={(event) => stageTitleMatterChange(field.key, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

function VolumeStructureEditor({
  structure,
  copy,
}: {
  structure: ReturnType<typeof getDocumentStructureProfile>;
  copy: ReturnType<typeof getVolumeFrontMatterCopy>;
}) {
  const unit = structure.volumeKind === 'monograph' ? copy.chapter : copy.studyUnit;
  return (
    <section id="omi-volume-structure-panel" role="tabpanel" className="omi-volume-structure-editor">
      <div>
        <h2>{copy.structureTitle}</h2>
        <p>{copy.structureDescription}</p>
      </div>
      <div className="omi-volume-structure-grid">
        <label>
          <span>{copy.volumeKind}</span>
          <select
            value={structure.volumeKind ?? 'edited-volume'}
            onChange={(event) => stageDocumentStructureChange({
              volumeKind: event.target.value as OmiVolumeKind,
            })}
          >
            <option value="monograph">{copy.monograph}</option>
            <option value="edited-volume">{copy.editedVolume}</option>
          </select>
        </label>
        <label>
          <span>{copy.noteNumbering}</span>
          <select
            value={structure.noteNumberingScope}
            onChange={(event) => stageDocumentStructureChange({
              noteNumberingScope: event.target.value as OmiNoteNumberingScope,
            })}
          >
            <option value="continuous">{copy.continuous}</option>
            <option value="study">{copy.perUnit(unit)}</option>
            <option value="section">{copy.perSection}</option>
          </select>
        </label>
        <label>
          <span>{copy.referencesPlacement}</span>
          <select
            value={structure.referencesPlacement}
            onChange={(event) => stageDocumentStructureChange({
              referencesPlacement: event.target.value as OmiBackMatterPlacement,
            })}
          >
            <option value="study-end">{copy.atUnitEnd(unit)}</option>
            <option value="volume-end">{copy.atVolumeEnd}</option>
          </select>
        </label>
        <label>
          <span>{copy.listsPlacement}</span>
          <select
            value={structure.listsPlacement}
            onChange={(event) => stageDocumentStructureChange({
              listsPlacement: event.target.value as OmiBackMatterPlacement,
            })}
          >
            <option value="study-end">{copy.atUnitEnd(unit)}</option>
            <option value="volume-end">{copy.atVolumeEnd}</option>
          </select>
        </label>
      </div>
      <p className="omi-volume-structure-hint">{copy.structureHint}</p>
    </section>
  );
}

function getVolumeFrontMatterCopy(locale: string, kind: 'study' | 'volume') {
  if (locale === 'hu' && kind === 'study') return {
    eyebrow: 'Tanulmányszintű adatok', title: 'A tanulmány előrésze',
    description: 'A címadatok és a szerzői adatok a tanulmány törzsszövegétől elkülönítve szerkeszthetők.',
    titleMatter: 'Címadatok', contributors: 'Szerzők adatai', structure: 'Szerkezet',
    contributorTitle: 'A tanulmány szerzői és közreműködői',
    contributorDescription: 'Nevek, szerepek, intézmények, ORCID- és ROR-adatok.',
    ...sharedCopyHu(),
  };
  if (locale === 'hu') return {
    eyebrow: 'Kötetszintű adatok',
    title: 'A kötet előrésze',
    description: 'A címnegyed és a kötet közreműködői a tanulmányoktól elkülönítve szerkeszthetők.',
    titleMatter: 'Címnegyed',
    contributors: 'Szerzők adatai',
    contributorTitle: 'A kötet szerzői és közreműködői',
    contributorDescription: 'Kötetszintű nevek, szerepek, intézmények, ORCID- és ROR-adatok.',
    structure: 'Kötetszerkezet',
    ...sharedCopyHu(),
  };
  if (locale === 'de' && kind === 'study') return {
    eyebrow: 'Beitragsdaten', title: 'Vorspann der Studie',
    description: 'Titel- und Autorendaten werden getrennt vom Haupttext bearbeitet.',
    titleMatter: 'Titeldaten', contributors: 'Autorendaten', structure: 'Struktur',
    contributorTitle: 'Autorinnen, Autoren und Mitwirkende der Studie',
    contributorDescription: 'Namen, Rollen, Einrichtungen sowie ORCID- und ROR-Daten.',
    ...sharedCopyDe(),
  };
  if (locale === 'de') return {
    eyebrow: 'Banddaten',
    title: 'Vorspann des Bandes',
    description: 'Titelelemente und Mitwirkende des Bandes werden getrennt von den Beiträgen bearbeitet.',
    titleMatter: 'Titelelemente',
    contributors: 'Autorendaten',
    contributorTitle: 'Autorinnen, Autoren und Mitwirkende des Bandes',
    contributorDescription: 'Namen, Rollen, Einrichtungen sowie ORCID- und ROR-Daten auf Bandebene.',
    structure: 'Bandstruktur',
    ...sharedCopyDe(),
  };
  if (kind === 'study') return {
    eyebrow: 'Study-level data', title: 'Study front matter',
    description: 'Edit title and author data separately from the study body.',
    titleMatter: 'Title data', contributors: 'Author data', structure: 'Structure',
    contributorTitle: 'Study authors and contributors',
    contributorDescription: 'Names, roles, affiliations, ORCID and ROR data.',
    ...sharedCopyEn(),
  };
  return {
    eyebrow: 'Volume-level data',
    title: 'Volume front matter',
    description: 'Edit the title matter and volume contributors separately from the studies.',
    titleMatter: 'Title matter',
    contributors: 'Author data',
    contributorTitle: 'Volume authors and contributors',
    contributorDescription: 'Volume-level names, roles, affiliations, ORCID and ROR data.',
    structure: 'Volume structure',
    ...sharedCopyEn(),
  };
}

function sharedCopyHu() {
  return {
    titleMatterDetails: 'A címnegyed részletes adatai', titleMatterDetailsDescription: 'A félcímlap, impresszum- és kiadási adatok az OMI-struktúrában maradnak.',
    halfTitle: 'Félcím', responsibility: 'Szerzőségi vagy felelősségi közlés', edition: 'Kiadásjelzés', publisher: 'Kiadó', place: 'Kiadás helye', year: 'Kiadás éve', isbn: 'ISBN', copyright: 'Copyright-közlés', colophon: 'Kolofon vagy impresszum',
    structureTitle: 'A kötet típusa és közös apparátusa', structureDescription: 'Adja meg, hol induljon újra a jegyzetszámozás, és hová kerüljenek a hivatkozás- és egyéb jegyzékek.', volumeKind: 'Kötet típusa', monograph: 'Egyszerzős monográfia', editedVolume: 'Többszerzős tanulmánykötet', noteNumbering: 'Jegyzetszámozás', continuous: 'Folyamatos a teljes kötetben', perSection: 'Újraindul minden szakaszban', referencesPlacement: 'Hivatkozásjegyzék helye', listsPlacement: 'Egyéb jegyzékek helye', atVolumeEnd: 'A kötet végén', chapter: 'fejezet', studyUnit: 'tanulmány', perUnit: (unit: string) => `Újraindul ${unit}onként`, atUnitEnd: (unit: string) => `Minden ${unit} végén`, structureHint: 'A beállítások szemantikai szabályok: a szöveg és az objektumazonosítók változatlanok maradnak.',
  };
}

function sharedCopyDe() {
  return {
    titleMatterDetails: 'Ausführliche Titelelemente', titleMatterDetailsDescription: 'Schmutztitel, Impressum und Publikationsdaten bleiben strukturiert in OMI erhalten.',
    halfTitle: 'Schmutztitel', responsibility: 'Verantwortlichkeitsangabe', edition: 'Ausgabebezeichnung', publisher: 'Verlag', place: 'Erscheinungsort', year: 'Erscheinungsjahr', isbn: 'ISBN', copyright: 'Copyright-Vermerk', colophon: 'Kolophon oder Impressum',
    structureTitle: 'Bandtyp und gemeinsamer Apparat', structureDescription: 'Legen Sie die Neunummerierung der Anmerkungen und die Position von Literatur- und anderen Verzeichnissen fest.', volumeKind: 'Bandtyp', monograph: 'Einzelautorenmonografie', editedVolume: 'Mehrfach verfasster Sammelband', noteNumbering: 'Anmerkungsnummerierung', continuous: 'Fortlaufend im gesamten Band', perSection: 'In jedem Abschnitt neu', referencesPlacement: 'Position des Literaturverzeichnisses', listsPlacement: 'Position weiterer Verzeichnisse', atVolumeEnd: 'Am Ende des Bandes', chapter: 'Kapitel', studyUnit: 'Beitrag', perUnit: (unit: string) => `In jedem ${unit} neu`, atUnitEnd: (unit: string) => `Am Ende jedes ${unit}s`, structureHint: 'Diese Einstellungen sind semantische Regeln; Text und Objektidentitäten bleiben unverändert.',
  };
}

function sharedCopyEn() {
  return {
    titleMatterDetails: 'Detailed title matter', titleMatterDetailsDescription: 'Half-title, imprint, and publication data remain structured in OMI.',
    halfTitle: 'Half-title', responsibility: 'Statement of responsibility', edition: 'Edition statement', publisher: 'Publisher', place: 'Place of publication', year: 'Publication year', isbn: 'ISBN', copyright: 'Copyright statement', colophon: 'Colophon or imprint',
    structureTitle: 'Volume type and shared apparatus', structureDescription: 'Choose where note numbering restarts and where references and other lists are placed.', volumeKind: 'Volume type', monograph: 'Single-author monograph', editedVolume: 'Multi-author edited volume', noteNumbering: 'Note numbering', continuous: 'Continuous through the volume', perSection: 'Restart in every section', referencesPlacement: 'Reference-list placement', listsPlacement: 'Other-list placement', atVolumeEnd: 'At the end of the volume', chapter: 'chapter', studyUnit: 'study', perUnit: (unit: string) => `Restart in every ${unit}`, atUnitEnd: (unit: string) => `At the end of every ${unit}`, structureHint: 'These are semantic rules; text and stable object identities remain unchanged.',
  };
}
