# Playwright browser tests

Open Manuscript Studio uses Playwright for deterministic browser-level smoke tests. The initial gate covers Chromium on a desktop viewport and Chromium with a Pixel 7 viewport. This matches the main rendering engines used by the hosted Studio, Windows WebView2 and Android while keeping pull-request feedback reasonably fast.

## Covered journeys

- public login, authenticated editor entry and logout;
- full-screen manuscript menu and the live publication editor;
- publication-editor ribbon controls and document canvas;
- responsive login and editor layout without horizontal overflow;
- release accessibility invariants on desktop and mobile viewports; and
- IndexedDB-backed unclosed-session recovery after a browser reload.

Authentication endpoints are intercepted inside the browser context. Tests therefore require neither a reusable account nor a database, and they never contact the production API. Any previously unknown `/api/` request receives a test-only 404 and is reported by the scenario so newly introduced dependencies cannot pass silently.

## Local commands

Install dependencies and the pinned Chromium headless shell once:

```bash
npm ci
npm run playwright:install
```

Run the suite:

```bash
npm run test:e2e
```

For investigation, use `npm run test:e2e:headed`, `npm run test:e2e:ui` or `npm run test:e2e:debug`. Open the last HTML report with `npm run test:e2e:report`.

Playwright starts Vite automatically on `127.0.0.1:5173`. To target an already running build, set `PLAYWRIGHT_BASE_URL`; in that mode Playwright does not start its own web server.

## CI diagnostics

The main CI job installs only Chromium's headless shell and runs the browser suite before server typechecking and the production build. A failed run retains the HTML report, screenshots, video and trace data for 14 days in the `playwright-diagnostics-*` artifact.

The test configuration retries failed cases twice in CI. A trace is captured on the first retry; screenshots and videos are retained only for failures.


## 1.0 hardening scenarios

The release-specific browser gates are:

```bash
npm run test:release-accessibility
npm run test:release-recovery:e2e
```

The accessibility gate checks labels, interactive accessible names, dialog
naming, image alt attributes, duplicate IDs, tabindex policy and a keyboard-only
login/menu path. The recovery gate edits a real manuscript surface, waits for
the debounced IndexedDB snapshot and requires the edited state to survive an
application reload.

These tests are regression evidence. They do not replace manual screen-reader
or platform assistive-technology acceptance where that is required for a
release.
