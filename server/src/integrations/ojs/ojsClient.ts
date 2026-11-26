import { fetchPinnedPublicUrl } from '../../cloud/security/connectionPinnedHttp.js';
import { applyDirectFormattingHeadingInference } from './docxDirectHeading.js';
import { applyInlineSemantics } from './docxInlineSemantics.js';
import { applyStyleInheritedLists } from './docxListInheritance.js';
import { applyNoteIntegrity } from './docxNoteIntegrity.js';
import { applyReferenceSemantics } from './docxReferences.js';
import { parseDocxSource, type OjsSourceDocument } from './docxSource.js';
import { applyStructuredContent } from './docxStructuredContent.js';
import type { LaunchClaims } from './launchVerifier.js';

export interface OjsLaunchData {
  submission: unknown;
  contributors: unknown[];
  files: unknown[];
  sourceDocument?: OjsSourceDocument;
}

interface OjsJsonResponse {
  data: Record<string, unknown>;
  finalUrl: URL;
}

interface OjsFileDescriptor {
  externalId?: string;
  name?: string;
  mediaType?: string;
  size?: number | null;
  stage?: number | null;
  genreExternalId?: string | null;
  genreKey?: string | null;
  genreName?: string | null;
  revision?: number | null;
  updatedAt?: string | null;
  contentPath?: string;
}

const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024;
const OJS_SUBMISSION_FILE_STAGE = 2;
const OJS_ARTICLE_TEXT_GENRE_KEY = 'SUBMISSION';

function requireAnyScope(claims: LaunchClaims, scopes: string[]): void {
  if (!scopes.some((scope) => claims.scope?.includes(scope))) {
    throw new Error(`The launch assertion does not grant any of: ${scopes.join(', ')}.`);
  }
}

function apiUrl(claims: LaunchClaims, operation: string): URL {
  if (!claims.apiBaseUrl) {
    throw new Error('The OJS launch assertion does not include apiBaseUrl.');
  }
  return new URL(`${claims.apiBaseUrl.replace(/\/$/, '')}/${operation}`);
}

function siblingOperationUrl(
  finalUrl: URL,
  currentOperation: string,
  nextOperation: string,
): URL {
  const suffix = `/${currentOperation}`;
  if (!finalUrl.pathname.endsWith(suffix)) {
    throw new Error(
      `OJS ${currentOperation} resolved to an unexpected URL: ${finalUrl.toString()}`,
    );
  }
  const nextUrl = new URL(finalUrl.toString());
  nextUrl.pathname = `${finalUrl.pathname.slice(0, -suffix.length)}/${nextOperation}`;
  nextUrl.search = '';
  nextUrl.hash = '';
  return nextUrl;
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function canonicalizeRequestUrl(candidate: URL, trustedOrigin: string): URL {
  if (candidate.origin !== trustedOrigin) {
    throw new Error('OJS request URL escaped the registered installation origin.');
  }
  if (candidate.username || candidate.password) {
    throw new Error('OJS request URL must not contain embedded credentials.');
  }
  if (candidate.search) {
    throw new Error('OJS integration endpoints must not redirect to query-string URLs.');
  }
  if (candidate.hash) {
    throw new Error('OJS integration endpoints must not contain URL fragments.');
  }

  const trusted = new URL(trustedOrigin);
  trusted.pathname = candidate.pathname
    .split('/')
    .map((segment) => {
      if (!segment) return '';

      let decoded: string;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        throw new Error('OJS request URL contains invalid path encoding.');
      }

      if (decoded === '.' || decoded === '..') {
        throw new Error('OJS request URL contains a path traversal segment.');
      }

      return encodeURIComponent(decoded);
    })
    .join('/');
  return trusted;
}

