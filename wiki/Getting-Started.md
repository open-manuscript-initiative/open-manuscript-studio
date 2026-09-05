# Getting Started

## Use the hosted Studio

The public web application is available at [studio.openmanuscript.org](https://studio.openmanuscript.org/). Native packages and platform notes are published from the [Studio download page](https://openmanuscript.org/studio/).

Studio works with structured OMI manuscripts and supports portable OMI packages (`.omi.zip`) and OMI JSON (`.omi.json`) alongside publication exports such as JATS XML, HTML, DOCX, EPUB, LaTeX, and supported desktop publishing formats.

## Run the web client locally

Recommended baseline:

- Node.js 24
- npm
- Git

```bash
git clone https://github.com/open-manuscript-initiative/open-manuscript-studio.git
cd open-manuscript-studio
npm ci
npm run dev
```

Vite serves the development client at the address printed in the terminal, normally `http://localhost:5173`.

## Verify a change

```bash
npm run lint
npm test
npm run build
```

For browser journeys:

```bash
npm run playwright:install
npm run test:e2e
```

See [Playwright browser tests](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/playwright-browser-tests.md) for headed and debug modes.

## Run the API locally

The API requires PostgreSQL and its own dependency installation. Create separate application and identity databases, then configure `server/.env` from `server/.env.example`.

```bash
cd server
npm ci
npm run prisma:generate:all
npm run prisma:migrate:dev
npm run prisma:migrate:identity:dev
npm run dev
```

The default API port is `3001`. The default frontend origin is `http://localhost:5173`.

The server configuration requires `DATABASE_URL` and a 64-character hexadecimal `INTEGRATION_MASTER_KEY`. Identity commands also require `IDENTITY_DATABASE_URL`. Generate the master key with:

```bash
openssl rand -hex 32
```

Never commit `.env`, credentials, signing material, or integration secrets.

## Native development

Desktop builds additionally require Rust stable and the platform-specific [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm run desktop:dev
npm run desktop:build
```

Android:

```bash
npm run android:init
npm run android:dev
npm run android:build
```

iOS/iPadOS requires macOS, Xcode, CocoaPods, Rust iOS targets, and Apple signing configuration for device or store builds:

```bash
npm run ios:init
npm run ios:dev
npm run ios:build
```

Continue with [[Build and Release]] or the repository's [desktop and mobile guide](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/desktop-and-mobile.md).
