# Studio server directory API

The directory is a discovery and availability service. A Studio client uses it only to find a participating server. It must then connect directly to that server for sign-in, documents, uploads, collaboration, and all other application traffic.

## Automatic public directory (default)

Public production installations automatically announce their existing canonical `FRONTEND_ORIGIN` after the API starts listening, then once every 24 hours. Operators do not need a separate registration command, registry ID, bearer token, DNS TXT record, GitHub App or scheduled task. The registry host automatically maintains its own entry directly in its database, without sending HTTP requests to itself.

Each remote announcement contains only the origin. The registry sends a fresh random challenge to that origin's fixed `/api/v1/server-registry/identity` endpoint over HTTPS, validates the challenge and exact origin, and reads the public name, version and capabilities from that server. It never accepts those fields from the announcer or returns credentials to it. The transport checks and pins public A/AAAA addresses at socket creation, rejects private/reserved targets and redirects, enforces an 8-second timeout and an 8 KiB response limit. The public name comes from the existing institutional name or hostname; the version comes from the application package. The registry host uses the same metadata for its local entry.

Production HTTPS deployments participate by default. Development, localhost and HTTP instances are not automatically listed. A private production installation may explicitly opt out with `OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY=false`; this also disables its identity response. Existing explicit revocations and quarantined `VERIFYING` entries cannot be overridden by automatic discovery. A pending DNS registration can be completed by a successful HTTPS proof without exposing its old private proof or issuing a token. Manual credentials continue working for existing installations; incomplete legacy credentials fall back to automatic discovery.

Successful signals refresh persisted PostgreSQL metadata. Failed requests retry with backoff from one minute to one hour; a successful signal restores the daily interval. Repeated announcements for an entry verified less than 12 hours ago do not probe it again and do not advance last-seen time. In-flight probes for one origin are coalesced; announcements are rate limited.

The OMI website loads `/servers/daily` on opening and once every 24 hours while open. The public response can be cached for 24 hours and contains only entries with a signal in the last 48 hours. The page displays the last signal and list-generation time, rejects expired responses, and retries temporary failures after five minutes. There is no daily Git commit, website edit, rebuild, deployment or manual browser refresh. A daily directory is not a real-time availability guarantee.

Deploy the updated central API first, then participating APIs and the website through their normal deployment processes. This change requires no new database migration; the existing registry migrations must already have been applied. Existing installations start participating when their API is upgraded/restarted. Check the daily endpoint and the `/hu/servers/` page after rollout. GitHub audit setup below applies only to the retained manual registration path.

## Legacy manual DNS registration: registry operator setup

Configure the registry host with a GitHub App installed on the catalogue repository. The App requires the repository permission **Issues: write**. Set:

- `OMI_SERVER_REGISTRY_GITHUB_APP_ID`
- `OMI_SERVER_REGISTRY_GITHUB_INSTALLATION_ID`
- `OMI_SERVER_REGISTRY_GITHUB_PRIVATE_KEY`
- `OMI_SERVER_REGISTRY_GITHUB_REPOSITORY`

The private key remains on the registry host. The App creates an audit issue after domain verification. It does not receive heartbeat data as commits.

Apply the database migration with the normal Studio server migration process. Keep the registry host's database backed up.

## Legacy manual DNS registration: register an instance

The server operator explicitly opts in. In a Docker deployment, run:

```sh
docker compose -f compose.yml exec api npm run server:register -- --name "Research Studio" --origin https://studio.example.org
```

The command returns a DNS TXT challenge. Publish it under the supplied name, wait for DNS propagation, and verify:

```sh
docker compose -f compose.yml exec api npm run server:register -- --verify REGISTRATION_ID
```

Successful verification creates a GitHub audit issue and returns a one-time heartbeat token. Store the returned instance ID and heartbeat token only in that Studio API's server-side environment:

- `OMI_SERVER_REGISTRY_INSTANCE_ID`
- `OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN`
- `OMI_SERVER_REGISTRY_ORIGIN`

Then restart the API container. The instance sends a jittered heartbeat approximately once every 24 hours, after an initial startup signal. A valid heartbeat token is required for each heartbeat. The token is stored as a SHA-256 hash by the registry and is not included in public responses.

## Endpoints