async function fetchWithExplicitRedirects(
  operation: string,
  initialUrl: URL,
  authorization: string,
  trustedOrigin: string,
  accept = 'application/json',
): Promise<Response> {
  const visited = new Set<string>();
  let currentUrl = canonicalizeRequestUrl(initialUrl, trustedOrigin);

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const currentKey = currentUrl.toString();
    if (visited.has(currentKey)) {
      throw new Error(`OJS ${operation} entered a redirect loop at ${currentKey}.`);
    }
    visited.add(currentKey);

    let response: Response;
    try {
      response = await fetchPinnedPublicUrl(currentUrl, {
        method: 'GET',
        headers: { Accept: accept, Authorization: authorization },
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const cause =
        error && typeof error === 'object' && 'cause' in error
          ? (error as { cause?: unknown }).cause
          : undefined;
      const causeMessage =
        cause instanceof Error
          ? cause.message
          : cause && typeof cause === 'object' && 'code' in cause
            ? String((cause as { code?: unknown }).code)
            : '';
      throw new Error(
        `OJS ${operation} request failed before an HTTP response${causeMessage ? `: ${causeMessage}` : ''}. URL: ${currentKey}`,
        { cause: error },
      );
    }

    if (!isRedirect(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) {
      throw new Error(
        `OJS ${operation} returned HTTP ${response.status} without a Location header. URL: ${currentKey}`,
      );
    }

    const redirectTarget = new URL(location, currentUrl);
    currentUrl = canonicalizeRequestUrl(redirectTarget, trustedOrigin);
  }

  throw new Error(
    `OJS ${operation} exceeded the allowed redirect count. Last URL: ${currentUrl.toString()}`,
  );
}

async function readJson(
  operation: string,
  url: URL,
  authorization: string,
  trustedOrigin: string,
): Promise<OjsJsonResponse> {
  const response = await fetchWithExplicitRedirects(
    operation,
    url,
    authorization,
    trustedOrigin,
  );
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `OJS ${operation} returned a non-JSON response (${response.status}, ${response.url}).`,
    );
  }

  if (!response.ok) {
    const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const nestedError = record.error && typeof record.error === 'object'
      ? record.error as Record<string, unknown>
      : {};
    const message = typeof nestedError.message === 'string'
      ? nestedError.message
      : typeof record.message === 'string'
        ? record.message
        : `OJS ${operation} request failed with HTTP ${response.status}.`;
    throw new Error(`${message} Final URL: ${response.url}`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`OJS ${operation} returned an invalid integration response.`);
  }
  return { data: data as Record<string, unknown>, finalUrl: new URL(response.url) };
}

