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

- `POST /api/server-registry/registrations` creates a pending registration. Requests are rate limited.
- `POST /api/server-registry/registrations/:id/verify` verifies the DNS TXT challenge, records an audit issue, and activates the entry.
- `POST /api/server-registry/instances/:id/heartbeat` updates liveness and compatible version/capabilities.
- `GET /api/server-registry/servers` returns public server metadata and online/offline state. The response is cacheable for 60 seconds.

The online threshold is 15 minutes after the last heartbeat. Offline servers remain in the directory with an offline status so clients can avoid selecting them. The public endpoint never returns tokens, DNS challenges, internal IP addresses, or user data.

## Availability and scaling

The registry is not a reverse proxy or load balancer. Studio clients use the returned HTTPS origin and send all subsequent requests directly to that origin. Heartbeats are small server-to-server requests; directory reads are cacheable.

The reference implementation stores metadata in the registry host's PostgreSQL database. Keep it behind its own resource limits and TLS hostname. A future move to a standalone registry host does not change the public API contract.
