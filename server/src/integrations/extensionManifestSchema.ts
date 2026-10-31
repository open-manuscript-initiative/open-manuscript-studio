import { isIP } from 'node:net';
import { z } from 'zod';

/** OMI-SPEC-300 / OMI-SPEC-310 Draft; Studio's deliberately narrow API-v1 registry. */
export const INTEGRATION_EXTENSION_API_VERSION = '1' as const;
export const INTEGRATION_EXTENSION_PERMISSIONS = [
  'document.read', 'document.suggest', 'document.write',
  'metadata.read', 'metadata.write', 'references.read',
  'references.write', 'review.read', 'files.read', 'files.write',
] as const;

/** Read-only discovery of the supported contract; NEVER an authorization grant. */
export const INTEGRATION_EXTENSION_API_CAPABILITIES = {
  model: 'omi-studio-integration-extension-api',
  apiVersion: INTEGRATION_EXTENSION_API_VERSION,
  specification: 'OMI-SPEC-310@0.1.0',
  pluginSpecification: 'OMI-SPEC-300@0.1.0',
  status: 'partial-draft-implementation',
  registryScope: 'authenticated-user',
  manifestOnly: true,
  executesPluginCode: false,
  grantsManuscriptAccess: false,
  publishingAuthority: false,
  permissions: INTEGRATION_EXTENSION_PERMISSIONS,
} as const;

const permissionSchema = z.enum(INTEGRATION_EXTENSION_PERMISSIONS);

export const extensionManifestSchema = z.object({
  model: z.literal('omi-integration-extension'),
  apiVersion: z.literal(INTEGRATION_EXTENSION_API_VERSION),
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{1,126}[a-z0-9]$/),
  name: z.string().trim().min(1).max(200),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  kind: z.enum(['translation', 'ai', 'agent', 'storage', 'publishing', 'identity', 'scholarly-service']),
  description: z.string().trim().max(2000).optional(),
  authenticationModes: z.array(z.enum(['none', 'server_secret', 'user_api_key', 'oauth2', 'oidc', 'integration_token'])).min(1).max(6),
  permissions: z.array(permissionSchema).max(32),
  capabilities: z.array(z.string().trim().min(1).max(128)).max(32),
  endpoints: z.record(z.string(), z.string().url().max(2048)).optional(),
}).strict().superRefine((manifest, context) => {
  // API v1 must not silently interpret ambiguous duplicate rights or modes.
  for (const field of ['authenticationModes', 'permissions', 'capabilities'] as const) {
    if (new Set(manifest[field]).size !== manifest[field].length) {
      context.addIssue({ code: 'custom', path: [field], message: 'Duplicate manifest declarations are not permitted.' });
    }
  }
  if (manifest.authenticationModes.includes('none') && manifest.authenticationModes.length > 1) {
    context.addIssue({ code: 'custom', path: ['authenticationModes'], message: 'Unauthenticated mode cannot be combined with credentialed modes.' });
  }
  for (const [name, endpoint] of Object.entries(manifest.endpoints ?? {})) {
    try {
      const url = new URL(endpoint);
      const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      // Registered endpoints remain declarations; nevertheless prevent easily
      // dangerous local/loopback URLs becoming trusted future execution inputs.
      if (url.protocol !== 'https:' || url.username || url.password ||
          !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
          isIP(hostname) !== 0) {
        context.addIssue({
          code: 'custom', path: ['endpoints', name],
          message: 'Extension endpoints must be credential-free HTTPS domain URLs, not local or IP hosts.',
        });
      }
    } catch {
      context.addIssue({ code: 'custom', path: ['endpoints', name], message: 'Invalid extension endpoint URL.' });
    }
  }
});