async function loadSourceDocument(
  files: OjsFileDescriptor[],
  filesUrl: URL,
  authorization: string,
  trustedOrigin: string,
  reviewerMode: boolean,
): Promise<OjsSourceDocument | undefined> {
  const eligible = [...files]
    .filter((file) => isDocx(file) && file.externalId && file.contentPath)
    .filter((file) => !file.size || file.size <= MAX_SOURCE_FILE_BYTES);

  const preferred = reviewerMode
    ? eligible.filter(isArticleTextSubmissionFile)
    : eligible.filter(isArticleTextSubmissionFile);
  const candidate = (preferred.length > 0 ? preferred : reviewerMode ? eligible : preferred)
    .sort(compareSourceFiles)[0];

  if (!candidate?.externalId || !candidate.contentPath) return undefined;

  const apiBase = new URL(filesUrl.toString());
  apiBase.pathname = apiBase.pathname.replace(/\/files\/?$/, '/');
  apiBase.search = '';
  apiBase.hash = '';
  const contentUrl = new URL(candidate.contentPath.replace(/^\//, ''), apiBase);

  const response = await fetchWithExplicitRedirects(
    `file ${candidate.externalId}`,
    contentUrl,
    authorization,
    trustedOrigin,
    candidate.mediaType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );

  if (!response.ok) {
    throw new Error(
      `OJS source file ${candidate.externalId} request failed with HTTP ${response.status}. Final URL: ${response.url}`,
    );
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_SOURCE_FILE_BYTES) {
    throw new Error('The OJS DOCX source file exceeds the 25 MB import limit.');
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SOURCE_FILE_BYTES) {
    throw new Error('The OJS DOCX source file exceeds the 25 MB import limit.');
  }

  return convertOjsSource(bytes, { ...candidate, externalId: candidate.externalId });
}

function convertOjsSource(bytes: Buffer, candidate: OjsFileDescriptor & { externalId: string }): OjsSourceDocument {
  const parsed = parseDocxSource(
    bytes,
    candidate.externalId,
    candidate.name || `submission-${candidate.externalId}.docx`,
    candidate.mediaType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );

  const withHeadings = applyDirectFormattingHeadingInference(bytes, parsed);
  const withInlineSemantics = applyInlineSemantics(bytes, withHeadings);
  const withStructuredContent = applyStructuredContent(bytes, withInlineSemantics);
  const withLists = applyStyleInheritedLists(bytes, withStructuredContent);
  const withNotes = applyNoteIntegrity(bytes, withLists);
  return applyReferenceSemantics(bytes, withNotes);
}

function isArticleTextSubmissionFile(file: OjsFileDescriptor): boolean {
  if (Number(file.stage) !== OJS_SUBMISSION_FILE_STAGE) return false;

  const genreKey = (file.genreKey || '').trim().toUpperCase();
  if (genreKey) return genreKey === OJS_ARTICLE_TEXT_GENRE_KEY;

  return (file.genreName || '').trim().toLowerCase() === 'article text';
}

function isDocx(file: OjsFileDescriptor): boolean {
  const type = (file.mediaType || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx');
}

function compareSourceFiles(a: OjsFileDescriptor, b: OjsFileDescriptor): number {
  const revisionDifference = Number(b.revision || 0) - Number(a.revision || 0);
  if (revisionDifference) return revisionDifference;
  return Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || '');
}

export async function loadOjsLaunchData(
  claims: LaunchClaims,
  payload: string,
  signature: string,
  installationBaseUrl: string,
): Promise<OjsLaunchData> {
  const reviewerMode = claims.actorMode === 'review';
  requireAnyScope(claims, reviewerMode ? ['review.metadata.read'] : ['metadata.read']);
  requireAnyScope(claims, reviewerMode ? ['review.files.read'] : ['files.read']);

  let trustedOrigin: string;
  try {
    trustedOrigin = new URL(installationBaseUrl).origin;
  } catch {
    throw new Error('The registered OJS installation URL is invalid.');
  }

  const authorization = `OMI ${payload}.${signature}`;
  const submissionResult = await readJson(
    'submission', apiUrl(claims, 'submission'), authorization, trustedOrigin,
  );
  const filesUrl = siblingOperationUrl(
    submissionResult.finalUrl, 'submission', 'files',
  );
  const contributorsUrl = siblingOperationUrl(
    submissionResult.finalUrl, 'submission', 'contributors',
  );

  const hasContributorScope = !reviewerMode && (claims.scope?.includes('contributors.read') ?? false);
  const [contributorsResult, filesResult] = await Promise.all([
    hasContributorScope
      ? readJson('contributors', contributorsUrl, authorization, trustedOrigin)
      : Promise.resolve<OjsJsonResponse | null>(null),
    readJson('files', filesUrl, authorization, trustedOrigin),
  ]);

  const contributors = contributorsResult && Array.isArray(contributorsResult.data.contributors)
    ? contributorsResult.data.contributors
    : [];
  const files = Array.isArray(filesResult.data.files)
    ? filesResult.data.files
    : [];

  const sourceDocument = await loadSourceDocument(
    files as OjsFileDescriptor[],
    filesResult.finalUrl,
    authorization,
    trustedOrigin,
    reviewerMode,
  );

  const result: OjsLaunchData = {
    submission: submissionResult.data.submission ?? null,
    contributors,
    files,
  };
  if (sourceDocument !== undefined) {
    result.sourceDocument = sourceDocument;
  }
  return result;
}

export interface OjsIssueArticle extends OjsLaunchData {
  submissionExternalId: string;
  publicationExternalId: string;
  sequence: number;
  sourceDocument: OjsSourceDocument;
}

export interface OjsIssueSection {
  externalId: string;
  title: Record<string, unknown>;
  sequence: number;
  articles: OjsIssueArticle[];
}

export interface OjsIssueImportData {
  context: Record<string, unknown>;
  issue: Record<string, unknown>;
  sections: OjsIssueSection[];
}

const MAX_ISSUE_ARTICLES = 100;
const MAX_ISSUE_JSON_BYTES = 8 * 1024 * 1024;
const MAX_ISSUE_HANDOFF_BYTES = 32 * 1024 * 1024;

function issueObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OJS issue response.');
  return value as Record<string, unknown>;
}

function issueId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error('Invalid OJS issue identifier.');
  return value;
}

