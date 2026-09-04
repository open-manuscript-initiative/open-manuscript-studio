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
| `pkp` | OJS or OMP 3.5.0-4 with the matching OMI plugin source |
| `pkp-db` | Isolated MariaDB for OJS/OMP |
| `studio-api` | The real Open Manuscript Studio API after both Prisma migrations |
| `studio-db` | Isolated PostgreSQL databases for Studio and OMI Identity |

The PKP application is installed through its native `tools/install.php` CLI.
The plugin descriptor is registered through PKP's
`lib/pkp/tools/installPluginVersion.php`; the harness does not write PKP tables
directly. The plugin is deliberately not enabled yet because a fresh PKP site
has no journal or press context. Context creation, plugin configuration and
author/editor/reviewer workflows belong to the next E2E layer.

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

Start and install OJS:

```bash
npm run pkp:up -- ojs
npm run pkp:verify -- ojs
npm run pkp:test -- ojs
```

Use `omp` in place of `ojs` for OMP. The default endpoints are:

- PKP: `http://127.0.0.1:8080`
- Studio API: `http://127.0.0.1:3001`

Override the ports or pinned PKP release when required:

```bash
PKP_HTTP_PORT=8180 STUDIO_API_HTTP_PORT=3101 PKP_VERSION=3_5_0-4 \
  npm run pkp:up -- omp
```

The initial test-only PKP administrator credentials are:

```text
username: omiadmin
password: omi-test-admin
```

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

## Plugin source selection

`pkp:up` clones the corresponding plugin's `main` branch into the ignored
`runtime/plugin` directory when it is absent. Set `PKP_PLUGIN_REF` before the
first start to test a tag or branch. CI checks out the requested ref directly.

To switch between OJS and OMP locally, tear down the current environment and
remove or move `tests/pkp-integration/runtime/plugin`; the harness refuses to
silently overwrite an existing checkout.

## GitHub Actions

The **PKP integration environment** workflow runs both platforms for relevant
pull requests and pushes. A manual run can select `ojs`, `omp` or `both`, and
can choose a plugin branch/tag through `plugin_ref`. Each platform receives
separate Compose project names, volumes and diagnostic artifacts.

Because `plugin_ref` may select code that is not yet trusted, this workflow
does not restore or save a shared dependency cache. Both checkouts also remove
their persisted GitHub credentials, and the plugin is checked out only after
the trusted Studio and Playwright dependencies have been installed. This keeps
manual plugin tests from poisoning a later default-branch build cache or
reusing the job token.

## Current smoke boundary

This first layer verifies:

1. native PKP installation succeeds;
2. Studio migrations and `/api/health` succeed;
3. the selected plugin profile is present, its descriptor is registered, and
   its class loads inside PKP's application bootstrap;
4. PKP can reach Studio and Studio can reach PKP on the internal network; and
5. Playwright can render the installed PKP application outside the installer.

It does not yet create a journal/press, submission, review round or users. Those
fixtures and the signed author/editor/reviewer journeys will be added on top of
this environment without weakening the database and identity boundaries above.
