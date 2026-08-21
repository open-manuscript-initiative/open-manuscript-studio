import 'dotenv/config';

import { z } from 'zod';

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

  // Controls which installation profile is active. Personal is the safe
  // default for standalone author installations. Institutional enables
  // organization-managed integrations and credentials.
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

  // Transitional direct ORCID OpenID Connect configuration. Select the
  // network explicitly; Sandbox remains the safe default until production
  // credentials are deliberately installed.
  ORCID_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),
  ORCID_CLIENT_ID: z.string().trim().optional(),
  ORCID_CLIENT_SECRET: z.string().trim().optional(),
  // Backward-compatible migration aid. When present it must match the
  // selected ORCID_ENVIRONMENT; new deployments should prefer the enum.
  ORCID_BASE_URL: z.string().url().optional(),
  ORCID_REDIRECT_URI: z.string().url().optional(),

  // Future central OMI Identity Service (OIDC) configuration. These values
  // are optional so current deployments remain fully backward compatible.
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

validateOrcidDeployment({
  environment: orcid.environment,
  nodeEnv: result.data.NODE_ENV,
  clientId: result.data.ORCID_CLIENT_ID,
  clientSecret: result.data.ORCID_CLIENT_SECRET,
  redirectUri: result.data.ORCID_REDIRECT_URI,
});

export const env = {
  ...result.data,
  ORCID_ENVIRONMENT: orcid.environment,
  ORCID_BASE_URL: orcid.baseUrl,
};
