# Studio server directory API

The directory is a discovery and availability service. A Studio client uses it only to find a participating server. It must then connect directly to that server for sign-in, documents, uploads, collaboration, and all other application traffic.

## Operator setup

Configure the registry host with a GitHub App installed on the catalogue repository. The App requires the repository permission **Issues: write**. Set:

- `OMI_SERVER_REGISTRY_GITHUB_APP_ID`
- `OMI_SERVER_REGISTRY_GITHUB_INSTALLATION_ID`
- `OMI_SERVER_REGISTRY_GITHUB_PRIVATE_KEY`
- `OMI_SERVER_REGISTRY_GITHUB_REPOSITORY`

The private key remains on the registry host. The App creates an audit issue after domain verification. It does not receive heartbeat data as commits.

Apply the database migration with the normal Studio server migration process. Keep the registry host's database backed up.

## Register an instance

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

Then restart the API container. The instance sends a jittered heartbeat approximately every five minutes. A valid heartbeat token is required for each heartbeat. The token is stored as a SHA-256 hash by the registry and is not included in public responses.

## Endpoints

- `POST /api/v1/server-registry/registrations` creates a pending registration. Requests are rate limited.
- `POST /api/v1/server-registry/registrations/:id/verify` verifies the DNS TXT challenge, records an audit issue, and activates the entry.
- `POST /api/v1/server-registry/instances/:id/heartbeat` updates liveness and compatible version/capabilities.
- `GET /api/v1/server-registry/servers` returns public server metadata and online/offline state. The response is cacheable for 60 seconds.

The online threshold is 15 minutes after the last heartbeat. Offline servers remain in the directory with an offline status so clients can avoid selecting them. The public endpoint never returns tokens, DNS challenges, internal IP addresses, or user data.

## Availability and scaling

The registry is not a reverse proxy or load balancer. Studio clients use the returned HTTPS origin and send all subsequent requests directly to that origin. Heartbeats are small server-to-server requests; directory reads are cacheable.

The reference implementation stores metadata in the registry host's PostgreSQL database. Keep it behind its own resource limits and TLS hostname. A future move to a standalone registry host does not change the public API contract.


## Registry authority hardening (2026-10-21)

The registry remains Preview and is discovery only. DNS control is not editorial authority, software certification or evidence of API compatibility. `online` means only that an authenticated heartbeat was received in the last 15 minutes; it does not mean a health probe succeeded. No automatic load balancing, account migration or manuscript forwarding occurs.

Registration returns two different values: publish only `verification.value` in DNS. Keep `registrationToken` private in the server environment as `OMI_SERVER_REGISTRATION_TOKEN`; the CLI sends it as a bearer credential during verification. It expires after 24 hours and is consumed on successful activation. Expired pending requests can be replaced by starting registration again. Never publish this proof or heartbeat credentials in DNS, GitHub, browser bundles or support logs. DNS TXT chunks within each record are concatenated before comparison.

Apply `20261022080000_registry_registration_authority` before deploying the new API, then deploy API before the updated clients/CLI/website. Existing ACTIVE entries and heartbeat credentials remain valid. Legacy PENDING entries are revoked and must register again; requests without private proof are deliberately rejected on both API surfaces. `/api/server-registry` remains a compatibility facade over exactly the same handlers and rate limit instances as `/api/v1/server-registry`.

A compare-and-swap claims PENDING → VERIFYING before the GitHub side effect. Only its owner can activate and receive the heartbeat token. Unknown audit/network outcomes remain VERIFYING and are not automatically retried: the registry operator must inspect the recorded registration ID and GitHub issues, reconcile the audit, revoke the quarantined row through controlled administration, and request fresh registration. Do not reset VERIFYING to PENDING or blindly repeat an issue POST. A lost successful activation response similarly requires operator reconciliation and re-registration; secret recovery is not implied. Existing heartbeat token holders can rotate or unregister through authenticated endpoints. Token rotation, revoke and heartbeat writes all compare the current ACTIVE state and token hash atomically.

Required gates: synthetic route tests for private proof, expiry, split TXT, replay, concurrent verification, audit failure, secret redaction and both mounts; PostgreSQL tests applying both actual registry migrations, concurrent claim/rotation, revoke and legacy-pending invalidation. These are wired into the integration-state PostgreSQL CI job. A passing mock test alone does not establish database concurrency or external GitHub/DNS acceptance.

The route handles HTTP only, `serverRegistryService` owns use cases, `serverRegistryRepository` owns Prisma and conditional writes, and the GitHub audit adapter owns external publication. Registry credentials grant registry control only, never Studio accounts, manuscripts, review identities or publishing-system authority.
