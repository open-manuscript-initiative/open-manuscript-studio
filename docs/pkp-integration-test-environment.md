# OJS/OMP integration test environment

This environment is the shared, reproducible foundation for installation-level
tests of the OJS–OMI and OMP–OMI connectors. It starts one selected PKP
application, the matching `studioIntegration` plugin, and the real Studio API.

The boundary is intentional:

- PKP uses its own MariaDB database and private file volumes;
- Studio uses separate application and identity PostgreSQL databases;
- neither application receives the other application's database credentials;
- the two database services are placed on separate internal Docker networks,
  so the other application cannot resolve or connect to them;
- all later workflow tests must cross the versioned `omi-integration/1` HTTP
  boundary; and
- no PKP core patch is applied.

## Included services

| Service | Purpose |
| --- | --- |
| `pkp` | OJS 3.5.0-4/3.5.0-5 (Stable acceptance) or OMP 3.5.0-4 (Preview) with the matching OMI plugin source |
| `pkp-db` | Isolated MariaDB for OJS/OMP |
| `studio-api` | The real Open Manuscript Studio API after both Prisma migrations |
| `studio-db` | Isolated PostgreSQL databases for Studio and OMI Identity |

The PKP application is installed through its native `tools/install.php` CLI.
The plugin descriptor is registered through PKP's
`lib/pkp/tools/installPluginVersion.php`. A dedicated PKP CLI fixture then uses
PKP repositories, services and DAOs to create the journal/press, enable and
configure the plugin, create editor/author/reviewer accounts, submit a DOCX,
create a required native review form, open an external review round and grant
exactly one file to the review. The
harness does not write application tables directly.

## Requirements

- Docker Engine with Docker Compose v2
- Node.js 24 and npm
- Git
- Playwright Chromium (`npm run playwright:install`)

Docker is not available in every development sandbox. `npm test` therefore
contains a static boundary/configuration test, while the dedicated GitHub
Actions workflow performs the real container startup.

## Local commands

Install dependencies once:

```bash
npm ci
npm run playwright:install
```

Start and install the OJS 3.5.0-4 Stable target:

```bash
PKP_VERSION=3_5_0-4 npm run pkp:up -- ojs
PKP_VERSION=3_5_0-4 npm run pkp:verify -- ojs
PKP_VERSION=3_5_0-4 npm run pkp:test -- ojs
```

Repeat with `PKP_VERSION=3_5_0-5` for the second Stable OJS target.
Use `omp` with `PKP_VERSION=3_5_0-4` for the Preview OMP target. The default endpoints are:

- PKP: `http://127.0.0.1:8080`
- Studio API: `http://127.0.0.1:3001`

Playwright addresses PKP as `http://pkp.test:8080`. Chromium maps that hostname
to the published local port, while the Studio container maps it to Docker's
host gateway. The Studio SSRF guard accepts this hostname only when
`NODE_ENV=test` and it is explicitly listed in
`INTEGRATION_TEST_ALLOWED_HOSTS`. The disposable PKP configuration likewise
allowlists `pkp.test`, loopback and the internal `pkp` service name in the
active (non-commented) setting, so PKP's host-header protection remains enabled
throughout the browser workflow. The PKP container is reloaded after
installation and the exact browser `Host` header is probed before Playwright
starts.
Production behavior is unchanged.

Override the ports or pinned PKP release when required:

```bash
PKP_HTTP_PORT=8180 STUDIO_API_HTTP_PORT=3101 PKP_VERSION=3_5_0-5 \
  npm run pkp:up -- ojs
```

The initial test-only PKP administrator credentials are:

```text
username: omiadmin
password: omi-test-admin
```

The generated role accounts all use the test-only password
`omi-test-user`: `omi-editor`, `omi-author` and `omi-reviewer`. Fixture IDs and
sentinels are written to the ignored
`tests/pkp-integration/runtime/fixture-<platform>-<pkp-version>.json` file for Playwright.

