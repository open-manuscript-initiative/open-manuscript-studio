import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/types';
import { getCountryOptions } from '../model/countryCodes';
import {
  getExternalIdentifierValue,
  getPreferredNameForm,
  getPrimaryAffiliation,
  getPrimaryAffiliationRorId,
  type ContributionRole,
  type CreditRole,
} from '../model/identity';
import { OrcidLookupField } from './OrcidLookupField';
import { RorAffiliationField } from './RorAffiliationField';

const ROLE_OPTIONS: ReadonlyArray<{
  value: ContributionRole;
  labelKey: TranslationKey;
}> = [
  { value: 'author', labelKey: 'contributors.roles.author' },
  { value: 'editor', labelKey: 'contributors.roles.editor' },
  { value: 'translator', labelKey: 'contributors.roles.translator' },
  { value: 'reviewer', labelKey: 'contributors.roles.reviewer' },
  { value: 'data-curator', labelKey: 'contributors.roles.dataCurator' },
  { value: 'software', labelKey: 'contributors.roles.software' },
  { value: 'methodology', labelKey: 'contributors.roles.methodology' },
  { value: 'visualization', labelKey: 'contributors.roles.visualization' },
  { value: 'other', labelKey: 'contributors.roles.other' },
];

const CREDIT_ROLES: readonly CreditRole[] = [
  'conceptualization',
  'data-curation',
  'formal-analysis',
  'funding-acquisition',
  'investigation',
  'methodology',
  'project-administration',
  'resources',
  'software',
  'supervision',
  'validation',
  'visualization',
  'writing-original-draft',
  'writing-review-editing',
];

interface ContributorEditorProps {
  targetId: string;
  title: string;
  description: string;
  className?: string;
}

