# Federated Studio server directory

## Goal

Let an author discover participating Open Manuscript Studio servers and then work directly with the server they choose. The directory is a discovery service only. It must never proxy authentication, manuscripts, uploads, collaboration traffic, or API calls between Studio instances.

## Data and traffic boundaries

- The public registry stores only an operator-approved server name, canonical HTTPS origin, software version, supported capabilities, optional verification state, and last heartbeat.
- No manuscript content, account information, server IP address, credentials, or user counts are collected.
- The browser and native applications use the directory to get a list. After selection, every application request goes directly to the selected Studio origin.
- Registry reads and heartbeats are small metadata requests. A cacheable public JSON response and rate limits keep registry load low.
- A server can operate without publishing itself in the directory. Registration is an explicit operator opt-in.

## Registration and liveness

1. During installation, the operator may opt in and submit the server's display name and public HTTPS origin to the registry.
2. The registry creates a pending record and a one-time domain challenge. The operator publishes the challenge as a DNS TXT record under `_omi-studio-verification.<domain>`.
3. The registry verifies the TXT record before approving the origin. It must reject non-HTTPS URLs, credentials in URLs, paths, query strings, fragments, IP literals, and unverified domains. The registry does not make network requests to submitted server origins.
4. The registry issues a random per-instance heartbeat token once. Only a cryptographic hash is stored. The installation keeps the token in its server-side environment; it is never sent to the browser.
5. The Studio API sends a heartbeat to the registry on a fixed interval. A server is `online` only while its last heartbeat is within the configured freshness window. Missing heartbeats make it `offline`; the record can remain available for later recovery.
6. A server operator can rotate the heartbeat token or unregister the instance. To change public metadata, revoke the registration and register again.

GitHub is the auditable catalogue of approved public entries, not the heartbeat database. The registry service uses a narrowly scoped GitHub App to create a registration audit issue after an operator's domain is verified. A GitHub App installation token is minted on the registry host and is never shared with Studio instances. Heartbeats update the registry database and do not create commits or issues.

## Public API contract

- `GET /api/v1/server-registry/servers`: return domain-verified entries and current liveness, suitable for the OMI website and Studio server chooser. Cache for at most 60 seconds.
- `POST /api/v1/server-registry/registrations`: create a pending registration; rate limited.
- `POST /api/v1/server-registry/registrations/:id/verify`: verify the DNS challenge and create a GitHub audit issue.
- `POST /api/v1/server-registry/instances/:id/heartbeat`: authenticated by that instance's bearer token; update last-seen time and compatible version/capabilities.
- Authenticated operator controls: token rotation and unregister.

The public response must not expose heartbeat tokens, challenge values, database IDs that are not intended to be public, internal addresses, or detailed infrastructure health.

## Website and application integration

The OMI website renders the public directory and its online/offline state. Studio's chooser requests the same endpoint and makes one-click navigation possible. Browser selection opens the selected server's own Studio web origin so authentication cookies remain first-party. Native selection updates the API origin and clears the previous server's session token.

When the registry cannot be reached, the Studio chooser may show its cached list or the packaged official-server fallback. A registry outage must not prevent an author from using an already selected server.

## Deployment boundary

The reference implementation mounts the registry API in the OMI-operated Studio API and stores directory metadata in its PostgreSQL database. It handles discovery and small heartbeats only; it does not proxy document traffic. Resource limits and cache headers keep this workload bounded. If the directory outgrows this host, the registry API can move to a dedicated hostname such as `registry.openmanuscript.org` without changing the server-selection contract.

The registry's GitHub App needs only Issues: write on the catalogue repository to record verified registrations. Do not put its private key or installation token in a Studio server image, installer, browser bundle, or per-instance `.env`.

## Required operational controls

- DNS ownership verification before publication.
- HTTPS-only origins and rejecting IP literals; the registry never probes submitted server origins.
- Registration and verification rate limits.
- Secret hashing, one-time token display, token rotation, and revocation.
- A fixed heartbeat interval with jitter and bounded retries.
- A freshness threshold and removal/takedown path.
- Minimal, documented public metadata and operator consent.
- GitHub audit issue creation after DNS verification and a removal/takedown path.


## Registry authority hardening (2026-10-21)

The registry remains Preview and is discovery only. DNS control is not editorial authority, software certification or evidence of API compatibility. `online` means only that an authenticated heartbeat was received in the last 15 minutes; it does not mean a health probe succeeded. No automatic load balancing, account migration or manuscript forwarding occurs.

Registration returns two different values: publish only `verification.value` in DNS. Keep `registrationToken` private in the server environment as `OMI_SERVER_REGISTRATION_TOKEN`; the CLI sends it as a bearer credential during verification. It expires after 24 hours and is consumed on successful activation. Expired pending requests can be replaced by starting registration again. Never publish this proof or heartbeat credentials in DNS, GitHub, browser bundles or support logs. DNS TXT chunks within each record are concatenated before comparison.

Apply `20261022080000_registry_registration_authority` before deploying the new API, then deploy API before the updated clients/CLI/website. Existing ACTIVE entries and heartbeat credentials remain valid. Legacy PENDING entries are revoked and must register again; requests without private proof are deliberately rejected on both API surfaces. `/api/server-registry` remains a compatibility facade over exactly the same handlers and rate limit instances as `/api/v1/server-registry`.

A compare-and-swap claims PENDING → VERIFYING before the GitHub side effect. Only its owner can activate and receive the heartbeat token. Unknown audit/network outcomes remain VERIFYING and are not automatically retried: the registry operator must inspect the recorded registration ID and GitHub issues, reconcile the audit, revoke the quarantined row through controlled administration, and request fresh registration. Do not reset VERIFYING to PENDING or blindly repeat an issue POST. A lost successful activation response similarly requires operator reconciliation and re-registration; secret recovery is not implied. Existing heartbeat token holders can rotate or unregister through authenticated endpoints. Token rotation, revoke and heartbeat writes all compare the current ACTIVE state and token hash atomically.

Required gates: synthetic route tests for private proof, expiry, split TXT, replay, concurrent verification, audit failure, secret redaction and both mounts; PostgreSQL tests applying both actual registry migrations, concurrent claim/rotation, revoke and legacy-pending invalidation. These are wired into the integration-state PostgreSQL CI job. A passing mock test alone does not establish database concurrency or external GitHub/DNS acceptance.

The route handles HTTP only, `serverRegistryService` owns use cases, `serverRegistryRepository` owns Prisma and conditional writes, and the GitHub audit adapter owns external publication. Registry credentials grant registry control only, never Studio accounts, manuscripts, review identities or publishing-system authority.
