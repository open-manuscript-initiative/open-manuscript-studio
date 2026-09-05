import { readFileSync } from 'node:fs';

import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

interface FixtureUser {
  id: string;
  username: string;
  password: string;
  email: string;
  fullName: string;
}

interface WorkflowFixture {
  platform: 'ojs' | 'omp';
  publicBaseUrl: string;
  studioBaseUrl: string;
  installationId: string;
  context: { id: string; path: string; name: string };
  submission: { id: string; title: string };
  component: null | {
    assignedId: string;
    assignedTitle: string;
    unassignedId: string;
    unassignedTitle: string;
  };
  reviewAssignmentId: string;
  reviewForm: { elementId: string; response: string };
  sourceFileId: string;
  forbiddenFileId: string;
  users: {
    editor: FixtureUser;
    author: FixtureUser;
    reviewer: FixtureUser;
  };
  authorIdentitySentinels: string[];
  contentSentinels: { assigned: string; forbidden: string };
}

interface LaunchClaims {
  protocol: string;
  profile: string;
  installationId: string;
  context?: { externalId?: string; type?: string; path?: string };
  submission?: { externalId?: string };
  component?: { externalId?: string; type?: string; title?: string };
  reviewAssignment?: { externalId?: string; round?: number };
  actor?: { externalId?: string };
  actorMode?: 'editor' | 'author' | 'review';
  scope?: string[];
  apiBaseUrl?: string;
  externalBaseUrl?: string;
}

interface LaunchAssertion {
  launchUrl: string;
  payload: string;
  signature: string;
  claims: LaunchClaims;
}

