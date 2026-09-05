# Contributing

Contributions to code, tests, translations, accessibility, documentation, interoperability fixtures, and scholarly workflow design are welcome.

## Before starting

1. Read the repository [README](https://github.com/open-manuscript-initiative/open-manuscript-studio#readme), [CONTRIBUTING.md](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/CONTRIBUTING.md), and [Code of Conduct](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/CODE_OF_CONDUCT.md).
2. Search the [issue tracker](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues) and existing pull requests.
3. For a substantial or compatibility-sensitive change, open an issue first so the model, migration, and integration boundaries can be agreed before implementation.
4. Keep changes modular and aligned with the OMI document, annotation, citation, identity, review, and publishing models.

## Development workflow

```bash
git clone https://github.com/open-manuscript-initiative/open-manuscript-studio.git
cd open-manuscript-studio
npm ci
```

Create a focused branch, implement the change, and keep generated or platform-specific files out of the diff unless the change actually requires them.

Minimum verification for frontend/shared-core changes:

```bash
npm run lint
npm test
npm run build
```

When the visible user journey changes:

```bash
npm run playwright:install
npm run test:e2e
```

For API or Prisma changes:

```bash
cd server
npm ci
npm run prisma:generate:all
npm run typecheck
npm run build
```

Database changes must include forward migrations in the correct migration tree. Do not edit an already applied migration to disguise a new schema change.

## Pull-request checklist

- The change solves one clearly stated problem.
- Tests cover new behavior and important regressions.
- Desktop and mobile responsive behavior are considered where relevant.
- Import/export behavior preserves semantic structure and stable identifiers.
- New user-facing strings follow the localization workflow.
- Secrets, real user data, production identifiers, and generated credentials are absent.
- Documentation and release notes are updated when public behavior changes.
- Application, schema, integration, and platform build versions remain conceptually separate.

## Localization

Interface locales are JSON/PO managed. Use the repository scripts rather than editing generated output blindly:

```bash
npm run i18n:validate-json
npm run i18n:po:audit
npm run i18n:po:roundtrip
```

See [localization](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/localization.md) and the current [translation audit](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/translation-audit.md).

## Security reports

Do not open a public issue for an exploitable vulnerability. Follow the repository [Security Policy](https://github.com/open-manuscript-initiative/open-manuscript-studio/security/policy) and use GitHub private vulnerability reporting when available.
