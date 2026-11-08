import { z } from 'zod';
import { accountOverviewSchema, publicPrivacyNoticeSchema, privacyErrorSchema } from './privacyContract.js';

/** Generated from the same Zod DTOs validated by the use case and HTTP boundary. */
export function privacyOpenApi() {
  const json = (schema: unknown) => ({ content: { 'application/json': { schema } } });
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const headers = {
    'Cache-Control': { schema: { const: 'no-store' } },
    'X-Request-Id': { description: 'Server-generated correlation UUID; never an account identifier.', schema: { type: 'string', format: 'uuid' } },
  };
  const error = (description: string) => ({ description, headers, ...json(ref('PrivacyError')) });
  return {
    openapi: '3.1.0', info: { title: 'Studio privacy and partial account overview', version: '1.0.0-draft.1' },
    paths: {
      '/api/v1/privacy': { get: { operationId: 'getPrivacyNotice', security: [],
        description: 'Selected server operator notice. configured=false is explicit absence, not a compliance certification.',
        responses: { '200': { description: 'Reviewed public notice or explicit absence.', headers, ...json(ref('PublicPrivacyNotice')) } },
      } },
      '/api/v1/account/data': { get: { operationId: 'getAccountOverview', security: [{ session: [] }, { bearer: [] }],
        description: 'Read-only partial overview for the authenticated account only. No target-user parameter. Not a full access/portability response or manuscript backup. Each collection is capped at 1000 with incompleteSections. GET requires neither idempotency keys nor optimistic write versions.',
        responses: {
          '200': { description: 'Bounded account overview; no authentication secrets or manuscript/review contents.',
            headers: { ...headers, 'Content-Disposition': { schema: { const: 'attachment; filename="omi-account-data.json"' } } }, ...json(ref('AccountOverview')) },
          '401': error('Missing, expired or inactive-account session.'),
          '404': error('Account no longer exists.'),
          '429': error('Ten authenticated exports per IP per 15 minutes in this API process, shared across v1 and legacy aliases.'),
          '500': error('Export or response validation failed; no private error detail.'),
          '503': error('Identity authority unavailable; fail closed.'),
        },
      } },
    },
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'omi_session' }, bearer: { type: 'http', scheme: 'bearer' } },
      schemas: {
        PublicPrivacyNotice: z.toJSONSchema(publicPrivacyNoticeSchema),
        AccountOverview: z.toJSONSchema(accountOverviewSchema),
        PrivacyError: z.toJSONSchema(privacyErrorSchema),
      },
    },
  };
}
