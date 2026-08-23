# Cloud OAuth PR readiness checklist

This checklist tracks the final validation required before the cloud OAuth branch is marked ready for review.

- [x] OAuth provider architecture implemented for Google Drive, Microsoft OneDrive and Dropbox.
- [x] SharePoint kept explicitly in planned OAuth state.
- [x] Proton Drive represented as a planned Proton SDK/session integration, not generic OAuth.
- [x] OAuth and Proton help copy present for all 24 supported Studio locales.
- [x] Regression coverage added for production OAuth providers, SharePoint planned state and Proton SDK preview state.
- [x] OAuth localization completeness regression coverage added for all 24 locales.
- [ ] Frontend translation audits and test suite pass in CI.
- [ ] Frontend TypeScript/Vite build passes in CI.
- [ ] Server Prisma generation and TypeScript typecheck pass in CI.
- [ ] Desktop Tauri builds pass for Linux, Windows and macOS.
- [ ] Review CI results and resolve any failures before marking the PR ready for review.

Android and iOS release workflows remain explicit `workflow_dispatch` release jobs; they are not required merely to validate this OAuth-only change unless a platform-specific regression is discovered.