const fixturePath = process.env.PKP_FIXTURE_FILE;
if (!fixturePath) {
  throw new Error('PKP_FIXTURE_FILE is required. Run pkp:up before pkp:test.');
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as WorkflowFixture;
const pkpBaseUrl = process.env.PKP_BASE_URL ?? fixture.publicBaseUrl;
const studioApiBaseUrl = process.env.STUDIO_API_BASE_URL ?? fixture.studioBaseUrl;
const platform = process.env.PKP_PLATFORM ?? fixture.platform;
const contextBaseUrl = `${pkpBaseUrl}/index.php/${fixture.context.path}`;

test('Studio API and the installed PKP context are healthy', async ({ page, request }) => {
  const studioResponse = await request.get(`${studioApiBaseUrl}/api/health`);
  await expectApiStatus(studioResponse, 200);
  await expect(studioResponse.json()).resolves.toMatchObject({
    status: 'ok',
    service: 'open-manuscript-studio-server',
    database: 'connected',
  });

  const pkpResponse = await page.goto(contextBaseUrl, { waitUntil: 'domcontentloaded' });
  expect(pkpResponse?.status()).toBeLessThan(500);
  expect(page.url()).not.toContain('/install');
  await expect(page.locator('html')).toBeVisible();

  const capabilities = await browserJson(page, `${contextBaseUrl}/api/v1/omi-integration`);
  expect(capabilities.status).toBe(200);
  expect(capabilities.json).toMatchObject({
    protocol: 'omi-integration/1',
    profile: `omi-integration/1/${platform}`,
    context: {
      externalId: fixture.context.id,
      path: fixture.context.path,
    },
  });
});

test('editor and author launches enforce their signed role boundaries', async ({ page, request }) => {
  await loginToPkp(page, fixture.users.editor);
  const editor = await getLaunchAssertion(page, 'editor');
  expect(editor.claims).toMatchObject({
    protocol: 'omi-integration/1',
    profile: `omi-integration/1/${platform}`,
    installationId: fixture.installationId,
    actorMode: 'editor',
    actor: { externalId: fixture.users.editor.id },
    submission: { externalId: fixture.submission.id },
  });
  expect(editor.claims.scope).toEqual(expect.arrayContaining([
    'metadata.read',
    'contributors.read',
    'files.read',
  ]));

  const editorHandoff = await consumeStandardLaunch(request, editor);
  expect(editorHandoff).toMatchObject({
    protocol: 'omi-integration/1',
    profile: `omi-integration/1/${platform}`,
    actorMode: 'editor',
    submission: { externalId: fixture.submission.id },
  });
  expect(JSON.stringify(editorHandoff)).toContain('Hidden');

  await logoutFromPkp(page);
  await loginToPkp(page, fixture.users.author);
  const author = await getLaunchAssertion(page, 'author');
  expect(author.claims).toMatchObject({
    actorMode: 'author',
    actor: { externalId: fixture.users.author.id },
  });
  expect(author.claims.scope).toContain('metadata.read');
  expect(author.claims.scope).not.toContain('contributors.read');

  const denied = await signedBrowserRequest(
    page,
    `${requiredApiBase(author.claims)}/contributors`,
    author,
  );
  expect(denied.status).toBe(403);
});

test('reviewer receives one anonymous article and can return corrections', async ({ page, request }) => {
  await loginToPkp(page, fixture.users.reviewer);
  const launch = await getLaunchAssertion(page, 'review');

  expect(launch.claims).toMatchObject({
    protocol: 'omi-integration/1',
    profile: `omi-integration/1/${platform}`,
    installationId: fixture.installationId,
    actorMode: 'review',
    actor: { externalId: fixture.users.reviewer.id },
    submission: { externalId: fixture.submission.id },
    reviewAssignment: { externalId: fixture.reviewAssignmentId },
  });
  expect(launch.claims.scope).toEqual(expect.arrayContaining([
    'review.metadata.read',
    'review.files.read',
    'review.manuscript.read',
    'review.revision.write',
    'review.response.write',
  ]));
  for (const forbiddenScope of [
    'contributors.read',
    'review.identity.read',
    'metadata.write',
  ]) {
    expect(launch.claims.scope).not.toContain(forbiddenScope);
  }

  if (platform === 'omp') {
    expect(launch.claims.component).toEqual({
      externalId: fixture.component?.assignedId,
      type: 'article',
      title: fixture.component?.assignedTitle,
    });
  } else {
    expect(launch.claims.component).toBeUndefined();
  }

  const apiBaseUrl = requiredApiBase(launch.claims);
  const submission = await signedBrowserRequest(page, `${apiBaseUrl}/submission`, launch);
  expect(submission.status).toBe(200);
  assertNoAuthorIdentity(submission.json);
  if (platform === 'omp') {
    const serialized = JSON.stringify(submission.json);
    expect(serialized).toContain(fixture.component?.assignedTitle ?? 'Assigned OMP study');
    expect(serialized).not.toContain(fixture.submission.title);
    expect(serialized).not.toContain('PARENT METADATA SENTINEL');
    expect(serialized).not.toContain(fixture.component?.unassignedTitle ?? 'Unassigned OMP study');
  }

  const contributors = await signedBrowserRequest(page, `${apiBaseUrl}/contributors`, launch);
  expect(contributors.status).toBe(403);

  const files = await signedBrowserRequest(page, `${apiBaseUrl}/files`, launch);
  expect(files.status).toBe(200);
  expect(files.json).toMatchObject({
    files: [expect.objectContaining({ externalId: fixture.sourceFileId })],
  });
  const visibleFiles = (files.json as { files: Array<{ externalId?: string }> }).files;
  expect(visibleFiles).toHaveLength(1);
  expect(visibleFiles.map((file) => file.externalId)).not.toContain(fixture.forbiddenFileId);

  const forbiddenFile = await signedBrowserRequest(
    page,
    `${apiBaseUrl}/files/${fixture.forbiddenFileId}/content`,
    launch,
  );
  expect(forbiddenFile.status).toBe(403);

  await authenticateStudioReviewer(request);
  const reviewLaunch = await request.post(
    `${studioApiBaseUrl}/integrations/${platform}/review/launch`,
    { data: { payload: launch.payload, signature: launch.signature } },
  );
  await expectApiStatus(reviewLaunch, 200);
  const reviewLaunchBody = await reviewLaunch.json() as {
    assignmentId: string;
    reviewForm: null | { externalId: string; elementCount: number };
  };
  const { assignmentId } = reviewLaunchBody;
  expect(assignmentId).toBeTruthy();
  expect(reviewLaunchBody.reviewForm).toMatchObject({ elementCount: 1 });

  const replay = await request.post(
    `${studioApiBaseUrl}/integrations/${platform}/review/launch`,
    { data: { payload: launch.payload, signature: launch.signature } },
  );
  await expectApiStatus(replay, 401);
  await expect(replay.json()).resolves.toMatchObject({
    error: { code: expect.stringContaining('INVALID') },
  });

  const assignmentResponse = await request.get(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}`,
  );
  await expectApiStatus(assignmentResponse, 200);
  const assignment = await assignmentResponse.json();
  expect(assignment).toMatchObject({
    review: {
      id: assignmentId,
      anonymityMode: 'double_blind',
      status: 'invited',
    },
  });
  assertNoAuthorIdentity(assignment);

  const manuscriptResponse = await request.get(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/manuscript`,
  );
  await expectApiStatus(manuscriptResponse, 200);
  const manuscriptEnvelope = await manuscriptResponse.json() as {
    manuscript: {
      documentKind: string;
      authorIdentity: string;
      title: string;
      keywords: string[];
      blocks: Array<{ type: string; text?: string }>;
    };
  };
  expect(manuscriptEnvelope.manuscript).toMatchObject({
    documentKind: 'article',
    authorIdentity: 'hidden',
    title: platform === 'omp'
      ? fixture.component?.assignedTitle
      : fixture.submission.title,
  });
  const manuscriptText = JSON.stringify(manuscriptEnvelope);
  expect(manuscriptText).toContain(fixture.contentSentinels.assigned);
  expect(manuscriptText).not.toContain(fixture.contentSentinels.forbidden);
  expect(manuscriptText).not.toContain('PARENT METADATA SENTINEL');
  assertNoAuthorIdentity(manuscriptEnvelope);

  const accepted = await request.post(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/accept`,
  );
  await expectApiStatus(accepted, 200);

  const reviewFormResponse = await request.get(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/review-form`,
  );
  await expectApiStatus(reviewFormResponse, 200);
  const reviewForm = await reviewFormResponse.json();
  expect(reviewForm).toMatchObject({
    reviewForm: {
      definition: {
        elements: [expect.objectContaining({
          externalId: fixture.reviewForm.elementId,
          type: 'textarea',
          required: true,
          authorVisible: true,
        })],
      },
    },
  });

  const savedReviewForm = await request.put(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/review-form`,
    {
      data: {
        responses: [{
          elementExternalId: fixture.reviewForm.elementId,
          value: fixture.reviewForm.response,
        }],
      },
    },
  );
  await expectApiStatus(savedReviewForm, 200);
  await expect(savedReviewForm.json()).resolves.toMatchObject({
    reviewForm: {
      responses: [{
        elementExternalId: fixture.reviewForm.elementId,
        value: fixture.reviewForm.response,
      }],
    },
  });

  const corrected = {
    ...manuscriptEnvelope.manuscript,
    blocks: manuscriptEnvelope.manuscript.blocks.map((block, index) =>
      index === manuscriptEnvelope.manuscript.blocks.length - 1 && block.text
        ? { ...block, text: `${block.text} Corrected line break and hyphenation.` }
        : block,
    ),
  };
  const revision = await request.put(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/revision`,
    { data: corrected },
  );
  await expectApiStatus(revision, 200);
  expect(JSON.stringify(await revision.json())).toContain('Corrected line break and hyphenation.');

  for (const feedback of [
    { visibility: 'AUTHOR_AND_EDITOR', body: 'Author-visible E2E review comment.' },
    { visibility: 'EDITOR_ONLY', body: 'Editor-only E2E review comment.' },
  ]) {
    const response = await request.post(
      `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/feedback`,
      { data: feedback },
    );
    await expectApiStatus(response, 201);
  }

  const submitted = await request.post(
    `${studioApiBaseUrl}/api/reviews/assigned/${assignmentId}/submit`,
    {
      data: platform === 'ojs'
        ? { recommendation: 'MINOR_REVISION' }
        : {},
    },
  );
  await expectApiStatus(submitted, 200);
  await expect(submitted.json()).resolves.toMatchObject({
    review: { status: 'submitted' },
    ojsWriteback: { status: 'synced' },
  });
});

