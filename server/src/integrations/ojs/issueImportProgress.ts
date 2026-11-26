import { randomBytes } from 'node:crypto';

export interface IssueTransferProgress {
  phase: 'manifest' | 'metadata' | 'download' | 'convert' | 'article-complete' | 'finalize';
  completed: number;
  total: number | null;
  title?: string;
}
export type IssueImportStatus =
  | { state: 'running'; progress: IssueTransferProgress }
  | { state: 'ready'; progress: IssueTransferProgress; handoffToken: string }
  | { state: 'failed'; progress: IssueTransferProgress };

const TTL = 10 * 60_000;
const MAX_TICKETS = 16;
const tickets = new Map<string, { status: IssueImportStatus; expiresAt: number }>();

function purge(): void {
  for (const [token, entry] of tickets) if (entry.expiresAt <= Date.now()) tickets.delete(token);
}

export function createIssueProgressTicket(): string {
  purge();
  if (tickets.size >= MAX_TICKETS) throw new Error('Too many recent issue imports.');
  const token = randomBytes(32).toString('base64url');
  tickets.set(token, { status: { state: 'running', progress: { phase: 'manifest', completed: 0, total: null } }, expiresAt: Date.now() + TTL });
  return token;
}
export function updateIssueProgress(token: string, progress: IssueTransferProgress): void {
  const entry = tickets.get(token);
  if (!entry || entry.status.state !== 'running') return;
  entry.status = { state: 'running', progress };
  entry.expiresAt = Date.now() + TTL;
}
export function finishIssueProgress(token: string, handoffToken?: string): void {
  const entry = tickets.get(token);
  if (!entry || entry.status.state !== 'running') return;
  const progress = entry.status.progress;
  entry.status = handoffToken
    ? { state: 'ready', progress, handoffToken }
    : { state: 'failed', progress };
  entry.expiresAt = Date.now() + TTL;
}
export function readIssueProgress(token: string): IssueImportStatus | undefined {
  purge();
  return tickets.get(token)?.status;
}