- `POST /api/v1/server-registry/registrations` creates a pending registration. Requests are rate limited.
- `POST /api/v1/server-registry/registrations/:id/verify` verifies the DNS TXT challenge, records an audit issue, and activates the entry.
- `POST /api/v1/server-registry/instances/:id/heartbeat` updates liveness and compatible version/capabilities.
- `POST /api/v1/server-registry/announcements` automatically discovers an origin through an HTTPS challenge; only `{ "origin": "https://studio.example.org" }` is accepted.
- `GET /api/v1/server-registry/identity?challenge=<64-hex-characters>` exposes the opted-in production server's public identity and echoes a fresh challenge, without secrets or caching.
- `GET /api/v1/server-registry/servers` returns public server metadata and online/offline state. The response is cacheable for 60 seconds.
- `GET /api/v1/server-registry/servers/daily` returns only recent entries, with `generatedAt`, `refreshAfterSeconds` and `heartbeatFreshForSeconds`. Cacheable for 24 hours; both public directory endpoints allow credential-free cross-origin reads.

The online threshold is 48 hours after the last heartbeat, allowing a delayed daily signal. Offline servers remain in the directory with an offline status so clients can avoid selecting them. The public endpoint never returns tokens, DNS challenges, internal IP addresses, or user data.

## Availability and scaling

The registry is not a reverse proxy or load balancer. Studio clients use the returned HTTPS origin and send all subsequent requests directly to that origin. Heartbeats are small server-to-server requests; directory reads are cacheable.

The reference implementation stores metadata in the registry host's PostgreSQL database. Keep it behind its own resource limits and TLS hostname. A future move to a standalone registry host does not change the public API contract.


## Registry authority hardening (2026-10-21)

The registry remains Preview and is discovery only. Domain control is not editorial authority, software certification or evidence of API compatibility. `online` means a successful HTTPS identity proof, a registry-local update, or a legacy authenticated heartbeat within the last 48 hours. The HTTPS proof checks only the discovery endpoint, not all Studio features. No automatic load balancing, account migration or manuscript forwarding occurs.

Registration returns two different values: publish only `verification.value` in DNS. Keep `registrationToken` private in the server environment as `OMI_SERVER_REGISTRATION_TOKEN`; the CLI sends it as a bearer credential during verification. It expires after 24 hours and is consumed on successful activation. Expired pending requests can be replaced by starting registration again. Never publish this proof or heartbeat credentials in DNS, GitHub, browser bundles or support logs. DNS TXT chunks within each record are concatenated before comparison.

Apply `20261022080000_registry_registration_authority` before deploying the new API, then deploy API before the updated clients/CLI/website. Existing ACTIVE entries and heartbeat credentials remain valid. Legacy PENDING entries are revoked and must register again; requests without private proof are deliberately rejected on both API surfaces. `/api/server-registry` remains a compatibility facade over exactly the same handlers and rate limit instances as `/api/v1/server-registry`.

A compare-and-swap claims PENDING → VERIFYING before the GitHub side effect. Only its owner can activate and receive the heartbeat token. Unknown audit/network outcomes remain VERIFYING and are not automatically retried: the registry operator must inspect the recorded registration ID and GitHub issues, reconcile the audit, revoke the quarantined row through controlled administration, and request fresh registration. Do not reset VERIFYING to PENDING or blindly repeat an issue POST. A lost successful activation response similarly requires operator reconciliation and re-registration; secret recovery is not implied. Existing heartbeat token holders can rotate or unregister through authenticated endpoints. Token rotation, revoke and heartbeat writes all compare the current ACTIVE state and token hash atomically.

Required gates: synthetic route tests for private proof, expiry, split TXT, replay, concurrent verification, audit failure, secret redaction and both mounts; PostgreSQL tests applying both actual registry migrations, concurrent claim/rotation, revoke and legacy-pending invalidation. These are wired into the integration-state PostgreSQL CI job. A passing mock test alone does not establish database concurrency or external GitHub/DNS acceptance.

The route handles HTTP only, `serverRegistryService` owns use cases, `serverRegistryRepository` owns Prisma and conditional writes, and the GitHub audit adapter owns external publication. Registry credentials grant registry control only, never Studio accounts, manuscripts, review identities or publishing-system authority.


## Studio chooser refresh

Every time the user opens the server selector (on the login screen or account panel), Studio requests the full central `/api/v1/server-registry/servers` endpoint directly with `cache: no-store`. Closing the selector cancels the pending request; reopening clears the old results and fetches again. A successful empty live list is authoritative. The packaged official-server fallback is used only after a failed live read, is labeled unverified, and is never merged into a successful live response. The website keeps its separate daily endpoint and refresh schedule.
