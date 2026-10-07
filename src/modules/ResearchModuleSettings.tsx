import { Boxes, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import {
  getServerModulePolicy,
  saveServerModulePreferences,
} from './api';
import { builtinModuleManifests } from './catalog';
import { getModuleShellCopy } from './moduleShellTranslations';
import {
  readStudioModulePreferences,
  writeStudioModulePreferences,
} from './preferences';
import type {
  StudioModuleId,
  StudioWorkspaceModulePreferences,
} from './types';
import './moduleShell.css';

const WORKSPACE_ID = 'default';

export function ResearchModuleSettings() {
  const user = useAuthStore(getCurrentUser);
  const userId = String(user?.id ?? 'anonymous');
  const { locale } = useTranslation();
  const copy = getModuleShellCopy(locale);
  const [activeModuleIds, setActiveModuleIds] = useState<StudioModuleId[]>([]);
  const [revision, setRevision] = useState(0);
  const [enabledModuleIds, setEnabledModuleIds] = useState<StudioModuleId[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(false);
    const legacy = readStudioModulePreferences(userId, WORKSPACE_ID);
    void getServerModulePolicy(WORKSPACE_ID).then(async (policy) => {
      let nextActive = policy.activeModuleIds;
      if (policy.revision === 0 && legacy.activeModuleIds.length > 0) {
        const migrated = await saveServerModulePreferences({
          workspaceId: WORKSPACE_ID,
          revision: 0,
          activeModuleIds: legacy.activeModuleIds.filter((id) => policy.enabledModuleIds.includes(id)),
        });
        nextActive = migrated.activeModuleIds;
        policy.revision = migrated.revision;
      }
      if (cancelled) return;
      setActiveModuleIds(nextActive);
      setRevision(policy.revision);
      setEnabledModuleIds(policy.enabledModuleIds);
      writeStudioModulePreferences(userId, {
        workspaceId: WORKSPACE_ID,
        activeModuleIds: nextActive,
      });
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function setModuleActive(moduleId: StudioModuleId, active: boolean): Promise<void> {
    const previous = activeModuleIds;
    const next = active
      ? [...new Set([...previous, moduleId])]
      : previous.filter((id) => id !== moduleId);
    setActiveModuleIds(next);
    setSaving(true);
    setError(false);
    try {
      const saved = await saveServerModulePreferences({
        workspaceId: WORKSPACE_ID,
        revision,
        activeModuleIds: next,
      });
      setActiveModuleIds(saved.activeModuleIds);
      setRevision(saved.revision);
      setEnabledModuleIds(saved.enabledModuleIds);
      writeStudioModulePreferences(userId, {
        workspaceId: WORKSPACE_ID,
        activeModuleIds: saved.activeModuleIds,
      });
    } catch {
      setActiveModuleIds(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="studio-settings-card studio-research-module-settings">
      <div className="studio-settings-card-header">
        <div>
          <h4>{copy.title}</h4>
          <p>{copy.settingsDescription}</p>
        </div>
      </div>
      {error ? <p role="alert">{copy.policyError}</p> : null}
      <div className="studio-module-list">
        {builtinModuleManifests.map((module) => {
          const details = copy.modules[module.id];
          const active = activeModuleIds.includes(module.id);
          const unavailable = !enabledModuleIds.includes(module.id);
          return (
            <article className="studio-module-card" key={module.id}>
              <div className="studio-module-card-icon" aria-hidden="true"><Boxes size={20} /></div>
              <div className="studio-module-card-content">
                <h5>{details?.title ?? module.titleKey}</h5>
                {details?.description ? <p>{details.description}</p> : null}
                <label className="studio-module-toggle">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={!loaded || saving || error || unavailable}
                    onChange={(event) => { void setModuleActive(module.id, event.target.checked); }}
                  />
                  <span className="studio-module-toggle-indicator" aria-hidden="true">
                    {active ? <Check size={14} /> : null}
                  </span>
                  <span>{unavailable ? copy.disabledByInstallation : active ? copy.active : copy.activate}</span>
                </label>
              </div>
              <span className={`studio-module-state studio-module-state--${unavailable ? 'disabled-by-installation' : active ? 'active' : 'available'}`}>
                {unavailable ? copy.disabledByInstallation : active ? copy.active : copy.available}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
\n