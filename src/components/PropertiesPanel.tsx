import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/types';
import {
  getExternalIdentifierValue,
  getPreferredNameForm,
  getPrimaryAffiliation,
  getPrimaryAffiliationRorId,
  isValidOrcid,
  type ContributionRole,
} from '../model/identity';
import { RorAffiliationField } from './RorAffiliationField';

const ROLE_OPTIONS: ReadonlyArray<{
  value: ContributionRole;
  labelKey: TranslationKey;
}> = [
  {
    value: 'author',
    labelKey: 'contributors.roles.author',
  },
  {
    value: 'editor',
    labelKey: 'contributors.roles.editor',
  },
  {
    value: 'translator',
    labelKey: 'contributors.roles.translator',
  },
  {
    value: 'reviewer',
    labelKey: 'contributors.roles.reviewer',
  },
  {
    value: 'data-curator',
    labelKey: 'contributors.roles.dataCurator',
  },
  {
    value: 'software',
    labelKey: 'contributors.roles.software',
  },
  {
    value: 'methodology',
    labelKey: 'contributors.roles.methodology',
  },
  {
    value: 'visualization',
    labelKey: 'contributors.roles.visualization',
  },
  {
    value: 'other',
    labelKey: 'contributors.roles.other',
  },
];

export function PropertiesPanel() {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const addContributor = useStudioStore(
    (state) => state.addContributor,
  );
  const updateContributor = useStudioStore(
    (state) => state.updateContributor,
  );
  const updateContribution = useStudioStore(
    (state) => state.updateContribution,
  );
  const removeContributor = useStudioStore(
    (state) => state.removeContributor,
  );
  const moveContributor = useStudioStore(
    (state) => state.moveContributor,
  );

  const contributions = [...manuscript.contributions].sort(
    (left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) -
      (right.order ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <aside className="panel properties omi-properties-panel">
      <div className="omi-properties-panel-header">
        <div>
          <h2>{t('manuscript.contributors')}</h2>
          <p>{t('contributors.description')}</p>
        </div>

        <button
          type="button"
          className="contributor-add-button"
          onClick={addContributor}
        >
          <Plus size={16} aria-hidden="true" />
          {t('contributors.add')}
        </button>
      </div>

      <div className="omi-properties-panel-content">
        {contributions.length === 0 ? (
          <p className="contributor-empty">
            {t('contributors.empty')}
          </p>
        ) : null}

        {contributions.map((contribution, index) => {
          const agent = manuscript.agents.find(
            (candidate) =>
              candidate.id === contribution.agentId,
          );

          if (!agent) {
            return null;
          }

          const name = getPreferredNameForm(agent);
          const orcid = getExternalIdentifierValue(
            agent,
            'orcid',
          );
          const orcidIsValid = isValidOrcid(orcid);
          const primaryRole = contribution.roles[0] ?? 'author';

          return (
            <section
              className="contributor-card"
              key={contribution.id}
            >
              <div className="contributor-card-header">
                <strong>
                  {contribution.order ?? index + 1}.{' '}
                  {name?.value || t('manuscript.contributors')}
                </strong>

                <div className="contributor-order-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('contributors.moveUp')}
                    title={t('contributors.moveUp')}
                    disabled={index === 0}
                    onClick={() =>
                      moveContributor(contribution.id, 'up')
                    }
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('contributors.moveDown')}
                    title={t('contributors.moveDown')}
                    disabled={index === contributions.length - 1}
                    onClick={() =>
                      moveContributor(contribution.id, 'down')
                    }
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={t('contributors.remove')}
                    title={t('contributors.remove')}
                    onClick={() =>
                      removeContributor(contribution.id)
                    }
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

                <RorAffiliationField
                  agentId={agent.id}
                  affiliation={getPrimaryAffiliation(agent)}
                  rorId={getPrimaryAffiliationRorId(agent)}
                  label={t('contributors.affiliation')}
                />

                <label className="contributor-wide-field">
                  <span>{t('contributors.orcid')}</span>
                  <input
                    type="text"
                    value={orcid}
                    aria-invalid={!orcidIsValid}
                    aria-describedby={
                      orcidIsValid
                        ? undefined
                        : `orcid-error-${contribution.id}`
                    }
                    placeholder="0000-0000-0000-0000"
                    onChange={(event) =>
                      updateContributor(agent.id, {
                        orcid: event.target.value,
                      })
                    }
                  />
                  {!orcidIsValid ? (
                    <small
                      className="field-error"
                      id={`orcid-error-${contribution.id}`}
                    >
                      {t('contributors.invalidOrcid')}
                    </small>
                  ) : null}
                </label>

                <label className="contributor-wide-field">
                  <span>{t('contributors.role')}</span>
                  <select
                    value={primaryRole}
                    onChange={(event) =>
                      updateContribution(contribution.id, {
                        roles: [
                          event.target.value as ContributionRole,
                        ],
                      })
                    }
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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
            </section>
          );
        })}
      </div>
    </aside>
  );
}
