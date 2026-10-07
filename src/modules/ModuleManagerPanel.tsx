import { Boxes, Check } from 'lucide-react';
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';

import { useTranslation } from '../i18n';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { getServerModulePolicy, saveServerModulePreferences } from './api';
import { corpusLinguisticsModule, criticalTextEditionModule, culturalHeritageModule, historyArchivesModule, legalSourcesModule, musicologyModule, researchReproducibilityModule, religiousTextsModule, socialResearchMethodsModule, spatialResearchModule, archaeologyModule, experimentalLaboratoryModule, statisticalAnalysisModule, studioModules } from './catalog';
import { getModuleShellCopy } from './moduleShellTranslations';
import { EuropeanaSearchPanel } from './history-archives/EuropeanaSearchPanel';
import { NaraSearchPanel } from './history-archives/NaraSearchPanel';
import { EleveltarSearchPanel } from './history-archives/EleveltarSearchPanel';
import { ReligiousTextsPanel } from './religious-texts/ReligiousTextsPanel';
import { CriticalTextEditionPanel } from './critical-text-edition/CriticalTextEditionPanel';
import { CorpusLinguisticsPanel } from './corpus-linguistics/CorpusLinguisticsPanel';
import { MusicologyPanel } from './musicology/MusicologyPanel';
import { CulturalHeritagePanel } from './cultural-heritage/CulturalHeritagePanel';
import { SocialResearchMethodsPanel } from './social-research-methods/SocialResearchMethodsPanel';
import { LegalSourcesPanel } from './legal-sources/LegalSourcesPanel';
import { ResearchReproducibilityPanel } from './research-reproducibility/ResearchReproducibilityPanel';
import { SpatialResearchPanel } from './spatial-research/SpatialResearchPanel';
import { ArchaeologyPanel } from './archaeology/ArchaeologyPanel';
import { ExperimentalLaboratoryPanel } from './experimental-laboratory/ExperimentalLaboratoryPanel';
import { StatisticalAnalysisPanel } from './statistical-analysis/StatisticalAnalysisPanel';
import {
  readStudioModulePreferences,
  writeStudioModulePreferences,
} from './preferences';
import {
  resolveStudioModuleActivationState,
  type StudioModuleId,
  type StudioWorkspaceModulePreferences,
} from './types';
import { getDisciplineWorkspaceStorageKey } from './disciplineWorkspace';
import './moduleShell.css';

interface ModuleManagerPanelProps {
  workspaceId?: string;
}