async function loginToPkp(page: Page, user: FixtureUser): Promise<void> {
  await page.goto(`${contextBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').fill(user.username);
  await page.locator('input[name="password"]').fill(user.password);
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    submit.click(),
  ]);
  expect(page.url()).not.toContain('/login/signIn');
}

async function logoutFromPkp(page: Page): Promise<void> {
  await page.goto(`${contextBaseUrl}/login/signOut`, { waitUntil: 'domcontentloaded' });
}

async function getLaunchAssertion(page: Page, mode: 'editor' | 'author' | 'review'): Promise<LaunchAssertion> {
  const result = await browserJson(
    page,
    `${contextBaseUrl}/omiIntegration/launch?submissionId=${encodeURIComponent(fixture.submission.id)}&mode=${mode}&redirect=0`,
  );
  expect(result.status).toBe(200);
  const launchUrl = findStringProperty(result.json, 'launchUrl');
  if (!launchUrl) throw new Error(`PKP did not return a launchUrl: ${JSON.stringify(result.json)}`);
  const url = new URL(launchUrl);
  const payload = url.searchParams.get('payload');
  const signature = url.searchParams.get('signature');
  if (!payload || !signature) throw new Error('PKP returned an incomplete signed launch URL.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LaunchClaims;
  return { launchUrl, payload, signature, claims };
}

async function consumeStandardLaunch(
  request: APIRequestContext,
  launch: LaunchAssertion,
): Promise<unknown> {
  const launchEndpoint = `${studioApiBaseUrl}/integrations/${platform}/launch`;
  const response = await request.get(launchEndpoint, {
    params: { payload: launch.payload, signature: launch.signature },
    maxRedirects: 0,
  });
  await expectApiStatus(response, 302);
  const location = response.headers().location;
  if (!location) throw new Error('Studio did not return a handoff redirect.');
  const handoffQuery = platform === 'ojs' ? 'omiOjsLaunch' : 'omiOmpLaunch';
  const token = new URL(location, studioApiBaseUrl).searchParams.get(handoffQuery);
  if (!token) throw new Error('Studio handoff redirect did not contain a token.');
  const handoff = await request.get(
    `${studioApiBaseUrl}/integrations/${platform}/handoff/${encodeURIComponent(token)}`,
  );
  await expectApiStatus(handoff, 200);
  return handoff.json();
}

async function authenticateStudioReviewer(request: APIRequestContext): Promise<void> {
  const credentials = {
    email: `pkp-${platform}-reviewer@studio.test`,
    password: 'omi-studio-reviewer-1',
  };
  const registered = await request.post(`${studioApiBaseUrl}/api/auth/register`, {
    data: {
      ...credentials,
      fullName: 'Studio Integration Reviewer',
      interfaceLanguage: 'en',
    },
  });
  if (registered.status() === 201) return;

  const login = await request.post(`${studioApiBaseUrl}/api/auth/login`, {
    data: credentials,
  });
  await expectApiStatus(login, 200);
}

async function browserJson(
  page: Page,
  url: string,
): Promise<{ status: number; json: unknown }> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response) throw new Error(`No browser response for ${url}`);
  const body = await page.locator('body').innerText();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`Expected JSON from ${url}, received: ${body.slice(0, 500)}`);
  }
  return { status: response.status(), json };
}

async function signedBrowserRequest(
  page: Page,
  url: string,
  launch: LaunchAssertion,
): Promise<{ status: number; json: unknown }> {
  return page.evaluate(async ({ target, authorization }) => {
    const response = await fetch(target, {
      headers: { Accept: 'application/json', Authorization: authorization },
      credentials: 'same-origin',
    });
    const responseText = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = { body: responseText.slice(0, 500) };
    }
    return { status: response.status, json };
  }, {
    target: url,
    authorization: `OMI ${launch.payload}.${launch.signature}`,
  });
}

async function expectApiStatus(response: APIResponse, expected: number): Promise<void> {
  if (response.status() === expected) return;
  const body = await response.text().catch(() => '<unreadable response>');
  throw new Error(
    `Expected HTTP ${expected} from ${response.url()}, received ${response.status()}: ${body.slice(0, 1_000)}`,
  );
}

function requiredApiBase(claims: LaunchClaims): string {
  if (!claims.apiBaseUrl) throw new Error('The launch assertion has no API base URL.');
  return claims.apiBaseUrl.replace(/\/$/, '');
}

function findStringProperty(value: unknown, property: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record[property] === 'string') return record[property];
  for (const nested of Object.values(record)) {
    const match = findStringProperty(nested, property);
    if (match) return match;
  }
  return undefined;
}

function assertNoAuthorIdentity(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const sentinel of fixture.authorIdentitySentinels) {
    expect(serialized).not.toContain(sentinel);
  }
}
