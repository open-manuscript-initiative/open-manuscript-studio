import type { Page, Route } from '@playwright/test';

const TEST_USER = {
  id: 'user:e2e-editor',
  email: 'editor@example.test',
  emailVerified: true,
  status: 'active',
  profile: {
    fullName: 'E2E Editor',
    affiliation: 'Open Manuscript Initiative',
  },
  preferences: {
    interfaceLanguage: 'en',
    workingLanguages: ['en', 'hu'],
    timeZone: 'UTC',
  },
  identities: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-01-01T00:00:00.000Z',
};

const AUTH_PROVIDERS = {
  orcid: { enabled: false, label: 'ORCID' },
  omi: { enabled: false, label: 'OMI account' },
  google: { enabled: false, label: 'Google' },
  microsoft: { enabled: false, label: 'Microsoft' },
  oidc: { enabled: false, label: 'Institutional sign-in' },
};

export interface MockStudioApi {
  loginRequests: Array<Record<string, unknown>>;
  publicationRequests: string[];
  unhandledRequests: string[];
}

export async function installMockStudioApi(
  page: Page,
  options: { authenticated?: boolean } = {},
): Promise<MockStudioApi> {
  let authenticated = options.authenticated ?? false;
  const loginRequests: Array<Record<string, unknown>> = [];
  const publicationRequests: string[] = [];
  const unhandledRequests: string[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const requestKey = `${request.method()} ${url.pathname}`;

    if (request.method() === 'GET' && url.pathname === '/api/auth/providers') {
      await fulfillJson(route, 200, {
        providers: AUTH_PROVIDERS,
        deployment: { mode: 'personal', label: 'Personal' },
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/auth/me') {
      if (authenticated) {
        await fulfillJson(route, 200, { user: TEST_USER });
      } else {
        await fulfillJson(route, 401, {
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' },
        });
      }
      return;
    }

    if (request.method() === 'POST' && url.pathname === '/api/auth/login') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      loginRequests.push(payload);
      authenticated = true;
      await fulfillJson(route, 200, { user: TEST_USER });
      return;
    }

    if (request.method() === 'POST' && url.pathname === '/api/auth/logout') {
      authenticated = false;
      await route.fulfill({ status: 204 });
      return;
    }

    if (
      request.method() === 'POST'
      && url.pathname === '/api/publication/validate/jats'
    ) {
      publicationRequests.push(requestKey);
      await fulfillJson(route, 200, {
        standard: 'NISO JATS',
        version: '1.4',
        tagSet: 'articleauthoring',
        schema: 'DTD',
        schemaVariant: 'MathML3',
        schemaPackage: '@jats4r/dtds@0.0.10',
        engine: 'libxml2-wasm@0.7.2',
        valid: true,
        diagnostics: [],
      });
      return;
    }

    if (
      request.method() === 'POST'
      && url.pathname === '/api/publication/render/pdf'
    ) {
      publicationRequests.push(requestKey);
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'x-omi-pdf-renderer': 'e2e-vivliostyle',
          'x-omi-pdf-renderer-version': '1.0.0-test',
        },
        body: '%PDF-1.4\n% OMI E2E synthetic PDF artifact\n%%EOF\n',
      });
      return;
    }

    unhandledRequests.push(requestKey);
    await fulfillJson(route, 404, {
      error: {
        code: 'UNHANDLED_E2E_REQUEST',
        message: `No E2E response is configured for ${requestKey}.`,
      },
    });
  });

  return { loginRequests, publicationRequests, unhandledRequests };
}

export async function signInToStudio(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email address').fill('editor@example.test');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'No document is open' }).waitFor();
}

async function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}
