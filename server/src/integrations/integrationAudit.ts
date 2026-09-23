import { createHash } from 'node:crypto';

import { prisma } from '../lib/prisma.js';

export interface IntegrationAuditScope {
  kind: 'selection' | 'block' | 'section' | 'manuscript' | 'metadata' | 'references';
  id?: string | undefined;
  reviewConfidential?: boolean | undefined;
}

export async function writeIntegrationAuditEvent(input: {
  id: string;
  userId: string;
  providerId: string;
  operation: string;
  scope: IntegrationAuditScope;
  input?: string;
  output?: string;
  permissions: string[];
  directWrite: boolean;
  status: 'SUCCESS' | 'ERROR';
  detail?: Record<string, unknown>;
}): Promise<void> {
  const inputDigest = input.input === undefined ? null : sha256(input.input);
  const outputDigest = input.output === undefined ? null : sha256(input.output);
  const inputLength = input.input?.length ?? null;
  const outputLength = input.output?.length ?? null;
  const permissions = JSON.stringify(input.permissions);
  const detail = input.detail ? JSON.stringify(input.detail) : null;
  await prisma.$executeRaw`
    INSERT INTO integration_audit_events
      (id, user_id, provider_id, operation, scope_kind, scope_id,
       input_digest, input_length, output_digest, output_length,
       permissions, review_confidential, direct_write, status, detail)
    VALUES
      (${input.id}::uuid, ${input.userId}::uuid, ${input.providerId}, ${input.operation},
       ${input.scope.kind}, ${input.scope.id ?? null}, ${inputDigest}, ${inputLength},
       ${outputDigest}, ${outputLength}, ${permissions}::jsonb,
       ${Boolean(input.scope.reviewConfidential)}, ${input.directWrite}, ${input.status},
       ${detail}::jsonb)
  `;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
