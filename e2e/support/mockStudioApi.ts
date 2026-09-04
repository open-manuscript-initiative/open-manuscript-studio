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
  google: { enabled: false, label: 'Google' },
  microsoft: { enabled: false, label: 'Microsoft' },
  oidc: { enabled: false, label: 'Institutional sign-in' },
};

export interface MockStudioApi {
  loginRequests: Array<Record<string, unknown>>;
  unhandledRequests: string[];
}

export async function installMockStudioApi(
  page: Page,
  options: { authenticated?: boolean } = {},
): Promise<MockStudioApi> {
  let authenticated = options.authenticated ?? false;
  const loginRequests: Array<Record<string, unknown>> = [];
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

    unhandledRequests.push(requestKey);
    await fulfillJson(route, 404, {
      error: {
        code: 'UNHANDLED_E2E_REQUEST',
        message: `No E2E response is configured for ${requestKey}.`,
      },
    });
  });

  return { loginRequests, unhandledRequests };
}

export async function signInToStudio(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email address').fill('editor@example.test');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('section.editor[aria-label="Manuscript editor"]').waitFor();
}

async function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}
