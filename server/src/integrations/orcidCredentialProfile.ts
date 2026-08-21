export type DeploymentMode = 'personal' | 'institutional';
export type OrcidCredentialSource = 'personal' | 'institutional';
export type InstitutionalOrcidApiType = 'public' | 'member';

export interface OrcidCredentialProfile {
  source: OrcidCredentialSource;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  apiType?: InstitutionalOrcidApiType;
}

export function resolveOrcidCredentialProfile(input: {
  deploymentMode: DeploymentMode;
  personalClientId?: string | undefined;
  personalClientSecret?: string | undefined;
  personalRedirectUri?: string | undefined;
  institutionalClientId?: string | undefined;
  institutionalClientSecret?: string | undefined;
  institutionalRedirectUri?: string | undefined;
  institutionalApiType?: InstitutionalOrcidApiType | undefined;
}): OrcidCredentialProfile {
  if (input.deploymentMode === 'institutional') {
    validateCredentialPair(
      input.institutionalClientId,
      input.institutionalClientSecret,
      'INSTITUTIONAL_ORCID_CLIENT_ID',
      'INSTITUTIONAL_ORCID_CLIENT_SECRET',
    );

    return {
      source: 'institutional',
      clientId: normalizeOptional(input.institutionalClientId),
      clientSecret: normalizeOptional(input.institutionalClientSecret),
      redirectUri: normalizeOptional(input.institutionalRedirectUri),
      apiType: input.institutionalApiType ?? 'public',
    };
  }

  validateCredentialPair(
    input.personalClientId,
    input.personalClientSecret,
    'ORCID_CLIENT_ID',
    'ORCID_CLIENT_SECRET',
  );

  return {
    source: 'personal',
    clientId: normalizeOptional(input.personalClientId),
    clientSecret: normalizeOptional(input.personalClientSecret),
    redirectUri: normalizeOptional(input.personalRedirectUri),
  };
}

function validateCredentialPair(
  clientId: string | undefined,
  clientSecret: string | undefined,
  clientIdName: string,
  clientSecretName: string,
): void {
  const hasClientId = Boolean(clientId?.trim());
  const hasClientSecret = Boolean(clientSecret?.trim());

  if (hasClientId !== hasClientSecret) {
    throw new Error(
      `${clientIdName} and ${clientSecretName} must either both be configured or both be omitted.`,
    );
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
