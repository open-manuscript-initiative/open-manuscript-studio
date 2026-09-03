import { applyDirectFormattingHeadingInference } from '../ojs/docxDirectHeading.js';
import { applyInlineSemantics } from '../ojs/docxInlineSemantics.js';
import { applyStyleInheritedLists } from '../ojs/docxListInheritance.js';
import { applyNoteIntegrity } from '../ojs/docxNoteIntegrity.js';
import { applyReferenceSemantics } from '../ojs/docxReferences.js';
import { parseDocxSource, type OjsSourceDocument } from '../ojs/docxSource.js';
import { applyStructuredContent } from '../ojs/docxStructuredContent.js';
import type { OmpLaunchClaims } from './launchVerifier.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';

interface OmpSubmissionResponse {
  protocol?: string;
  profile?: string;
  submission?: Record<string, unknown>;
}

interface OmpContributorsResponse {
  contributors?: Array<Record<string, unknown>>;
}

interface OmpFileDescriptor extends Record<string, unknown> {
  externalId?: string;
  componentExternalId?: string | null;
  componentId?: string | null;
  chapterExternalId?: string | null;
  name?: string;
  mediaType?: string;
  size?: number | null;
  stage?: number | null;
  genreKey?: string | null;
  genreName?: string | null;
  revision?: number | null;
  updatedAt?: string | null;
  contentPath?: string;
}

interface OmpFilesResponse {
  files?: OmpFileDescriptor[];
}

export interface OmpLaunchData {
  submission: Record<string, unknown> | null;
  contributors: Array<Record<string, unknown>>;
  files: OmpFileDescriptor[];
  sourceDocument?: OjsSourceDocument;
}

const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024;

function endpoint(baseUrl: string, operation: string): string {
  let normalized = baseUrl;
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return `${normalized}/${operation}`;
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function fetchWithSameOriginRedirects(
  initialUrl: URL,
  payload: string,
  signature: string,
  accept = 'application/json',
): Promise<Response> {
  const trustedOrigin = initialUrl.origin;
  const visited = new Set<string>();
  let currentUrl = new URL(initialUrl.toString());
  const authorization = `OMI ${payload}.${signature}`;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    currentUrl.searchParams.delete('payload');
    currentUrl.searchParams.delete('signature');

    const currentKey = currentUrl.toString();
    if (visited.has(currentKey)) throw new Error('OMP request entered a redirect loop.');
    visited.add(currentKey);

    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: { Accept: accept, Authorization: authorization },
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });

    if (!isRedirect(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`OMP endpoint returned HTTP ${response.status} without a Location header.`);
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== trustedOrigin) {
      throw new Error('OMP endpoint attempted a cross-origin redirect.');
    }
    currentUrl = nextUrl;
  }

  throw new Error('OMP endpoint exceeded the allowed redirect count.');
}

async function readJson<T>(
  url: string,
  payload: string,
  signature: string,
): Promise<T> {
  const response = await fetchWithSameOriginRedirects(new URL(url), payload, signature);

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { message?: string }; message?: string }
      | null;
    throw new Error(
      body?.error?.message || body?.message || `OMP request failed with HTTP ${response.status}.`,
    );
  }

  return await response.json() as T;
}

function isDocx(file: OmpFileDescriptor): boolean {
  const mediaType = (file.mediaType || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx');
}

function compareSourceFiles(a: OmpFileDescriptor, b: OmpFileDescriptor): number {
  const revisionDifference = Number(b.revision || 0) - Number(a.revision || 0);
  if (revisionDifference) return revisionDifference;
  return Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || '');
}