export function ModuleManagerPanel({
  workspaceId = 'default',
}: ModuleManagerPanelProps) {
  const { locale } = useTranslation();
  const user = useAuthStore(getCurrentUser);
  const userId = String(user?.id ?? 'anonymous');
  const copy = getModuleShellCopy(locale);
  const modules = studioModules.list();
  const [preferences, setPreferences] = useState<StudioWorkspaceModulePreferences>(
    () => readStudioModulePreferences(userId, workspaceId),
  );
  const [installationPolicy, setInstallationPolicy] = useState({ revision: 0, enabledModuleIds: [] as StudioModuleId[] });
  const [policyError, setPolicyError] = useState(false);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPolicyLoaded(false);
    setPolicyError(false);
    const legacy = readStudioModulePreferences(userId, workspaceId);
    void getServerModulePolicy(workspaceId).then(async (serverPolicy) => {
      if (cancelled) return;
      let activeModuleIds = serverPolicy.activeModuleIds;
      if (serverPolicy.revision === 0 && legacy.activeModuleIds.length > 0) {
        const migrated = await saveServerModulePreferences({
          workspaceId,
          revision: 0,
          activeModuleIds: legacy.activeModuleIds.filter((id) => serverPolicy.enabledModuleIds.includes(id)),
        });
        activeModuleIds = migrated.activeModuleIds;
        serverPolicy.revision = migrated.revision;
      }
      if (cancelled) return;
      setInstallationPolicy({ revision: serverPolicy.revision, enabledModuleIds: serverPolicy.enabledModuleIds });
      setPolicyLoaded(true);
      const next = { workspaceId, activeModuleIds };
      setPreferences(next);
      writeStudioModulePreferences(userId, next);
      setPolicyError(false);
    }).catch(() => {
      if (!cancelled) setPolicyError(true);
    });
    return () => { cancelled = true; };
  }, [userId, workspaceId]);

  async function setModuleActive(moduleId: StudioModuleId, active: boolean): Promise<void> {
    const next: StudioWorkspaceModulePreferences = {
      ...preferences,
      workspaceId,
      activeModuleIds: active
        ? [...new Set([...preferences.activeModuleIds, moduleId])]
        : preferences.activeModuleIds.filter((id) => id !== moduleId),
    };
    const previous = preferences;
    setPreferences(next);
    setIsSaving(true);
    setPolicyError(false);
    try {
      const saved = await saveServerModulePreferences({
        workspaceId,
        revision: installationPolicy.revision,
        activeModuleIds: [...next.activeModuleIds],
      });
      const confirmed = { workspaceId, activeModuleIds: saved.activeModuleIds };
      setPreferences(confirmed);
      setInstallationPolicy({ revision: saved.revision, enabledModuleIds: saved.enabledModuleIds });
      writeStudioModulePreferences(userId, confirmed);
    } catch {
      setPreferences(previous);
      setPolicyError(true);
    } finally {
      setIsSaving(false);
    }
  }

  const activeModules = modules.filter((manifest) =>
    resolveStudioModuleActivationState(
      manifest.id,
      installationPolicy,
      preferences,
    ) === 'active',
  );

  return (
    <section className="studio-menu-view studio-module-manager">
      <div className="studio-menu-view-header">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="studio-module-list">
        {modules.length === 0 ? (
          <div className="studio-module-empty">{copy.noModules}</div>
        ) : modules.map((module) => {
          const state = resolveStudioModuleActivationState(
            module.id,
            installationPolicy,
            preferences,
          );
          const active = state === 'active';
          const disabledByInstallation = state === 'disabled-by-installation';
          const details = copy.modules[module.id];
          return (
            <article className="studio-module-card" key={module.id}>
              <div className="studio-module-card-icon" aria-hidden="true">
                <Boxes size={20} />
              </div>
              <div className="studio-module-card-content">
                <h4>{details?.title ?? module.titleKey}</h4>
                {details?.description && <p>{details.description}</p>}
                <label className="studio-module-toggle">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={!policyLoaded || isSaving || policyError || disabledByInstallation}
                    onChange={(event) => { void setModuleActive(module.id, event.target.checked); }}
                  />
                  <span className="studio-module-toggle-indicator" aria-hidden="true">
                    {active ? <Check size={14} /> : null}
                  </span>
                  <span>{active ? copy.active : disabledByInstallation ? copy.disabledByInstallation : copy.activate}</span>
                </label>
              </div>
              <span className={`studio-module-state studio-module-state--${state}`}>
                {active ? copy.active : copy.available}
              </span>
            </article>
          );
        })}
      </div>

      {activeModules.flatMap((module) => {
        const details = copy.modules[module.id];
        return module.contributions
          .filter((contribution) => contribution.slot === 'research-navigation')
          .map((contribution) => (
            <section
              className="studio-module-workspace-shell"
              key={module.id + ':' + contribution.id}
              data-module-id={module.id}
              data-contribution-id={contribution.id}
            >
              <header>
                <h4>{details?.overview ?? details?.title ?? contribution.titleKey}</h4>
              </header>
              {details?.description && <p>{details.description}</p>}
              <ModuleWorkspaceErrorBoundary
                moduleTitle={details?.title ?? module.titleKey}
                locale={locale}
              >
                {module.id === historyArchivesModule.id ? (
                  <>
                    <EuropeanaSearchPanel copy={copy.europeana} locale={locale} />
                    <NaraSearchPanel copy={copy.nara} locale={locale} />
                    <EleveltarSearchPanel locale={locale} />
                  </>
                ) : module.id === religiousTextsModule.id ? (
                  <ReligiousTextsPanel locale={locale} />
                ) : module.id === criticalTextEditionModule.id ? (
                  <CriticalTextEditionPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === corpusLinguisticsModule.id ? (
                  <CorpusLinguisticsPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === musicologyModule.id ? (
                  <MusicologyPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === culturalHeritageModule.id ? (
                  <CulturalHeritagePanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === socialResearchMethodsModule.id ? (
                  <SocialResearchMethodsPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === legalSourcesModule.id ? (
                  <LegalSourcesPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === researchReproducibilityModule.id ? (
                  <ResearchReproducibilityPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === spatialResearchModule.id ? (
                  <SpatialResearchPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === archaeologyModule.id ? (
                  <ArchaeologyPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === experimentalLaboratoryModule.id ? (
                  <ExperimentalLaboratoryPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : module.id === statisticalAnalysisModule.id ? (
                  <StatisticalAnalysisPanel locale={locale} storageKey={getDisciplineWorkspaceStorageKey(userId, workspaceId, module.id)} />
                ) : (
                  <div className="studio-module-empty-slot">{copy.noFeatures}</div>
                )}
              </ModuleWorkspaceErrorBoundary>
            </section>
          ));
      })}

      <p className="studio-module-storage-note" role={policyError ? 'alert' : undefined}>{policyError ? copy.policyError : copy.localPreferenceNote}</p>
    </section>
  );
}


interface ModuleWorkspaceErrorBoundaryProps {
  moduleTitle: string;
  locale: string;
  children: ReactNode;
}

interface ModuleWorkspaceErrorBoundaryState {
  failed: boolean;
}

/** Keeps a broken module from taking down the entire research-modules screen. */
class ModuleWorkspaceErrorBoundary extends Component<
  ModuleWorkspaceErrorBoundaryProps,
  ModuleWorkspaceErrorBoundaryState
> {
  state: ModuleWorkspaceErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModuleWorkspaceErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Research module "${this.props.moduleTitle}" failed to render.`, error, info);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    const copy = this.props.locale === 'hu'
      ? { message: 'Ez a modul most nem tölthető be.', retry: 'Újrapróbálás' }
      : this.props.locale === 'de'
        ? { message: 'Dieses Modul kann derzeit nicht geladen werden.', retry: 'Erneut versuchen' }
        : { message: 'This module could not be loaded.', retry: 'Try again' };

    return (
      <div className="studio-module-empty-slot" role="alert">
        <p>{this.props.moduleTitle}: {copy.message}</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          {copy.retry}
        </button>
      </div>
    );
  }
}
