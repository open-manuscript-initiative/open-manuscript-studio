# Federated Studio server directory

## Goal

Let an author discover participating Open Manuscript Studio servers and then work directly with the server they choose. The directory is a discovery service only. It must never proxy authentication, manuscripts, uploads, collaboration traffic, or API calls between Studio instances.

## Data and traffic boundaries

- The public registry stores only an operator-approved server name, canonical HTTPS origin, software version, supported capabilities, optional public contact page, verification state, and last heartbeat.
- No manuscript content, account information, server IP address, credentials, or user counts are collected.
- The browser and native applications use the directory to get a list. After selection, every application request goes directly to the selected Studio origin.
- Registry reads and heartbeats are small metadata requests. A cacheable public JSON response and rate limits keep registry load low.
- A server can operate without publishing itself in the directory. Registration is an explicit operator opt-in.

## Registration and liveness

1. During installation, the operator may opt in and submit the server's display name and public HTTPS origin to the registry.
2. The registry creates a pending record and a one-time domain challenge. The operator publishes the challenge as a DNS TXT record under `_omi-studio-verification.<domain>`.
3. The registry verifies the TXT record before approving the origin. It must reject non-HTTPS URLs, credentials in URLs, paths, query strings, fragments, private IP ranges, and unverified domains.
4. The registry issues a random per-instance heartbeat token once. Only a cryptographic hash is stored. The installation keeps the token in its server-side environment; it is never sent to the browser.
5. The Studio API sends a heartbeat to the registry on a fixed interval. A server is `online` only while its last heartbeat is within the configured freshness window. Missing heartbeats make it `offline`; the record can remain available for later recovery.
6. A server operator can rotate the heartbeat token, update public metadata, or unregister the instance.

GitHub is the auditable catalogue of approved public entries, not the heartbeat database. The registry service uses a narrowly scoped GitHub App to submit a pull request when an operator's registration is verified or its public metadata changes. GitHub credentials exist only on the registry service. Heartbeats update the registry database and do not create commits or pull requests.

## Public API contract

- `GET /v1/servers`: return approved entries and current liveness, suitable for the OMI website and Studio server chooser. Cache for at most 60 seconds.
- `POST /v1/registrations`: create a pending registration; rate limited.
- `POST /v1/registrations/:id/verify`: verify the DNS challenge and submit the metadata change to GitHub for review.
- `POST /v1/instances/:id/heartbeat`: authenticated by that instance's bearer token; update last-seen time and compatible version/capabilities.
- Authenticated operator controls: metadata update, token rotation, and unregister.

The public response must not expose heartbeat tokens, challenge values, database IDs that are not intended to be public, internal addresses, or detailed infrastructure health.

## Website and application integration

The OMI website renders the public directory and its online/offline state. Studio's chooser requests the same endpoint and makes one-click navigation possible. Browser selection opens the selected server's own Studio web origin so authentication cookies remain first-party. Native selection updates the API origin and clears the previous server's session token.

When the registry cannot be reached, the Studio chooser may show its cached list or the packaged official-server fallback. A registry outage must not prevent an author from using an already selected server.

## Deployment boundary

Run the registry as a small, separately deployable metadata service with its own database and hostname, for example `registry.openmanuscript.org`. It is not part of a Studio instance's document request path. It may be hosted on the same physical VPS initially, provided the public Studio instances still connect directly to one another and resource limits isolate the registry. It can later move to another host without changing the server-selection contract.

The registry's GitHub App needs only the permissions required to read the public catalogue and create/update a registration pull request. Do not put its private key or installation token in a Studio server image, installer, browser bundle, or per-instance `.env`.

## Required operational controls

- DNS ownership verification before publication.
- HTTPS-only origins and safe DNS/IP validation to prevent SSRF.
- Registration and verification rate limits.
- Secret hashing, one-time token display, token rotation, and revocation.
- A fixed heartbeat interval with jitter and bounded retries.
- A freshness threshold and removal/takedown path.
- Minimal, documented public metadata and operator consent.
- GitHub pull-request review before a new server appears in the curated public catalogue.
