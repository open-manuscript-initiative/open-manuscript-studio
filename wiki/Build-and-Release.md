# Build and Release

Open Manuscript Studio uses one frontend core and Tauri 2 packaging for desktop and mobile. Official releases must be produced from the official repository and its controlled workflows.

## Local verification

```bash
npm ci
npm run lint
npm test
npm run build
```

Browser smoke tests:

```bash
npm run playwright:install
npm run test:e2e
```

Server verification:

```bash
cd server
npm ci
npm run prisma:generate:all
npm run typecheck
npm run build
```

## Native build commands

| Target | Command | Main artifacts |
| --- | --- | --- |
| Windows / Linux / macOS | `npm run desktop:build` | MSI/EXE, AppImage/DEB, app/DMG according to platform |
| Android | `npm run android:build` | APK/AAB according to Tauri/Gradle configuration |
| iOS / iPadOS | `npm run ios:build` | Xcode/Tauri application build |
| iOS simulator | `npm run ios:build:simulator` | Apple Silicon simulator app |

Native builds require the relevant Rust targets, operating-system SDKs, and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Signed Apple and Android distribution additionally requires credentials that are never committed to the repository.

## GitHub Actions

The repository separates verification, packaging, integration testing, and promotion:

- `ci.yml` — localization checks, lint, unit/model tests, Playwright smoke tests, server typecheck, web build, and production deployment on approved `main` pushes
- `tauri-desktop.yml` — Windows, Linux, macOS, and Android packages
- `android-release.yml` — signed Android release flow
- `ios-simulator.yml` — unsigned simulator validation
- `ios-release.yml` — signed Apple distribution path
- `pkp-integration-environment.yml` — isolated OJS/OMP integration matrix
- `promote-current-release.yml` — controlled release promotion

See the [Actions page](https://github.com/open-manuscript-initiative/open-manuscript-studio/actions) for the current run state.

## Release rules

1. Keep `package.json`, Tauri configuration, and user-visible release metadata consistent.
2. Keep application version, OMI schema version, integration protocol version, and store build number separate.
3. Update `CHANGELOG.md` for notable behavior.
4. Run the full CI and relevant platform build matrix.
5. Create official artifacts only from the official repository workflow.
6. Sign/notarize artifacts where the platform requires it.
7. Verify update metadata and download links before promotion.
8. Do not describe an unsigned or locally modified binary as an official release.

## Current hardening boundary

The public beta build paths exist across the supported platform family. Work toward the release candidate concentrates on regression removal, recovery behavior, compatibility, accessibility, long-document performance, migration discipline, and trusted distribution. macOS notarization and public iOS/TestFlight provisioning still require production Apple credentials and device validation.

## References

- [Release notes](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/CHANGELOG.md)
- [Desktop and mobile guide](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/desktop-and-mobile.md)
- [Android release guide](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/android-release.md)
- [iOS and iPadOS guide](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/ios-ipados.md)
- [Code Signing Policy](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/CODE_SIGNING_POLICY.md)
