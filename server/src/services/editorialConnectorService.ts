import { findEditorialConnection } from '../repositories/editorialConnectorRepository.js';
import {
  nativeClient,
  RemoteError,
} from '../integrations/publishing/nativePublishingClient.js';
import { assertTrustedIntegrationUrl } from '../integrations/security/trustedRemoteUrl.js';
import {
  resolvePersonalOjsCredential,
  resolvePersonalOmpCredential,
} from './personalPublishingCredentialService.js';
import {
  ojsMetadataResponse,
  type OjsMetadataRequest,
} from '../contracts/ojsMetadataContract.js';
import {
  editorialCapabilitiesSchema,
  workflowInspectionResponse,
} from '../contracts/editorialConnectorContract.js';
import { record } from '../integrations/publishing/directSubmission.js';

async function connection(userId: string, connectionId: string) {
  const saved = await findEditorialConnection(userId, connectionId);
  if (!saved)
    throw new RemoteError(
      404,
      'Enabled personal publishing connection not found.',
    );
  const baseUrl = (
    await assertTrustedIntegrationUrl(saved.baseUrl, saved.baseUrl)
  )
    .toString()
    .replace(/\/+$/, '');
  const credential = await (
    saved.provider === 'ojs'
      ? resolvePersonalOjsCredential
      : resolvePersonalOmpCredential
  )(userId, baseUrl);
  if (!credential)
    throw new RemoteError(
      400,
      'Save your personal API key for this installation first.',
    );
  return {
    provider: saved.provider,
    remote: nativeClient(baseUrl, credential.apiKey),
  };
}
async function capabilities(client: Awaited<ReturnType<typeof connection>>) {
  const raw = record(await client.remote('GET', 'omi-integration'));
  if (
    raw.protocol !== 'omi-integration/1' ||
    raw.profile !== `omi-integration/1/${client.provider}` ||
    !Array.isArray(raw.capabilities)
  )
    throw new RemoteError(502, 'Incompatible publishing capability response.');
  const native = new Set(raw.capabilities);
  // These protocols are currently implemented only by the OJS profile. Never infer OMP parity.
  return editorialCapabilitiesSchema.parse({
    protocol: 'omi-publishing-editorial/1',
    provider: client.provider,
    authority: client.provider === 'ojs' ? 'OJS' : 'OMP',
    features: {
      workflowRead:
        client.provider === 'ojs' && native.has('editor.workflow.read'),
      metadataReconcile:
        client.provider === 'ojs' && native.has('editor.metadata.reconcile'),
      nativeCopyeditingWrite: false,
      nativeProofApproval: false,
      externalReviewAssurance: false,
    },
  });
}
export async function inspectEditorialCapabilities(
  userId: string,
  connectionId: string,
) {
  return capabilities(await connection(userId, connectionId));
}
export async function inspectEditorialWorkflow(
  userId: string,
  connectionId: string,
  submissionId: number,
) {
  const client = await connection(userId, connectionId);
  const available = await capabilities(client);
  if (!available.features.workflowRead)
    throw new RemoteError(
      409,
      'This connector does not support editorial workflow inspection.',
    );
  const parsed = workflowInspectionResponse.safeParse({
    snapshot: await client.remote(
      'GET',
      `omi-integration/workflow-status?submissionId=${submissionId}`,
    ),
  });
  if (!parsed.success || parsed.data.snapshot.submissionId !== submissionId)
    throw new RemoteError(502, 'Incompatible editorial workflow response.');
  return parsed.data;
}
export async function reconcileEditorialMetadata(
  userId: string,
  connectionId: string,
  input: OjsMetadataRequest,
) {
  const client = await connection(userId, connectionId);
  const available = await capabilities(client);
  if (!available.features.metadataReconcile)
    throw new RemoteError(
      409,
      'This connector does not support selective metadata reconciliation.',
    );
  const parsed = ojsMetadataResponse.safeParse(
    await client.remote('POST', 'omi-integration/metadata', input),
  );
  if (
    !parsed.success ||
    parsed.data.snapshot.submissionId !== input.submissionId
  )
    throw new RemoteError(502, 'Incompatible OJS metadata response.');
  if (input.action === 'apply') {
    const receipt = parsed.data.receipt;
    if (
      !receipt ||
      parsed.data.snapshot.publicationId !== input.publicationId ||
      receipt.publicationId !== input.publicationId ||
      receipt.submissionId !== input.submissionId ||
      receipt.previousStateToken !== input.expectedStateToken ||
      receipt.locale !== input.locale ||
      JSON.stringify([...receipt.fields].sort()) !==
        JSON.stringify(Object.keys(input.fields).sort())
    )
      throw new RemoteError(
        502,
        'OJS returned a mismatched metadata receipt. Refresh the destination before retrying.',
      );
  }
  return parsed.data;
}
