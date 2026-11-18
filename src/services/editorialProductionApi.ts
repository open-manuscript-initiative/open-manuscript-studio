import type { ProductionState } from '../../server/src/domain/editorialProduction';
import { studioApiFetch } from '../platform/studioApiTransport';
type WireCommand =
  import('../../server/src/contracts/editorialProductionContract').ProductionCommandRequest['command'];
export type ProductionCommand =
  | Exclude<WireCommand, { type: 'SOURCE' }>
  | {
      type: 'SOURCE';
      source: import('./nativeEditorialWorkflowApi').NativeEditorialRevisionPayload;
    };
export type EditorialProduction =
  import('../../server/src/contracts/editorialProductionContract').EditorialProductionResponse;
export type { ProductionState };
const base = () => '/api/v1/native-editorial/production';
async function read<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok)
    throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  return payload as T;
}
export async function getProduction(
  submissionId: string,
): Promise<EditorialProduction> {
  return read(
    await studioApiFetch(`${base()}/${encodeURIComponent(submissionId)}`, {
      credentials: 'include',
      cache: 'no-store',
    }),
  );
}
export async function changeProduction(
  submissionId: string,
  version: number,
  command: ProductionCommand,
): Promise<EditorialProduction> {
  return read(
    await studioApiFetch(`${base()}/${encodeURIComponent(submissionId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, command }),
    }),
  );
}
export async function getProductionFile(
  submissionId: string,
  fileId: string,
): Promise<Blob> {
  const response = await studioApiFetch(
    `${base()}/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(fileId)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (!response.ok) return read(response);
  return response.blob();
}
export async function getProductionTasks(): Promise<
  Array<{ submissionId: string; title: string; venueName: string }>
> {
  return (
    await read<{
      tasks: Array<{ submissionId: string; title: string; venueName: string }>;
    }>(
      await studioApiFetch(`${base()}/tasks`, {
        credentials: 'include',
        cache: 'no-store',
      }),
    )
  ).tasks;
}
