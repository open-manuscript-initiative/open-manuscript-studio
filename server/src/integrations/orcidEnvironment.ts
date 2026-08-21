export type OrcidEnvironment = 'sandbox' | 'production';

const ORCID_BASE_URLS: Record<OrcidEnvironment, string> = {
  sandbox: 'https://sandbox.orcid.org',
  production: 'https://orcid.org',
};

export interface OrcidRuntimeConfig {
  environment: OrcidEnvironment;
  baseUrl: string;
  issuer: string;
}

export function resolveOrcidRuntimeConfig(input: {
  environment?: OrcidEnvironment | undefined;
  legacyBaseUrl?: string | undefined;
}): OrcidRuntimeConfig {
  const explicitEnvironment = input.environment;
  const legacyOrigin = input.legacyBaseUrl
    ? normalizeOrigin(input.legacyBaseUrl)
    : undefined;

  let environment: OrcidEnvironment;

  if (explicitEnvironment) {
    environment = explicitEnvironment;
    const expectedOrigin = normalizeOrigin(ORCID_BASE_URLS[environment]);
    if (legacyOrigin && legacyOrigin !== expectedOrigin) {
      throw new Error(
        `ORCID_BASE_URL (${legacyOrigin}) does not match ORCID_ENVIRONMENT=${environment} (${expectedOrigin}).`,
      );
    }
  } else if (legacyOrigin) {
    if (legacyOrigin === normalizeOrigin(ORCID_BASE_URLS.sandbox)) {
      environment = 'sandbox';
    } else if (legacyOrigin === normalizeOrigin(ORCID_BASE_URLS.production)) {
      environment = 'production';
    } else {
      throw new Error(
        'ORCID_BASE_URL must be either https://sandbox.orcid.org or https://orcid.org.',
      );
    }
  } else {
    // Preserve the safe historical default: deployments remain on Sandbox
    // until production is selected explicitly.
    environment = 'sandbox';
  }

  const baseUrl = ORCID_BASE_URLS[environment];
  return {
    environment,
    baseUrl,
    issuer: normalizeOrigin(baseUrl),
  };
}

export function validateOrcidDeployment(input: {
  environment: OrcidEnvironment;
  nodeEnv: 'development' | 'test' | 'production';
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string | undefined;
}): void {
  const hasClientId = Boolean(input.clientId?.trim());
  const hasClientSecret = Boolean(input.clientSecret?.trim());

  if (hasClientId !== hasClientSecret) {
    throw new Error(
      'ORCID_CLIENT_ID and ORCID_CLIENT_SECRET must either both be configured or both be omitted.',
    );
  }

  if (!hasClientId) return;

  if (!input.redirectUri) {
    return;
  }

  const redirect = new URL(input.redirectUri);
  if (input.nodeEnv === 'production' && redirect.protocol !== 'https:') {
    throw new Error('ORCID_REDIRECT_URI must use HTTPS in production.');
  }

  if (input.environment === 'production' && input.nodeEnv !== 'production') {
    // Development against production ORCID is allowed intentionally, but
    // keeping this branch explicit documents that the two concepts differ.
    return;
  }
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}
