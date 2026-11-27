import { randomBytes } from 'node:crypto';

export interface VolumeTransferProgress {
  phase: 'manifest' | 'metadata' | 'download' | 'convert' | 'article-complete' | 'finalize';
  completed: number;
  total: number | null;
  title?: string;
}
export type VolumeImportStatus =
  | { state: 'running'; progress: VolumeTransferProgress }
  | { state: 'ready'; progress: VolumeTransferProgress; handoffToken: string }
  | { state: 'failed'; progress: VolumeTransferProgress };

const TTL = 10 * 60_000;
const MAX_TICKETS = 16;
const tickets = new Map<string, { status: VolumeImportStatus; expiresAt: number }>();

function purge(): void {
  for (const [token, entry] of tickets) if (entry.expiresAt <= Date.now()) tickets.delete(token);
}

export function createVolumeProgressTicket(): string {
  purge();
  if (tickets.size >= MAX_TICKETS) throw new Error('Too many recent volume imports.');
  const token = randomBytes(32).toString('base64url');
  tickets.set(token, { status: { state: 'running', progress: { phase: 'manifest', completed: 0, total: null } }, expiresAt: Date.now() + TTL });
  return token;
}
export function updateVolumeProgress(token: string, progress: VolumeTransferProgress): void {
  const entry = tickets.get(token);
  if (!entry || entry.status.state !== 'running') return;
  entry.status = { state: 'running', progress };
  entry.expiresAt = Date.now() + TTL;
}
export function finishVolumeProgress(token: string, handoffToken?: string): void {
  const entry = tickets.get(token);
  if (!entry || entry.status.state !== 'running') return;
  const progress = entry.status.progress;
  entry.status = handoffToken
    ? { state: 'ready', progress, handoffToken }
    : { state: 'failed', progress };
  entry.expiresAt = Date.now() + TTL;
}
export function readVolumeProgress(token: string): VolumeImportStatus | undefined {
  purge();
  return tickets.get(token)?.status;
}