/** Edits contributors attached to one explicit volume or study target. */
export function ContributorEditor({
  targetId,
  title,
  description,
  className = '',
}: ContributorEditorProps) {
  const { t, locale } = useTranslation();
  const copy = contributorMetadataCopy(locale);
  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);
  const manuscript = useStudioStore((state) => state.manuscript);
  const addContributor = useStudioStore((state) => state.addContributor);
  const updateContributor = useStudioStore((state) => state.updateContributor);
  const updateContribution = useStudioStore((state) => state.updateContribution);
  const removeContributor = useStudioStore((state) => state.removeContributor);
  const moveContributor = useStudioStore((state) => state.moveContributor);

  const contributions = manuscript.contributions
    .filter((contribution) => contribution.targetId === targetId)
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) -
        (right.order ?? Number.MAX_SAFE_INTEGER),
    );

  return (
    <section className={`omi-contributor-editor ${className}`.trim()}>
      <div className="omi-properties-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <button
          type="button"
          className="contributor-add-button"
          onClick={() => addContributor(targetId)}
        >
          <Plus size={16} aria-hidden="true" />
          {t('contributors.add')}
        </button>
      </div>

      <div className="omi-properties-panel-content">
        {contributions.length === 0 ? (
          <p className="contributor-empty">{t('contributors.empty')}</p>
        ) : null}

        {contributions.map((contribution, index) => {
          const agent = manuscript.agents.find(
            (candidate) => candidate.id === contribution.agentId,
          );
          if (!agent) return null;

          const name = getPreferredNameForm(agent);
          const affiliation = getPrimaryAffiliation(agent);
          const primaryAffiliation = agent.affiliations[0];
          const rorId = getPrimaryAffiliationRorId(agent);
          const orcid = getExternalIdentifierValue(agent, 'orcid');
          const primaryRole = contribution.roles[0] ?? 'author';
          const biography = agent.biography?.[manuscript.locale] ?? '';
          const competingStatus = contribution.competingInterests?.status ?? '';
          const competingStatement =
            contribution.competingInterests?.statements?.[manuscript.locale] ??
            '';
          const creditRoles = contribution.creditRoles ?? [];

          const setCompetingStatus = (
            status: '' | 'none' | 'declared' | 'unclassified',
          ) => {
            if (!status) {
              updateContribution(contribution.id, {
                competingInterests: null,
              });
              return;
            }
            updateContribution(contribution.id, {
              competingInterests: {
                status,
                statements: {
                  ...(contribution.competingInterests?.statements ?? {}),
                  [manuscript.locale]:
                    status === 'none'
                      ? defaultNoConflictStatement(manuscript.locale)
                      : competingStatement,
                },
              },
            });
          };

          const setCompetingStatement = (statement: string) => {
            if (!competingStatus) return;
            updateContribution(contribution.id, {
              competingInterests: {
                status: competingStatus,
                statements: {
                  ...(contribution.competingInterests?.statements ?? {}),
                  [manuscript.locale]: statement,
                },
              },
            });
          };

          return (
            <section className="contributor-card" key={contribution.id}>
              <div className="contributor-card-header">
                <strong>
                  {contribution.order ?? index + 1}.{' '}
                  {contribution.attributionName ||
                    name?.value ||
                    t('manuscript.contributors')}
                </strong>

                <div className="contributor-order-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('contributors.moveUp')}
                    title={t('contributors.moveUp')}
                    disabled={index === 0}
                    onClick={() => moveContributor(contribution.id, 'up')}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('contributors.moveDown')}
                    title={t('contributors.moveDown')}
                    disabled={index === contributions.length - 1}
                    onClick={() => moveContributor(contribution.id, 'down')}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={t('contributors.remove')}
                    title={t('contributors.remove')}
                    onClick={() => removeContributor(contribution.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="contributor-form-grid">
                <label>
                  <span>{t('contributors.givenName')}</span>
                  <input
                    type="text"
                    value={name?.givenName ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        givenName: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>{t('contributors.familyName')}</span>
                  <input
                    type="text"
                    value={name?.familyName ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        familyName: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="contributor-wide-field">
                  <span>{copy.preferredPublicName}</span>
                  <input
                    type="text"
                    value={contribution.attributionName ?? ''}
                    onChange={(event) =>
                      updateContribution(contribution.id, {
                        attributionName: event.target.value,
                      })
                    }
                  />
                  <small>{copy.preferredPublicNameHint}</small>
                </label>

                <label>
                  <span>{copy.email}</span>
                  <input
                    type="email"
                    value={agent.email ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        email: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>{copy.country}</span>
                  <select
                    value={agent.country ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        country: event.target.value,
                      })
                    }
                  >
                    <option value="">{copy.notSpecified}</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="contributor-wide-field">
                  <span>{copy.website}</span>
                  <input
                    type="url"
                    value={agent.url ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        url: event.target.value,
                      })
                    }
                  />
                </label>

                <RorAffiliationField
                  agentId={agent.id}
                  affiliation={affiliation}
                  rorId={rorId}
                  label={t('contributors.affiliation')}
                />

                <OrcidLookupField
                  agentId={agent.id}
                  givenName={name?.givenName ?? ''}
                  familyName={name?.familyName ?? ''}
                  affiliation={affiliation}
                  rorId={rorId}
                  orcid={orcid}
                  label={t('contributors.orcid')}
                  invalidMessage={t('contributors.invalidOrcid')}
                />

                <label>
                  <span>{copy.department}</span>
                  <input
                    type="text"
                    value={primaryAffiliation?.department ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        affiliation,
                        department: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>{copy.position}</span>
                  <input
                    type="text"
                    value={primaryAffiliation?.position ?? ''}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        affiliation,
                        position: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="contributor-wide-field">
                  <span>{copy.biography}</span>
                  <textarea
                    rows={4}
                    value={biography}
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        biography: {
                          ...(agent.biography ?? {}),
                          [manuscript.locale]: event.target.value,
                        },
                      })
                    }
                  />
                  <small>{copy.localizedField} {manuscript.locale}</small>
                </label>

                <label className="contributor-wide-field">
                  <span>{t('contributors.role')}</span>
                  <select
                    value={primaryRole}
                    onChange={(event) =>
                      updateContribution(contribution.id, {
                        roles: [event.target.value as ContributionRole],
                      })
                    }
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="contributor-checkboxes">
                <label className="contributor-checkbox">
                  <input
                    type="checkbox"
                    checked={contribution.corresponding ?? false}
                    onChange={(event) =>
                      updateContribution(contribution.id, {
                        corresponding: event.target.checked,
                      })
                    }
                  />
                  <span>{t('contributors.corresponding')}</span>
                </label>

                <label className="contributor-checkbox">
                  <input
                    type="checkbox"
                    checked={contribution.includeInPublicationList ?? true}
                    onChange={(event) =>
                      updateContribution(contribution.id, {
                        includeInPublicationList: event.target.checked,
                      })
                    }
                  />
                  <span>{copy.includeInPublicationList}</span>
                </label>
              </div>

              <fieldset className="contributor-metadata-fieldset">
                <legend>{copy.competingInterests}</legend>
                <label>
                  <span>{copy.competingInterestsStatus}</span>
                  <select
                    value={competingStatus}
                    onChange={(event) =>
                      setCompetingStatus(
                        event.target.value as
                          | ''
                          | 'none'
                          | 'declared'
                          | 'unclassified',
                      )
                    }
                  >
                    <option value="">{copy.notSpecified}</option>
                    <option value="none">{copy.noConflict}</option>
                    <option value="declared">{copy.hasConflict}</option>
                    <option value="unclassified">{copy.unclassifiedConflict}</option>
                  </select>
                </label>
                {competingStatus ? (
                  <label className="contributor-wide-field">
                    <span>{copy.competingInterestsStatement}</span>
                    <textarea
                      rows={4}
                      value={
                        competingStatement ||
                        (competingStatus === 'none'
                          ? defaultNoConflictStatement(manuscript.locale)
                          : '')
                      }
                      onChange={(event) =>
                        setCompetingStatement(event.target.value)
                      }
                    />
                    <small>
                      {competingStatus === 'none'
                        ? copy.noConflictHint
                        : copy.hasConflictHint}
                    </small>
                  </label>
                ) : null}
              </fieldset>

              <fieldset className="contributor-metadata-fieldset">
                <legend>{copy.creditRoles}</legend>
                <p>{copy.creditRolesHint}</p>
                <div className="contributor-credit-grid">
                  {CREDIT_ROLES.map((role) => (
                    <label className="contributor-checkbox" key={role}>
                      <input
                        type="checkbox"
                        checked={creditRoles.includes(role)}
                        onChange={(event) =>
                          updateContribution(contribution.id, {
                            creditRoles: event.target.checked
                              ? [...creditRoles, role]
                              : creditRoles.filter(
                                  (candidate) => candidate !== role,
                                ),
                          })
                        }
                      />
                      <span>{creditRoleLabel(role, locale)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function defaultNoConflictStatement(locale: string): string {
  if (locale.toLowerCase().startsWith('hu')) {
    return 'A közreműködő kijelenti, hogy a kézirat elkészítésével kapcsolatban nem áll fenn összeférhetetlenség, és sem pénzügyi, sem egyéb jellegű érdekkötődés nem befolyásolta a kutatás eredményeit vagy a kézirat tartalmát.';
  }
  if (locale.toLowerCase().startsWith('de')) {
    return 'Die mitwirkende Person erklärt, dass im Zusammenhang mit der Erstellung des Manuskripts kein Interessenkonflikt besteht und dass weder finanzielle noch sonstige Interessen die Forschungsergebnisse oder den Inhalt des Manuskripts beeinflusst haben.';
  }
  return 'The contributor declares that there is no conflict of interest related to the preparation of this manuscript and that no financial or other competing interest influenced the research results or the content of the manuscript.';
}

function contributorMetadataCopy(locale: string) {
  if (locale === 'hu') return {
    preferredPublicName: 'Előnyben részesített nyilvános név',
    preferredPublicNameHint: 'Ha ki van töltve, a publikációban ez a teljes név jelenik meg a keresztnév és vezetéknév helyett.',
    email: 'E-mail-cím',
    country: 'Ország',
    website: 'Honlap URL-címe',
    department: 'Tanszék / szervezeti egység',
    position: 'Beosztás',
    biography: 'Személyes adatok / bemutatkozás',
    localizedField: 'A mező jelenlegi nyelve:',
    includeInPublicationList: 'Jelenjen meg a publikáció szerzői/közreműködői listájában',
    competingInterests: 'Összeférhetetlenségi nyilatkozat',
    competingInterestsStatus: 'Nyilatkozat típusa',
    competingInterestsStatement: 'Nyilatkozat szövege',
    noConflict: 'Nincs összeférhetetlenség – alapnyilatkozat használata',
    hasConflict: 'Van bejelentendő összeférhetetlenség',
    unclassifiedConflict: 'Meglévő/importált nyilatkozat – nincs besorolva',
    noConflictHint: 'Az alapnyilatkozat szerkeszthető, mielőtt a kéziratot beküldi.',
    hasConflictHint: 'Írja le a pénzügyi vagy egyéb releváns érdekeltséget.',
    unclassifiedConflictHint: 'A nyilatkozat szövege megmaradt a forrásrendszerből. Szükség esetén sorolja be vagy szerkessze.',
    creditRoles: 'CRediT szerepek',
    creditRolesHint: 'Jelölje meg a közreműködő tényleges hozzájárulásait a CRediT taxonómia szerint.',
    notSpecified: 'Nincs megadva',
  };
  if (locale === 'de') return {
    preferredPublicName: 'Bevorzugter öffentlicher Name',
    preferredPublicNameHint: 'Wenn ausgefüllt, wird dieser vollständige Name in der Publikation anstelle von Vor- und Nachname angezeigt.',
    email: 'E-Mail-Adresse',
    country: 'Land',
    website: 'Website-URL',
    department: 'Abteilung / Einheit',
    position: 'Position',
    biography: 'Persönliche Angaben / Biografie',
    localizedField: 'Aktuelle Sprache des Feldes:',
    includeInPublicationList: 'In Autoren-/Mitwirkendenlisten der Publikation anzeigen',
    competingInterests: 'Erklärung zu Interessenkonflikten',
    competingInterestsStatus: 'Art der Erklärung',
    competingInterestsStatement: 'Text der Erklärung',
    noConflict: 'Kein Interessenkonflikt – Standarderklärung verwenden',
    hasConflict: 'Interessenkonflikt anzugeben',
    unclassifiedConflict: 'Vorhandene/importierte Erklärung – nicht klassifiziert',
    noConflictHint: 'Die Standarderklärung kann vor der Einreichung bearbeitet werden.',
    hasConflictHint: 'Beschreiben Sie die relevanten finanziellen oder sonstigen Interessen.',
    unclassifiedConflictHint: 'Die Erklärung wurde aus dem Quellsystem übernommen. Sie kann bei Bedarf klassifiziert oder bearbeitet werden.',
    creditRoles: 'CRediT-Rollen',
    creditRolesHint: 'Wählen Sie die tatsächlichen Beiträge gemäß der CRediT-Taxonomie.',
    notSpecified: 'Nicht angegeben',
  };
  return {
    preferredPublicName: 'Preferred public name',
    preferredPublicNameHint: 'When provided, this full name is displayed in the publication instead of the given and family name.',
    email: 'Email address',
    country: 'Country',
    website: 'Website URL',
    department: 'Department / unit',
    position: 'Position',
    biography: 'Personal details / biography',
    localizedField: 'Current field language:',
    includeInPublicationList: 'Include in publication author/contributor lists',
    competingInterests: 'Competing interests declaration',
    competingInterestsStatus: 'Declaration type',
    competingInterestsStatement: 'Declaration text',
    noConflict: 'No conflict of interest – use default declaration',
    hasConflict: 'Competing interest to declare',
    unclassifiedConflict: 'Existing/imported statement – not classified',
    noConflictHint: 'The default declaration can be edited before submission.',
    hasConflictHint: 'Describe the relevant financial or other competing interest.',
    unclassifiedConflictHint: 'The statement was preserved from the source system. Classify or edit it if needed.',
    creditRoles: 'CRediT roles',
    creditRolesHint: 'Select the contributor’s actual contributions according to the CRediT taxonomy.',
    notSpecified: 'Not specified',
  };
}

function creditRoleLabel(role: CreditRole, locale: string): string {
  const labels: Record<CreditRole, [string, string, string]> = {
    conceptualization: ['Conceptualization', 'Koncepcióalkotás', 'Konzeptualisierung'],
    'data-curation': ['Data Curation', 'Adatgondozás', 'Datenkuratierung'],
    'formal-analysis': ['Formal Analysis', 'Formális elemzés', 'Formale Analyse'],
    'funding-acquisition': ['Funding Acquisition', 'Finanszírozás megszerzése', 'Finanzierungsbeschaffung'],
    investigation: ['Investigation', 'Vizsgálat', 'Untersuchung'],
    methodology: ['Methodology', 'Módszertan', 'Methodik'],
    'project-administration': ['Project Administration', 'Projektadminisztráció', 'Projektverwaltung'],
    resources: ['Resources', 'Erőforrások', 'Ressourcen'],
    software: ['Software', 'Szoftver', 'Software'],
    supervision: ['Supervision', 'Felügyelet', 'Betreuung'],
    validation: ['Validation', 'Validálás', 'Validierung'],
    visualization: ['Visualization', 'Vizualizáció', 'Visualisierung'],
    'writing-original-draft': ['Writing – Original Draft Preparation', 'Írás – eredeti kézirat elkészítése', 'Schreiben – ursprünglicher Entwurf'],
    'writing-review-editing': ['Writing – Review & Editing', 'Írás – áttekintés és szerkesztés', 'Schreiben – Überprüfung und Bearbeitung'],
  };
  const values = labels[role];
  if (locale === 'hu') return values[1];
  if (locale === 'de') return values[2];
  return values[0];
}