/** Enforce the limit during streaming, including responses without Content-Length. */
async function readBoundedIssueBody(response: Response, limit: number): Promise<Buffer> {
  if (Number(response.headers.get('content-length') || 0) > limit) {
    await response.body?.cancel();
    throw new Error('OJS issue response exceeds the import size limit.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('OJS issue response has no body.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('OJS issue response exceeds the import size limit.');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetch the complete issue in manifest order. Fail closed on missing content,
 * identity mismatch or a changed publication; no incomplete handoff is returned.
 */
export async function loadOjsIssueImportData(
  claims: LaunchClaims,
  payload: string,
  signature: string,
  installationBaseUrl: string,
): Promise<OjsIssueImportData> {
  requireAnyScope(claims, ['issue.import.read']);
  const expectedIssue = issueId(claims.issue?.externalId);
  const expectedContext = issueId(claims.context?.externalId);
  const trustedOrigin = new URL(installationBaseUrl).origin;
  const authorization = `OMI ${payload}.${signature}`;
  const manifestOperation = 'issue-import/manifest';
  const fetchIssueJson = async (operation: string, url: URL) => {
    const response = await fetchWithExplicitRedirects(operation, url, authorization, trustedOrigin);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`OJS issue ${operation} failed with HTTP ${response.status}.`);
    }
    const body = await readBoundedIssueBody(response, MAX_ISSUE_JSON_BYTES);
    return { data: issueObject(JSON.parse(body.toString('utf8'))), finalUrl: new URL(response.url) };
  };
  const manifest = await fetchIssueJson(manifestOperation, apiUrl(claims, manifestOperation));
  const issue = issueObject(manifest.data.issue);
  const context = issueObject(manifest.data.context);
  if (issue.externalId !== expectedIssue || context.externalId !== expectedContext || issue.published !== false) {
    throw new Error('OJS returned a different or published issue.');
  }
  if (!Array.isArray(manifest.data.sections)) throw new Error('OJS issue sections are missing.');
  const sections: OjsIssueSection[] = [];
  const seenSections = new Set<string>();
  const seenArticles = new Set<string>();
  let count = 0;
  let outputBytes = Buffer.byteLength(JSON.stringify({ issue, context }), 'utf8');
  const addSize = (value: unknown) => {
    outputBytes += Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (outputBytes > MAX_ISSUE_HANDOFF_BYTES) throw new Error('OJS issue exceeds the 32 MB converted import limit.');
  };

  for (const sectionValue of manifest.data.sections) {
    const section = issueObject(sectionValue);
    const externalId = issueId(section.externalId);
    if (seenSections.has(externalId)) throw new Error('Duplicate OJS section.');
    seenSections.add(externalId);
    if (!Array.isArray(section.articles)) throw new Error('OJS issue articles are missing.');
    const title = Array.isArray(section.title) && section.title.length === 0 ? {} : issueObject(section.title);
    const sequence = section.sequence;
    if (typeof sequence !== 'number' || !Number.isFinite(sequence)) throw new Error('Invalid OJS section order.');
    const resultSection: OjsIssueSection = { externalId, title, sequence, articles: [] };
    addSize(resultSection);
    for (const articleValue of section.articles) {
      const article = issueObject(articleValue);
      const submissionExternalId = issueId(article.submissionExternalId);
      const publicationExternalId = issueId(article.publicationExternalId);
      const articleSequence = article.sequence;
      if (typeof articleSequence !== 'number' || !Number.isFinite(articleSequence)) throw new Error('Invalid OJS article order.');
      if (seenArticles.has(submissionExternalId)) throw new Error('Duplicate OJS article.');
      seenArticles.add(submissionExternalId);
      if (++count > MAX_ISSUE_ARTICLES) throw new Error('OJS issue exceeds the 100 article import limit.');
      if (Date.now() >= claims.exp * 1000) throw new Error('OJS issue assertion expired during import.');
      const operation = `issue-import/articles/${submissionExternalId}`;
      const articleResponse = await fetchIssueJson(operation,
        siblingOperationUrl(manifest.finalUrl, manifestOperation, operation));
      const submission = issueObject(articleResponse.data.submission);
      if (submission.externalId !== submissionExternalId || submission.publicationExternalId !== publicationExternalId) {
        throw new Error(`OJS article ${submissionExternalId} changed during import.`);
      }
      if (!Array.isArray(articleResponse.data.contributors) || !Array.isArray(articleResponse.data.files)) {
        throw new Error(`OJS article ${submissionExternalId} has an invalid source manifest.`);
      }
      const files = articleResponse.data.files.map(issueObject) as OjsFileDescriptor[];
      // OJS orders eligible files by editorial stage, latest version first.
      // Do not silently replace an oversized or broken final source with an earlier draft.
      const candidate = files[0];
      if (!candidate || !isDocx(candidate)) throw new Error(`OJS article ${submissionExternalId} has no eligible DOCX source.`);
      const fileId = issueId(candidate.externalId);
      if (Number(candidate.size || 0) > MAX_SOURCE_FILE_BYTES) throw new Error(`OJS article ${submissionExternalId} exceeds the source size limit.`);
      const fileOperation = `${operation}/files/${fileId}/content`;
      const sourceResponse = await fetchWithExplicitRedirects(fileOperation,
        siblingOperationUrl(manifest.finalUrl, manifestOperation, fileOperation),
        authorization, trustedOrigin, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      if (!sourceResponse.ok) {
        await sourceResponse.body?.cancel();
        throw new Error(`OJS article ${submissionExternalId} source returned HTTP ${sourceResponse.status}.`);
      }
      const bytes = await readBoundedIssueBody(sourceResponse, MAX_SOURCE_FILE_BYTES);
      const sourceDocument = convertOjsSource(bytes, { ...candidate, externalId: fileId });
      const result: OjsIssueArticle = {
        submissionExternalId, publicationExternalId, sequence: articleSequence, submission,
        contributors: articleResponse.data.contributors,
        files, sourceDocument,
      };
      addSize(result);
      resultSection.articles.push(result);
    }
    sections.push(resultSection);
  }
  return { context, issue, sections };
}
