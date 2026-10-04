import { Boxes, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getCurrentUser, useAuthStore } from '../store/authStore';
import { getModuleShellCopy } from './moduleShellTranslations';
import {
  readStudioModulePreferences,
  writeStudioModulePreferences,
} from './preferences';
import { studioModules, defaultModuleInstallationPolicy } from './catalog';
import { resolveStudioModuleActivationState } from './types';
import type {
  StudioModuleId,
  StudioWorkspaceModulePreferences,
} from './types';
import './moduleShell.css';

interface ModuleManagerPanelProps {
  workspaceId?: string;
}

export function ModuleManagerPanel({
  workspaceId = 'default',
}: ModuleManagerPanelProps) {
  const { locale } = useModuleLocale();
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
          const label = getModuleName(module.id, locale);
          return (
            <article className="studio-module-card" key={module.id}>
              <div className="studio-module-card-icon" aria-hidden="true">
                <Boxes size={20} />
              </div>
              <div className="studio-module-card-content">
                <h4>{label}</h4>
                <p>{copy.scaffoldDescription}</p>
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

      {activeModules.map((module) => (
        <section className="studio-module-workspace-shell" key={module.id}>
          <header>
            <span>{copy.scaffoldTitle}</span>
            <h4>{getModuleName(module.id, locale)}</h4>
          </header>
          <p>{copy.scaffoldDescription}</p>
          <div className="studio-module-empty-slot">
            {copy.noFeatures}
          </div>
        </section>
      ))}

      <p className="studio-module-storage-note">{copy.localPreferenceNote}</p>
    </section>
  );
}

function useModuleLocale(): { locale: string } {
  // Kept as a hook so the module shell can later add host-provided module
  // context without coupling module packages to the full Studio translation API.
  const { useTranslation } = requireStudioTranslation();
  return useTranslation();
}

function requireStudioTranslation() {
  return { useTranslation: () => useStudioLocale() };
}

function useStudioLocale(): { locale: string } {
  // Importing the host hook statically keeps locale changes reactive.
  return useTranslationHook();
}

function useTranslationHook() {
  return useTranslation();
}

import { useTranslation } from '../i18n';

function getModuleName(moduleId: StudioModuleId, locale: string): string {
  const names: Record<string, Record<string, string>> = {
    'org.omi.history-archives': {
      en: 'History & Archives',
      de: 'Geschichte und Archive',
      hu: 'Történelem és levéltárak',
    },
  };
  const moduleNames = names[moduleId];
  return moduleNames?.[locale] ?? moduleNames?.en ?? moduleId;
}
