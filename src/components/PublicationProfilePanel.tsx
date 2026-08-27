import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  LayoutTemplate,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { stagePublicationProfileChange } from '../app/publicationProfileActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getFrontMatterCopy } from '../i18n/frontMatter';
import { getPublicationProfileCopy } from '../i18n/publicationProfile';
import {
  getPublicationFrontMatterRules,
  serializePublicationProfileWithFrontMatter,
} from '../model/frontMatter';
import {
  BUILTIN_PUBLICATION_PROFILES,
  DEFAULT_PUBLICATION_PROFILE_ID,
  getPublicationProfileReference,
  publicationProfileOverrides,
  publicationReadinessSummary,
  resolvePublicationProfile,
  validateManuscriptForPublication,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import { HtmlExportPanel } from './HtmlExportPanel';
import { IdmlPublicationStyleImportPanel } from './IdmlPublicationStyleImportPanel';
import { JatsExportPanel } from './JatsExportPanel';
import { PublicationStyleEditor } from './PublicationStyleEditor';
import { PublicationStyleExportPanel } from './PublicationStyleExportPanel';
import { PublisherExportStylesheetPanel } from './PublisherExportStylesheetPanel';
import { PublisherPrintStylesheetPanel } from './PublisherPrintStylesheetPanel';
import { PublisherProfileEditor } from './PublisherProfileEditor';

export function PublicationProfilePanel() {
  const { locale } = useTranslation();
  const copy = getPublicationProfileCopy(locale);
  const frontMatterCopy = getFrontMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const activeReference = getPublicationProfileReference(manuscript);
  const activeProfile = resolvePublicationProfile(manuscript);
  const [candidateId, setCandidateId] = useState(
    activeReference?.id ?? DEFAULT_PUBLICATION_PROFILE_ID,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [styleRevision, setStyleRevision] = useState(0);

  useEffect(() => {
    setCandidateId(activeReference?.id ?? DEFAULT_PUBLICATION_PROFILE_ID);
  }, [activeReference?.id, activeReference?.version]);

  const candidateProfile =
    BUILTIN_PUBLICATION_PROFILES.find((profile) => profile.id === candidateId) ??
    activeProfile;
  const issues = useMemo(
    () => validateManuscriptForPublication(manuscript, activeProfile),
    [manuscript, activeProfile],
  );
  const readiness = publicationReadinessSummary(issues);
  const overrides = publicationProfileOverrides(manuscript, activeProfile);

  function applyProfile(profile: OmiPublicationProfile): void {
    if (stagePublicationProfileChange(profile)) {
      setStatusMessage(copy.reapplied);
    }
  }

  function exportProfile(): void {
    const blob = new Blob(
      [serializePublicationProfileWithFrontMatter(activeProfile)],
      { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProfile.id}-${activeProfile.version}.omi-profile.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="publication-profile-view" aria-labelledby="publication-profile-title">
      <div className="studio-menu-view-header publication-profile-header">
        <div>
          <h3 id="publication-profile-title">{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <LayoutTemplate size={22} aria-hidden="true" />
      </div>

      <div className="publication-profile-experimental-note">{copy.experimental}</div>

      <section className="publication-profile-selector" aria-labelledby="publication-profile-choose">
        <div className="publication-profile-section-heading">
          <div>
            <h4 id="publication-profile-choose">{copy.chooseProfile}</h4>
            <p>{copy.profileSeparation}</p>
          </div>
        </div>

        <div className="publication-profile-options">
          {BUILTIN_PUBLICATION_PROFILES.map((profile) => {
            const localized = copy.profileNames[profile.id] ?? { name: profile.name, description: profile.description };
            const isActive = activeProfile.id === profile.id;
            const isCandidate = candidateId === profile.id;
            return (
              <label className={`publication-profile-option${isCandidate ? ' publication-profile-option--selected' : ''}`} key={profile.id}>
                <input type="radio" name="publication-profile" value={profile.id} checked={isCandidate} onChange={() => { setCandidateId(profile.id); setStatusMessage(null); }} />
                <span className="publication-profile-option-copy">
                  <span className="publication-profile-option-title">
                    <strong>{localized.name}</strong>
                    {isActive ? <small className="publication-profile-active-badge">{copy.active}</small> : null}
                  </span>
                  <span>{localized.description}</span>
                  <code>{profile.id}@{profile.version}</code>
                </span>
              </label>
            );
          })}
        </div>

        <button type="button" className="studio-menu-primary-action publication-profile-apply" disabled={candidateProfile.id === activeProfile.id && candidateProfile.version === activeProfile.version && overrides.length === 0} onClick={() => applyProfile(candidateProfile)}>
          <FileCheck2 size={16} aria-hidden="true" />
          {candidateProfile.id === activeProfile.id ? copy.resetDefaults : copy.applyProfile}
        </button>

        {statusMessage ? <div className="publication-profile-status" role="status"><CheckCircle2 size={15} aria-hidden="true" />{statusMessage}</div> : null}
      </section>

      <PublisherProfileEditor baseProfile={activeProfile} />
      <PublicationStyleEditor key={styleRevision} />
      <IdmlPublicationStyleImportPanel onImported={() => setStyleRevision((current) => current + 1)} />
      <PublicationStyleExportPanel />
      <PublisherExportStylesheetPanel profile={activeProfile} />
      <PublisherPrintStylesheetPanel profile={activeProfile} />

      <ProfileRuleSummary profile={activeProfile} copy={copy} frontMatterCopy={frontMatterCopy} />

      <section className="publication-profile-readiness" aria-labelledby="publication-readiness-title">
        <div className="publication-profile-section-heading">
          <div>
            <h4 id="publication-readiness-title">{copy.readiness}</h4>
            <p className={readiness.ready ? 'publication-ready' : 'publication-not-ready'}>{readiness.ready ? copy.ready : copy.notReady}</p>
          </div>
          <div className="publication-readiness-counts"><span>{readiness.errors} {copy.errors}</span><span>{readiness.warnings} {copy.warnings}</span></div>
        </div>

        {issues.length === 0 ? (
          <p className="publication-profile-no-issues"><CheckCircle2 size={16} aria-hidden="true" />{copy.noIssues}</p>
        ) : (
          <ul className="publication-profile-issue-list">
            {issues.slice(0, 60).map((issue, index) => (
              <li className={`publication-profile-issue publication-profile-issue--${issue.severity}`} key={`${issue.code}:${issue.targetId ?? ''}:${issue.detail ?? ''}:${index}`}>
                <AlertTriangle size={15} aria-hidden="true" />
                <span>{copy.issueText[issue.code]}{issue.code === 'too-few-keywords' && issue.detail ? ` (${issue.detail})` : ''}{issue.code === 'profile-override' && issue.detail ? ` — ${issue.detail}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <JatsExportPanel />
      <HtmlExportPanel />

      <section className="publication-profile-export">
        <div><strong>{copy.exportProfile}</strong><p>{copy.exportDescription}</p></div>
        <button type="button" className="studio-menu-secondary-action" onClick={exportProfile}><Download size={16} aria-hidden="true" />{copy.exportProfile}</button>
      </section>
    </section>
  );
}

function ProfileRuleSummary({ profile, copy, frontMatterCopy }: { profile: OmiPublicationProfile; copy: ReturnType<typeof getPublicationProfileCopy>; frontMatterCopy: ReturnType<typeof getFrontMatterCopy>; }) {
  const rules = profile.rules;
  const frontMatter = getPublicationFrontMatterRules(profile);
  const localized = copy.profileNames[profile.id] ?? { name: profile.name, description: profile.description };
  return (
    <section className="publication-profile-rules" aria-labelledby="publication-profile-rules-title">
      <div className="publication-profile-section-heading"><div><h4 id="publication-profile-rules-title">{copy.rules}</h4><p><strong>{localized.name}</strong> · {copy.profileVersion} {profile.version}{profile.publisher ? ` · ${copy.profilePublisher}: ${profile.publisher}` : ''}</p></div></div>
      <div className="publication-profile-rule-grid">
        <RuleCard title={frontMatterCopy.frontMatter}>
          <RuleLine label={frontMatterCopy.subtitle} value={`${frontMatterCopy.optional} · ${frontMatterCopy.belowTitle}`} />
          <RuleLine label={frontMatterCopy.motto} value={`${frontMatterCopy.optional} · ${frontMatter.motto.position === 'below-subtitle' ? frontMatterCopy.belowSubtitle : frontMatterCopy.belowTitle} · ${frontMatter.motto.style === 'italic' ? frontMatterCopy.italic : frontMatterCopy.normal} · ${alignmentLabel(frontMatter.motto.alignment, frontMatterCopy)}`} />
        </RuleCard>
        <RuleCard title={copy.layout}>
          <RuleLine label={copy.page} value={`${rules.layout.pageSize} · ${rules.layout.columns} ${copy.columns.toLowerCase()}`} />
          <RuleLine label={copy.typography} value={`${rules.layout.fontFamily} · ${rules.layout.baseFontSizePt} pt · ${rules.layout.lineHeight}`} />
          <RuleLine label={copy.margins} value={`${rules.layout.marginMm.top}/${rules.layout.marginMm.right}/${rules.layout.marginMm.bottom}/${rules.layout.marginMm.left} mm`} />
        </RuleCard>
        <RuleCard title={copy.sections}><RuleLine label={copy.numbering} value={rules.sections.numberingStyle} /><RuleLine label={copy.maxDepth} value={String(rules.sections.maxNumberedDepth)} /></RuleCard>
        <RuleCard title={copy.citations}><RuleLine label={copy.citationStyle} value={rules.citations.style} /><RuleLine label={copy.notePlacement} value={notePlacementLabel(rules.notes.placement, copy)} /></RuleCard>
        <RuleCard title={copy.objects}><RuleLine label={copy.objectNumbering} value={rules.objects.numbering === 'section' ? copy.section : copy.document} /><RuleLine label={copy.figureCaption} value={rules.objects.figureCaptionPosition === 'above' ? copy.above : copy.below} /><RuleLine label={copy.tableCaption} value={rules.objects.tableCaptionPosition === 'above' ? copy.above : copy.below} /></RuleCard>
        <RuleCard title={copy.contributors}><RuleLine label={copy.showAffiliations} value={rules.contributors.showAffiliations ? copy.yes : copy.no} /><RuleLine label={copy.showOrcid} value={rules.contributors.showOrcid ? copy.yes : copy.no} /></RuleCard>
        <RuleCard title={copy.requirements}><RuleLine label="Abstract" value={rules.metadata.requireAbstract ? copy.requirementLabels.required : copy.requirementLabels.off} /><RuleLine label="Keywords" value={rules.metadata.minimumKeywords > 0 ? `≥ ${rules.metadata.minimumKeywords}` : copy.requirementLabels.off} /><RuleLine label="Affiliation" value={copy.requirementLabels[rules.metadata.affiliation]} /><RuleLine label="ORCID" value={copy.requirementLabels[rules.metadata.orcid]} /></RuleCard>
      </div>
      <div className="publication-profile-output-row"><strong>{copy.outputs}</strong><div className="publication-profile-output-list">{rules.outputs.map((format) => <code key={format}>{format.toUpperCase()}</code>)}</div></div>
      {profile.exportStylesheet ? <div className="publication-profile-output-row"><strong>CSS</strong><div className="publication-profile-output-list"><code>{profile.exportStylesheet.fileName}</code></div></div> : null}
      {profile.printStylesheet ? <div className="publication-profile-output-row"><strong>Print / PDF CSS</strong><div className="publication-profile-output-list"><code>{profile.printStylesheet.fileName}</code></div></div> : null}
    </section>
  );
}

function RuleCard({ title, children }: { title: string; children: React.ReactNode; }) {
  return <div className="publication-profile-rule-card"><h5>{title}</h5><dl>{children}</dl></div>;
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function notePlacementLabel(placement: OmiPublicationProfile['rules']['notes']['placement'], copy: ReturnType<typeof getPublicationProfileCopy>): string {
  if (placement === 'endnotes') return copy.endnotes;
  if (placement === 'interactive') return copy.interactive;
  return copy.footnotes;
}

function alignmentLabel(alignment: 'left' | 'center' | 'right', copy: ReturnType<typeof getFrontMatterCopy>): string {
  if (alignment === 'left') return copy.alignLeft;
  if (alignment === 'center') return copy.alignCenter;
  return copy.alignRight;
}
