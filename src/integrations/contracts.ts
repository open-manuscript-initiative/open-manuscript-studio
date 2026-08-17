export type IntegrationProviderKind =
  | 'translation'
  | 'ai'
  | 'agent'
  | 'storage'
  | 'publishing'
  | 'identity'
  | 'scholarly-service';

export type IntegrationPermission =
  | 'document.read'
  | 'document.suggest'
  | 'document.write'
  | 'metadata.read'
  | 'metadata.write'
  | 'references.read'
  | 'references.write'
  | 'review.read'
  | 'files.read'
  | 'files.write';

export interface IntegrationProviderDescriptor {
  id: string;
  kind: IntegrationProviderKind;
  displayName: string;
  description: string;
  permissions: IntegrationPermission[];
  requiresServerSecret: boolean;
  documentationUrl?: string;
}

export interface IntegrationProviderStatus {
  providerId: string;
  enabled: boolean;
  configured: boolean;
  healthy?: boolean;
  message?: string;
}

export interface TranslationRequest {
  sourceLanguage?: string;
  targetLanguage: string;
  text: string;
  preserveFormatting?: boolean;
}

export interface TranslationResult {
  text: string;
  detectedSourceLanguage?: string;
  providerRequestId?: string;
}

export interface TranslationProvider {
  descriptor: IntegrationProviderDescriptor & { kind: 'translation' };
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface AiAgentRequest {
  instruction: string;
  content: string;
  manuscriptId: string;
  scope: 'selection' | 'block' | 'section' | 'manuscript' | 'metadata';
}

export interface AiAgentSuggestion {
  summary: string;
  replacement?: string;
  metadataPatch?: Record<string, unknown>;
}

export interface AiAgentProvider {
  descriptor: IntegrationProviderDescriptor & { kind: 'ai' | 'agent' };
  suggest(request: AiAgentRequest): Promise<AiAgentSuggestion>;
}
