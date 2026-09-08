import { createHash } from 'node:crypto';
import { z } from 'zod';

const author = z.object({
  givenName: z.string().trim().min(1).max(200),
  familyName: z.string().trim().max(200),
  email: z.string().trim().email().max(254),
});
export const directSubmissionInput = z.object({
  manuscriptId: z.string().min(1).max(128),
  locale: z.string().min(2).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_-]+$/),
  title: z.string().trim().min(1).max(1000),
  abstract: z.string().max(100000),
  keywords: z.array(z.string().trim().min(1).max(200)).max(100),
  authors: z.array(author).min(1).max(100).refine(
    (authors) => new Set(authors.map((a) => a.email.toLowerCase())).size === authors.length,
    'Each author must have a different email address.',
  ),
  sectionId: z.number().int().positive().nullable(),
  genreId: z.number().int().positive(),
  docx: z.string().min(1).max(14000000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  omi: z.string().min(1).max(10000000),
});
export type DirectSubmissionInput = z.infer<typeof directSubmissionInput>;
export function submissionDigest(input: DirectSubmissionInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
export type RemoteRequest = (method: 'GET' | 'POST' | 'PUT', path: string, body?: Record<string, unknown> | FormData) => Promise<unknown>;
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('The publishing system returned an invalid identifier.');
  return value;
}
export function items(value: unknown): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : record(value).items;
  if (!Array.isArray(list)) throw new Error('The publishing system returned an invalid list.');
  return list.map(record);
}
export async function createRemoteSubmission(remote: RemoteRequest, platform: string, input: DirectSubmissionInput) {
  const data: Record<string, unknown> = { locale: input.locale };
  if (input.sectionId !== null) data[platform === 'ojs' ? 'sectionId' : 'seriesId'] = input.sectionId;
  const submission = record(await remote('POST', 'submissions', data));
  const externalId = positiveId(submission.id);
  const publicationId = positiveId(submission.currentPublicationId);
  return { externalId, publicationId };
}

/** Reconcile a reserved draft. Reads make retries after interrupted uploads/additions safe. */
export async function prepareRemoteSubmission(remote: RemoteRequest, ids: { externalId: number; publicationId: number }, input: DirectSubmissionInput, replaceFiles = false) {
  const path = `submissions/${positiveId(ids.externalId)}`;
  const publicationPath = `${path}/publications/${positiveId(ids.publicationId)}`;
  const current = record(await remote('GET', path));
  if (!current.submissionProgress) throw new Error('This manuscript has already been submitted.');
  await remote('PUT', publicationPath, {
    title: { [input.locale]: input.title }, abstract: { [input.locale]: input.abstract },
    keywords: { [input.locale]: input.keywords },
  });
  const contributors = items(await remote('GET', `${publicationPath}/contributors`));
  const authorGroup = contributors.find((a) => typeof a.userGroupId === 'number')?.userGroupId;
  if (typeof authorGroup !== 'number') throw new Error('Use an author account with a native author role to submit.');
  const retained = new Set<number>();
  let primaryContactId: number | undefined;
  for (const [index, author] of input.authors.entries()) {
    const existing = contributors.find((a) => String(a.email).toLowerCase() === author.email.toLowerCase());
    const body = {
      givenName: { [input.locale]: author.givenName }, familyName: { [input.locale]: author.familyName },
      email: author.email, userGroupId: authorGroup, includeInBrowse: true, seq: index,
    };
    const result = record(await remote(existing ? 'PUT' : 'POST',
      `${publicationPath}/contributors${existing ? `/${positiveId(existing.id)}` : ''}`, body));
    const id = positiveId(result.id);
    retained.add(id);
    primaryContactId ??= id;
  }
  // Never silently retain an unexpected account as an author or delete other authors.
  // The native wizard can resolve existing contributors before validation is retried.
  if (contributors.some((a) => !retained.has(positiveId(a.id)))) {
    throw new Error('The destination includes additional authors. Review the author list in the publishing system, then retry with the complete list.');
  }
  await remote('PUT', publicationPath, { primaryContactId });
  const files = items(await remote('GET', `${path}/files`));
  const stableName = createHash('sha256').update(input.manuscriptId).digest('hex').slice(0,20);
  for (const file of [
    { name: `omi-${stableName}.docx`, bytes: Buffer.from(input.docx, 'base64'), type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: `omi-${stableName}.omi.json`, bytes: Buffer.from(input.omi, 'utf8'), type: 'application/json' },
  ]) {
    const existingFile = files.find((f) => Object.values(record(f.name)).includes(file.name) || f.name === file.name);
    if (existingFile && !replaceFiles) continue;
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
    form.set('fileStage', '2');
    form.set('genreId', String(input.genreId));
    form.set(`name[${input.locale}]`, file.name);
    await remote(existingFile ? 'PUT' : 'POST', `${path}/files${existingFile ? `/${positiveId(existingFile.id)}` : ''}`, form);
  }
  await remote('PUT', `${path}/submit`, { _validateOnly: true });
}

export async function finalizeRemoteSubmission(remote: RemoteRequest, externalId: number): Promise<void> {
  const path = `submissions/${positiveId(externalId)}`;
  const current = record(await remote('GET', path));
  // A lost final response must not cause duplicate notifications on retry.
  if (typeof current.submissionProgress !== 'string') throw new Error('The publishing system returned an invalid submission state.');
  if (current.submissionProgress === '') return;
  await remote('PUT', `${path}/submit`, { _validateOnly: true });
  await remote('PUT', `${path}/submit`, { confirmCopyright: true });
}
