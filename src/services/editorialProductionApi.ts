import type {
  ProductionActor,
  ProductionState,
  ProductionAction,
} from '../../server/src/domain/editorialProduction';
import type { NativeEditorialRevisionPayload } from './nativeEditorialWorkflowApi';
export type ProductionCommand =
  | { type: 'START' }
  | Exclude<
      ProductionAction,
      | { type: 'SOURCE' }
      | { type: 'PROOF' }
      | { type: 'CORRECTION' }
      | { type: 'ASSIGN' }
    >
  | { type: 'SOURCE'; source: NativeEditorialRevisionPayload }
  | { type: 'PROOF'; artifactBase64: string; build: Record<string, unknown> }
  | { type: 'CORRECTION'; fileId: string; locator: string; note: string }
  | {
      type: 'ASSIGN';
      email: string;
      role: 'COPYEDITOR' | 'LAYOUT_EDITOR' | 'PROOFREADER';
      dueAt?: string;
    };
import { getStudioApiBaseUrl } from './studioServer';
export type { ProductionState };
export interface EditorialProduction {
  version: number;
  state: ProductionState | null;
  actor: ProductionActor;
  published: boolean;
  files: Array<{
    id: string;
    kind: 'SOURCE' | 'PROOF';
    fileName: string;
    createdAt: string;
  }>;
}
const base = () => `${getStudioApiBaseUrl()}/api/native-editorial/production`;
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
    await fetch(`${base()}/${encodeURIComponent(submissionId)}`, {
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
    await fetch(`${base()}/${encodeURIComponent(submissionId)}`, {
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
  const response = await fetch(
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
      await fetch(`${base()}/tasks`, {
        credentials: 'include',
        cache: 'no-store',
      }),
    )
  ).tasks;
}
