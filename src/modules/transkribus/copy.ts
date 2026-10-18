import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';

export interface TranskribusCopy {
  title: string; description: string; category: string; connection: string;
  loginHint: string; username: string; password: string; connect: string; disconnect: string;
  connected: string; disconnected: string; busy: string; moduleHint: string;
  documentation: string; image: string; imageHint: string; modelId: string; models: string;
  model: string; modelSearch: string; modelLanguage: string; modelMaterial: string;
  allLanguages: string; allMaterials: string; handwritten: string; printed: string;
  chooseModel: string; modelsHint: string; modelsLoading: string; modelsEmpty: string;
  modelsRetry: string; modelDetails: string; manualModel: string; manualModelHint: string;
  selectedModel: string; modelMatches: string; modelCenturies: string;
  consent: string; start: string; submitHint: string; refresh: string; paused: string;
  result: string; reviewHint: string; source: string; sourceHint: string; titleLabel: string;
  rights: string; reviewed: string; section: string; noDocument: string; insert: string;
  inserted: string; downloadText: string; downloadPage: string; storageFailed: string;
  empty: string; invalidImage: string; savedJob: string; processingNote: string;
  integrationSecurity: string; helpTitle: string; helpBody: string;
  forget: string; forgetConfirm: string; untitledSection: string;
  rightsOptions: Record<string, string>; statuses: Record<string, string>; errors: Record<string, string>;
}

export function getTranskribusCopy(locale: string): TranskribusCopy {
  const copies = getResearchModuleCopyByLocale<TranskribusCopy>('transkribus/copy');
  return copies[normalizeModuleLocale(locale)] ?? copies.en;
}

export function transkribusErrorMessage(error: unknown, copy: TranskribusCopy): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'TRANSKRIBUS_OUTCOME_UNKNOWN') return copy.submitHint;
  if (code === 'TRANSKRIBUS_IDEMPOTENCY_CONFLICT') return copy.errors.TRANSKRIBUS_INVALID_REQUEST;
  return copy.errors[code] ?? copy.errors.TRANSKRIBUS_UNAVAILABLE;
}
