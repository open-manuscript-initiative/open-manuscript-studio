import { Boxes, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { historyArchivesModule, studioModules, defaultModuleInstallationPolicy } from './catalog';
import { getModuleShellCopy } from './moduleShellTranslations';
import { EuropeanaSearchPanel } from './history-archives/EuropeanaSearchPanel';
import {
  readStudioModulePreferences,
  writeStudioModulePreferences,
} from './preferences';
import {
  resolveStudioModuleActivationState,
  type StudioModuleId,
  type StudioWorkspaceModulePreferences,
} from './types';
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

  useEffect(() => {
    setPreferences(readStudioModulePreferences(userId, workspaceId));
  }, [userId, workspaceId]);

  function setModuleActive(moduleId: StudioModuleId, active: boolean): void {
    const next: StudioWorkspaceModulePreferences = {
      ...preferences,
      workspaceId,
      activeModuleIds: active
        ? [...new Set([...preferences.activeModuleIds, moduleId])]
        : preferences.activeModuleIds.filter((id) => id !== moduleId),
    };
    setPreferences(next);
    writeStudioModulePreferences(userId, next);
  }

  const activeModules = modules.filter((manifest) =>
    resolveStudioModuleActivationState(
      manifest.id,
      defaultModuleInstallationPolicy,
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
            defaultModuleInstallationPolicy,
            preferences,
          );
          const active = state === 'active';
          const details = copy.modules[module.id];
          return (
            <article className="studio-module-card" key={module.id}>
              <div className="studio-module-card-icon" aria-hidden="true">
                <Boxes size={20} />
              </div>
              <div className="studio-module-card-content">
                <h4>{details?.title ?? module.titleKey}</h4>
                <p>{details?.description ?? copy.scaffoldDescription}</p>
                <label className="studio-module-toggle">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setModuleActive(module.id, event.target.checked)}
                  />
                  <span className="studio-module-toggle-indicator" aria-hidden="true">
                    {active ? <Check size={14} /> : null}
                  </span>
                  <span>{active ? copy.active : copy.activate}</span>
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
                <span>{copy.scaffoldTitle}</span>
                <h4>{details?.overview ?? details?.title ?? contribution.titleKey}</h4>
              </header>
              <p>{details?.description ?? copy.scaffoldDescription}</p>
              <div className="studio-module-empty-slot">
                {module.id === historyArchivesModule.id
                  ? <EuropeanaSearchPanel copy={copy.europeana} locale={locale} />
                  : copy.noFeatures}
              </div>
            </section>
          ));
      })}

      <p className="studio-module-storage-note">{copy.localPreferenceNote}</p>
    </section>
  );
}