They may be overridden with `PKP_ADMIN_USERNAME`, `PKP_ADMIN_PASSWORD` and
`PKP_ADMIN_EMAIL`. These credentials and the database passwords in Compose are
for disposable local/CI environments only.

Collect diagnostics before teardown:

```bash
npm run pkp:logs -- ojs
npm run pkp:down -- ojs
```

`pkp:down` removes the selected environment's containers and test volumes.
Logs remain under `tests/pkp-integration/runtime/logs/`.
The test action also stores the PKP-side review writeback assertion as
`review-writeback-<platform>-<pkp-version>.json`. A successful stateful run also writes `acceptance-<platform>-<pkp-version>.json`, containing the Studio commit, plugin commit, release tier and the acceptance checks proven by that run.

## Plugin source selection

`pkp:up` clones the corresponding plugin's `main` branch into the ignored
`runtime/plugin` directory when it is absent. Set `PKP_PLUGIN_REF` before the
first local start to test a tag or branch. CI deliberately ignores this local
override and always checks out `main`.

To switch between OJS and OMP locally, tear down the current environment and
remove or move `tests/pkp-integration/runtime/plugin`; the harness refuses to
silently overwrite an existing checkout.

## GitHub Actions

The **PKP integration environment** workflow runs an explicit release matrix
for relevant pull requests and pushes:

- OJS 3.5.0-4 — **Stable**, release-blocking acceptance target;
- OJS 3.5.0-5 — **Stable**, release-blocking acceptance target;
- OMP 3.5.0-4 — **Preview**, retained as a clearly labelled compatibility target.

A manual run can select `ojs`, `omp` or `both`. CI always checks out the
matching plugin's protected `main` branch; arbitrary plugin refs are
intentionally not accepted by `workflow_dispatch`. Every matrix target receives
a version-specific Compose project, fixture, Playwright report and acceptance
artifact.

The workflow explicitly disables both configured and automatic package-manager
caching. Both checkouts also remove their persisted GitHub credentials, and the
plugin is checked out only after the trusted Studio and Playwright dependencies
have been installed. Together with the fixed plugin ref, this keeps integration
tests from poisoning a later default-branch build cache or reusing the job
token. Local disposable environments may still select a branch or tag through
`PKP_PLUGIN_REF` as described above.

## Tested workflow boundary

The suite verifies:

1. native PKP installation, Studio migrations and both health boundaries;
2. plugin descriptor loading, capability discovery and Studio registration;
3. signed editor and author launches with different least-privilege scopes;
4. a current double-anonymous reviewer assignment and nonce replay rejection;
5. denial of contributor identity and non-granted file access for reviewers;
6. DOCX import into a Studio snapshot that is always `documentKind: article`
   and `authorIdentity: hidden`;
7. OMP review binding to one assigned chapter, excluding the parent monograph
   and sibling chapter metadata/files;
8. reviewer language/typesetting corrections, a required native PKP review
   form, and a negative submit assertion proving the required form cannot be
   bypassed;
9. separate author-visible and editor-only feedback, including a PKP-side
   assertion that editor-only text never enters the author-visible comment;
10. OJS-native reviewer recommendation options/identifiers without inventing a
    Studio replacement; and
11. signed Studio-to-PKP review-result writeback, followed by PKP-native DAO
    assertions that comments, form responses and the OJS recommendation were
    actually persisted.

The suite is stateful and therefore deliberately has no Playwright retries. A
failure keeps traces, screenshots, video, Compose logs, install logs and the
fixture metadata in the uploaded diagnostics artifact.


## 1.0 OJS Stable acceptance

The release-level acceptance contract is documented in
`docs/release/ojs-3.5-stable-acceptance.md`. The two OJS matrix jobs are
mandatory evidence for the Route A Stable claim. OMP remains Preview and does
not inherit the OJS Stable label merely because it executes the same shared
harness.
