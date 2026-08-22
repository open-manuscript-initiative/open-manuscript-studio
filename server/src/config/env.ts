import 'dotenv/config';

import { z } from 'zod';

import {
  resolveOrcidCredentialProfile,
} from '../integrations/orcidCredentialProfile.js';
import {
  resolveOrcidRuntimeConfig,
  validateOrcidDeployment,
} from '../integrations/orcidEnvironment.js';

const environmentSchema = z.object({
  NODE_ENV: z
    .enum([
      'development',
      'test',
      'production',
    ])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .max(65535)
    .default(3001),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required.'),

  FRONTEND_ORIGIN: z
    .string()
    .url()
    .default('http://localhost:5173'),

  DEPLOYMENT_MODE: z.enum(['personal', 'institutional']).default('personal'),

  INTEGRATION_MASTER_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'INTEGRATION_MASTER_KEY must be exactly 64 hexadecimal characters.',
    ),

  MAIL_FROM: z
    .string()
    .min(3)
    .default('Open Manuscript Studio <no-reply@openmanuscript.org>'),

  SENDMAIL_PATH: z
    .string()
    .min(1)
    .default('/usr/sbin/sendmail'),

  INVITATION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .max(720)
    .default(168),

  PASSWORD_RESET_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .max(1440)
    .default(60),

  ORCID_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),

  // Personal deployment credentials. These remain the backward-compatible
  // names used by existing standalone Studio installations.
  ORCID_CLIENT_ID: z.string().trim().optional(),
  ORCID_CLIENT_SECRET: z.string().trim().optional(),
  ORCID_REDIRECT_URI: z.string().url().optional(),

  // Institutional credentials are deliberately separate: switching a Studio
  // instance to institutional mode never silently reuses personal/OMI-owned
  // ORCID credentials.
  INSTITUTIONAL_ORCID_CLIENT_ID: z.string().trim().optional(),
  INSTITUTIONAL_ORCID_CLIENT_SECRET: z.string().trim().optional(),
  INSTITUTIONAL_ORCID_REDIRECT_URI: z.string().url().optional(),
  INSTITUTIONAL_ORCID_API_TYPE: z.enum(['public', 'member']).default('public'),

  ORCID_BASE_URL: z.string().url().optional(),

  // Optional external OpenID Connect identity providers. A provider is exposed
  // only when client id, client secret and redirect URI are all configured.
  GOOGLE_OIDC_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_OIDC_CLIENT_SECRET: z.string().trim().optional(),
  GOOGLE_OIDC_REDIRECT_URI: z.string().url().optional(),

  MICROSOFT_OIDC_CLIENT_ID: z.string().trim().optional(),
  MICROSOFT_OIDC_CLIENT_SECRET: z.string().trim().optional(),
  MICROSOFT_OIDC_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_OIDC_TENANT: z.string().trim().default('common'),

  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().trim().optional(),
  OIDC_CLIENT_SECRET: z.string().trim().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_LABEL: z.string().trim().max(80).default('Institutional sign-in'),

  OMI_IDENTITY_ISSUER: z.string().url().optional(),
  OMI_IDENTITY_CLIENT_ID: z.string().trim().optional(),
  OMI_IDENTITY_CLIENT_SECRET: z.string().trim().optional(),
  OMI_IDENTITY_REDIRECT_URI: z.string().url().optional(),
});

const result = environmentSchema.safeParse(
  process.env,
);

if (!result.success) {
  console.error(
    'Invalid server environment configuration:',
    result.error.flatten().fieldErrors,
  );

  throw new Error(
    'The server environment configuration is invalid.',
  );
}

const orcid = resolveOrcidRuntimeConfig({
  environment: result.data.ORCID_ENVIRONMENT,
  legacyBaseUrl: result.data.ORCID_BASE_URL,
});

const orcidCredentials = resolveOrcidCredentialProfile({
  deploymentMode: result.data.DEPLOYMENT_MODE,
  personalClientId: result.data.ORCID_CLIENT_ID,
  personalClientSecret: result.data.ORCID_CLIENT_SECRET,
  personalRedirectUri: result.data.ORCID_REDIRECT_URI,
  institutionalClientId: result.data.INSTITUTIONAL_ORCID_CLIENT_ID,
  institutionalClientSecret: result.data.INSTITUTIONAL_ORCID_CLIENT_SECRET,
  institutionalRedirectUri: result.data.INSTITUTIONAL_ORCID_REDIRECT_URI,
  institutionalApiType: result.data.INSTITUTIONAL_ORCID_API_TYPE,
});

validateOrcidDeployment({
  environment: orcid.environment,
  nodeEnv: result.data.NODE_ENV,
  clientId: orcidCredentials.clientId,
  clientSecret: orcidCredentials.clientSecret,
  redirectUri: orcidCredentials.redirectUri,
  frontendOrigin: result.data.FRONTEND_ORIGIN,
});

export const env = {
  ...result.data,
  ORCID_ENVIRONMENT: orcid.environment,
  ORCID_BASE_URL: orcid.baseUrl,
  // Existing ORCID routes consume these resolved aliases. Their credential
  // source is selected exclusively by DEPLOYMENT_MODE.
  ORCID_CLIENT_ID: orcidCredentials.clientId,
  ORCID_CLIENT_SECRET: orcidCredentials.clientSecret,
  ORCID_REDIRECT_URI: orcidCredentials.redirectUri,
  ORCID_CREDENTIAL_SOURCE: orcidCredentials.source,
  ORCID_API_TYPE: orcidCredentials.apiType,
};