async function loadSourceDocument(
  files: OmpFileDescriptor[],
  apiBaseUrl: string,
  payload: string,
  signature: string,
  componentExternalId?: string,
): Promise<OjsSourceDocument | undefined> {
  const eligible = files
    .filter((file) => isDocx(file) && file.externalId && file.contentPath)
    .filter((file) => !file.size || file.size <= MAX_SOURCE_FILE_BYTES);
  const componentTagged = eligible.filter((file) => Boolean(fileComponentExternalId(file)));
  const componentScoped = componentExternalId && componentTagged.length
    ? componentTagged.filter((file) => fileComponentExternalId(file) === componentExternalId)
    : eligible;

  if (componentExternalId && componentTagged.length && !componentScoped.length) {
    throw new Error('OMP did not return a source document for the assigned study.');
  }

  const candidate = componentScoped
    .sort(compareSourceFiles)[0];
  if (!candidate?.externalId || !candidate.contentPath) return undefined;

  const base = new URL(`${apiBaseUrl.replace(/\/$/, '')}/`);
  const contentUrl = new URL(candidate.contentPath.replace(/^\//, ''), base);
  if (contentUrl.origin !== base.origin) {
    throw new Error('OMP source file URL escaped the registered installation origin.');
  }

  const response = await fetchWithSameOriginRedirects(
    contentUrl,
    payload,
    signature,
    candidate.mediaType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  if (!response.ok) {
    throw new Error(`OMP source file ${candidate.externalId} request failed with HTTP ${response.status}.`);
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_SOURCE_FILE_BYTES) {
    throw new Error('The OMP DOCX source file exceeds the 25 MB import limit.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SOURCE_FILE_BYTES) {
    throw new Error('The OMP DOCX source file exceeds the 25 MB import limit.');
  }

  const parsed = parseDocxSource(
    bytes,
    candidate.externalId,
    componentExternalId
      ? `review-article-${candidate.externalId}.docx`
      : candidate.name || `monograph-${candidate.externalId}.docx`,
    candidate.mediaType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  const withHeadings = applyDirectFormattingHeadingInference(bytes, parsed);
  const withInlineSemantics = applyInlineSemantics(bytes, withHeadings);
  const withStructuredContent = applyStructuredContent(bytes, withInlineSemantics);
  const withLists = applyStyleInheritedLists(bytes, withStructuredContent);
  const withNotes = applyNoteIntegrity(bytes, withLists);
  return applyReferenceSemantics(bytes, withNotes);
}

export async function loadOmpLaunchData(
  claims: OmpLaunchClaims,
  payload: string,
  signature: string,
): Promise<OmpLaunchData> {
  const scopes = new Set(claims.scope ?? []);
  const reviewerMode = claims.actorMode === 'review';
  const apiBaseUrl = claims.apiBaseUrl?.trim();

  if (!apiBaseUrl) {
    return {
      submission: claims.submission ? { ...claims.submission } : null,
      contributors: [],
      files: [],
    };
  }

  const externalBaseUrl = claims.externalBaseUrl?.trim();
  if (!externalBaseUrl) {
    throw new Error('The OMP launch assertion does not include externalBaseUrl.');
  }

  const trustedApiBaseUrl = await assertTrustedIntegrationUrl(apiBaseUrl, externalBaseUrl);
  const trustedApiBaseUrlString = trustedApiBaseUrl.toString().replace(/\/$/, '');
  const canReadSubmission = reviewerMode
    ? scopes.has('review.metadata.read')
    : scopes.has('metadata.read');
  const canReadFiles = reviewerMode
    ? scopes.has('review.files.read')
    : scopes.has('files.read');

  const submissionPromise = canReadSubmission
    ? readJson<OmpSubmissionResponse>(endpoint(trustedApiBaseUrlString, 'submission'), payload, signature)
    : Promise.resolve<OmpSubmissionResponse>({});
  const contributorsPromise = !reviewerMode && scopes.has('contributors.read')
    ? readJson<OmpContributorsResponse>(endpoint(trustedApiBaseUrlString, 'contributors'), payload, signature)
    : Promise.resolve<OmpContributorsResponse>({});
  const filesPromise = canReadFiles
    ? readJson<OmpFilesResponse>(endpoint(trustedApiBaseUrlString, 'files'), payload, signature)
    : Promise.resolve<OmpFilesResponse>({});

  const [submission, contributors, files] = await Promise.all([
    submissionPromise,
    contributorsPromise,
    filesPromise,
  ]);

  if (
    (submission.protocol && submission.protocol !== 'omi-integration/1') ||
    (submission.profile && submission.profile !== 'omi-integration/1/omp')
  ) {
    throw new Error('OMP submission endpoint returned an incompatible integration profile.');
  }

  const fileItems = files.files ?? [];
  const sourceDocument = canReadFiles
    ? await loadSourceDocument(
        fileItems,
        trustedApiBaseUrlString,
        payload,
        signature,
        reviewerMode ? claims.component?.externalId : undefined,
      )
    : undefined;

  return {
    submission: submission.submission ?? (claims.submission ? { ...claims.submission } : null),
    contributors: contributors.contributors ?? [],
    files: fileItems,
    ...(sourceDocument ? { sourceDocument } : {}),
  };
}

function fileComponentExternalId(file: OmpFileDescriptor): string | undefined {
  for (const candidate of [
    file.componentExternalId,
    file.componentId,
    file.chapterExternalId,
  ]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}
