import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleId,
  type StudioModuleManifest,
} from './types';

const MODULE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const TRANSLATION_KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export class StudioModuleRegistry {
  private readonly modules = new Map<StudioModuleId, StudioModuleManifest>();

  register(manifest: StudioModuleManifest): void {
    validateStudioModuleManifest(manifest);
    if (this.modules.has(manifest.id)) {
      throw new Error(`Studio module "${manifest.id}" is already registered.`);
    }

    const snapshot: StudioModuleManifest = Object.freeze({
      ...manifest,
      disciplines: manifest.disciplines
        ? Object.freeze([...manifest.disciplines])
        : undefined,
      requiredCapabilities: Object.freeze([...manifest.requiredCapabilities]),
      contributions: Object.freeze(
        manifest.contributions.map((contribution) =>
          Object.freeze({ ...contribution }),
        ),
      ),
    });
    this.modules.set(snapshot.id, snapshot);
  }

  get(moduleId: StudioModuleId): StudioModuleManifest | undefined {
    return this.modules.get(moduleId);
  }

  list(): readonly StudioModuleManifest[] {
    return [...this.modules.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }
}

export function validateStudioModuleManifest(
  manifest: StudioModuleManifest,
): void {
  if (!MODULE_ID_PATTERN.test(manifest.id)) {
    throw new Error(`Invalid Studio module id: "${manifest.id}".`);
  }
  if (!VERSION_PATTERN.test(manifest.version)) {
    throw new Error(`Invalid version for Studio module "${manifest.id}".`);
  }
  if (manifest.apiVersion !== STUDIO_MODULE_API_VERSION) {
    throw new Error(
      `Studio module "${manifest.id}" targets unsupported API "${manifest.apiVersion}".`,
    );
  }
  assertTranslationKey(manifest.titleKey, manifest.id);
  assertTranslationKey(manifest.descriptionKey, manifest.id);

  const disciplines = manifest.disciplines ?? [];
  assertUnique(disciplines, `discipline in "${manifest.id}"`);
  for (const discipline of disciplines) {
    if (!MODULE_ID_PATTERN.test(discipline)) {
      throw new Error(
        `Invalid discipline id "${discipline}" in Studio module "${manifest.id}".`,
      );
    }
  }

  assertUnique(manifest.requiredCapabilities, `capability in "${manifest.id}"`);
  for (const capability of manifest.requiredCapabilities) {
    if (!CAPABILITY_PATTERN.test(capability)) {
      throw new Error(
        `Invalid capability "${capability}" in Studio module "${manifest.id}".`,
      );
    }
  }

  const contributionIds = manifest.contributions.map(({ id }) => id);
  assertUnique(contributionIds, `contribution in "${manifest.id}"`);
  for (const contribution of manifest.contributions) {
    if (!MODULE_ID_PATTERN.test(contribution.id)) {
      throw new Error(
        `Invalid contribution id "${contribution.id}" in Studio module "${manifest.id}".`,
      );
    }
    if (!['workspace-home', 'workspace-tools', 'research-navigation'].includes(contribution.slot)) {
      throw new Error(
        `Unsupported contribution slot "${contribution.slot}" in Studio module "${manifest.id}".`,
      );
    }
    assertTranslationKey(contribution.titleKey, manifest.id);
    if (contribution.descriptionKey) {
      assertTranslationKey(contribution.descriptionKey, manifest.id);
    }
  }
}

function assertTranslationKey(key: string, moduleId: string): void {
  if (!TRANSLATION_KEY_PATTERN.test(key)) {
    throw new Error(
      `Invalid translation key "${key}" in Studio module "${moduleId}".`,
    );
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label}.`);
  }
}
