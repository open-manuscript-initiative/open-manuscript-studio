# Portable self-hosted deployment

This directory contains a provider-neutral Docker Compose deployment for the OMI Studio web application and API. It runs on Linux hosts with Docker Engine and the Compose plugin and pulls prebuilt multi-platform images from GitHub Container Registry (GHCR). It does not change the existing VPS deployment workflow.

## Administrator guides

- [English administrator guide](ADMIN_GUIDE.md)
- [Magyar rendszergazdai súgó](ADMIN_GUIDE.hu.md)

## Supported deployment shape

- Linux server: run this Compose stack directly.
- Windows Server 2022 or 2025: run the same stack inside an Ubuntu Server virtual machine managed by Hyper-V. Give the VM a stable address, set STUDIO_BIND_ADDRESS=0.0.0.0 in deployment/.env inside the VM, and forward HTTPS from the Windows host or an upstream reverse proxy to the VM's HTTP port. Restrict that HTTP port to the reverse proxy with the VM firewall. Docker Desktop is not supported on Windows Server, and Docker's Windows Server engine runs Windows containers rather than this Linux-based application.
- Windows 10/11 development host: Docker Desktop with Linux containers can run the stack for evaluation.

The web container serves the frontend and proxies API, OJS/OMP integration and collaboration WebSocket traffic to the API. PostgreSQL holds two separate databases: omi_studio and omi_identity. The API runs both Prisma migrations on startup. The database volume persists across upgrades and container rebuilds.

## First installation

1. Clone the open-manuscript-studio repository or unpack a deployment bundle on the server. The deployment files pull the prebuilt API and web images from GHCR; a source checkout and local build toolchain are not required. Run the installer from the deployment directory.
2. Set PUBLIC_ORIGIN in .env.example to the HTTPS URL that will be used for this installation, then run the installer from this directory with ./install.sh. It creates deployment/.env with random database and integration-encryption secrets and starts the containers.
3. Configure your reverse proxy and TLS certificate. Point it to 127.0.0.1:8080 on Linux, or the VM address and configured port on Windows Server after allowing that port only from the reverse proxy. Set the forwarded scheme to https. Keep the Studio port private behind the reverse proxy.
4. Configure the mail relay in deployment/msmtprc. Set permissions to 0600 and owner UID 1000. Password-reset and invitation mail depends on this relay.
5. Rebuild the web container after changing PUBLIC_ORIGIN or frontend build settings.

For a direct local evaluation, set PUBLIC_ORIGIN to the exact URL that will be opened (for example, http://localhost:8080), set STUDIO_BIND_ADDRESS=0.0.0.0, and visit that URL. This exposes unencrypted HTTP and is not suitable for public production use.

The SMTP configuration is mounted read-only into the API container. Keep credentials out of Git and use a dedicated relay account. The integration master key and database password are generated once; keep them in a secure backup. Losing the integration key makes stored third-party credentials unreadable.

## Upgrade

From the deployment directory, choose the desired image tag in `.env` (`STUDIO_IMAGE_TAG=latest` or a published version tag), then pull and start the images:

    docker compose -f compose.yml pull
    docker compose -f compose.yml up -d

The API applies pending migrations before accepting traffic. Back up PostgreSQL before upgrades. Do not run two API containers during schema migrations.

## Backup and restore

Create a logical backup of both databases:

    docker compose -f compose.yml exec -T postgres pg_dump -U omi_studio -d omi_studio --format=custom > omi_studio.dump
    docker compose -f compose.yml exec -T postgres pg_dump -U omi_studio -d omi_identity --format=custom > omi_identity.dump

Restore into a stopped deployment after recreating the databases:

    docker compose -f compose.yml stop api web
    cat omi_studio.dump | docker compose -f compose.yml exec -T postgres pg_restore -U omi_studio -d omi_studio --clean --if-exists
    cat omi_identity.dump | docker compose -f compose.yml exec -T postgres pg_restore -U omi_studio -d omi_identity --clean --if-exists
    docker compose -f compose.yml up -d

Store backups and the .env file separately from the host. Test restores before relying on them.

## Optional identity and service integrations

The API accepts the optional identity, ORCID, cloud-storage and catalogue-provider settings documented in server/.env.example. Add only credentials that the deployment administrator has registered for the installation's own public origin. They belong in deployment/.env and must not be committed.

Native desktop and mobile clients can select a custom Studio server from the sign-in screen or Account settings. Enter the server origin only (for example, https://studio.example.org), and use HTTPS. Switching servers signs the client out of the previous server and clears its local native session token; data stored on either server is unchanged. The client continues to offer the official Studio server as its default.
