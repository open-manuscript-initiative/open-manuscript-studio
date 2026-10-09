# Administrator guide – self-hosted deployment

This guide is for administrators operating the Open Manuscript Studio web edition. The installer starts the web application, API, and PostgreSQL databases with Docker Compose. The existing VPS release workflow remains separate.

## Supported environments

| Environment | Deployment method |
| --- | --- |
| Linux server | Docker Engine and the Docker Compose plugin, directly on the server |
| Windows Server 2022/2025 | Ubuntu Server virtual machine under Hyper-V; run the Compose stack inside the VM |
| Windows 10/11 for evaluation | Docker Desktop with Linux containers |

The application is made of Linux containers. Do not use the Windows-container Docker Engine on Windows Server for this package. Assign a stable IP address or DHCP reservation to the Hyper-V guest. Docker Desktop on Windows 10/11 is suitable for development and evaluation.

## Prerequisites and networking

- A Linux server or Ubuntu Server virtual machine.
- Docker Engine and the `docker compose` plugin. `install.sh` checks that they are available.
- For a public deployment, a DNS name and a TLS-terminating reverse proxy (for example, an existing Nginx, Caddy, or Traefik setup).
- Set `PUBLIC_ORIGIN` to the exact address users will open: scheme, hostname, and port if applicable, without a trailing slash.
- The database, API, and web containers communicate over the internal Compose network. Expose only the reverse proxy's HTTPS port publicly.

By default, the Studio HTTP port listens on `127.0.0.1:8080`. On Linux, point the reverse proxy at that address. Do not expose ports `3001`, `3022`, or `5432` to the public network.

## Install on Linux

1. Download or clone the complete Studio source repository. The Docker images are built from the source; the `deployment/` directory alone is not sufficient.
2. Enter the deployment directory:

   ```sh
   cd open-manuscript-studio/deployment
   ```

3. Copy the sample environment and set your public address. For example:

   ```sh
   cp .env.example .env
   ```

   In `.env`, set `PUBLIC_ORIGIN` to a value such as `https://studio.example.org`. When using a reverse proxy, leave `STUDIO_BIND_ADDRESS=127.0.0.1`. The installer generates random database and integration-encryption secrets if the sample values are still present.

4. Run the installer:

   ```sh
   ./install.sh
   ```

   The script creates `deployment/.env`, applies file permissions, creates a sample SMTP configuration, and builds and starts the containers. On the first run, edit `msmtprc` with working mail relay settings; invitation and password-reset messages will not work without SMTP.

5. Configure the reverse proxy to use `http://127.0.0.1:8080` as the Studio upstream. The proxy should forward the `Host` header, set `X-Forwarded-Proto: https`, and allow WebSocket upgrades. TLS is handled by the proxy; this Compose package does not issue certificates.
6. Open the HTTPS address configured in `PUBLIC_ORIGIN` and complete the checks below.

### Configure SMTP

Edit `deployment/msmtprc` with your mail provider's SMTP settings. The file contains a password, so do not commit it to Git or include it in a public backup. The unprivileged `node` user (UID 1000) inside the container reads it:

```sh
chmod 600 msmtprc
sudo chown 1000:1000 msmtprc
docker compose -f compose.yml restart api
```

Treat invitations and password resets as unavailable until a test message is delivered successfully.

## Install on Windows Server with Hyper-V

1. Create an Ubuntu Server virtual machine in Hyper-V and assign it a stable IP address or DHCP reservation.
2. Install Docker Engine and the Compose plugin inside the Linux guest. Follow the Linux installation steps above on the VM.
3. In the VM's `deployment/.env`, set:

   ```dotenv
   STUDIO_BIND_ADDRESS=0.0.0.0
   STUDIO_HTTP_PORT=8080
   PUBLIC_ORIGIN=https://studio.example.org
   ```

4. Allow `8080/tcp` through the VM firewall, restricting the source to the Windows host or the upstream reverse proxy address. Do not allow access from the entire internet.
5. Configure the reverse proxy on the Windows host or a separate proxy machine to forward to port `8080` on the VM. If the proxy runs on Windows, use the Linux VM's network address as its upstream.
6. Confirm that the domain's DNS record points to the public address of the TLS proxy. Open the public HTTPS address in the browser, not the VM's HTTP port.

Docker Desktop is not a supported deployment method on Windows Server for this package.

## Checks after first startup

Run these commands from the deployment directory:

```sh
docker compose -f compose.yml ps
docker compose -f compose.yml logs --tail=100 api
docker compose -f compose.yml logs --tail=100 web
docker compose -f compose.yml exec postgres pg_isready -U omi_studio -d omi_studio
```

Verify in a browser and with your own workflow:

- The web interface loads at the public HTTPS address.
- The API responds; its health endpoint is `/api/health`.
- Invitation or password-reset messages arrive after SMTP is configured.
- Collaboration WebSocket connections work if real-time collaboration is enabled.
- External services work if optional OJS/OMP, identity, ORCID, cloud storage, or catalogue integrations are configured.

Optional service environment variables are documented in `server/.env.example`. Put credentials in this installation's `deployment/.env`; do not commit them.

## Backup and restore

Before upgrades and on a regular schedule, back up both databases:

```sh
docker compose -f compose.yml exec -T postgres pg_dump -U omi_studio -d omi_studio --format=custom > omi_studio.dump
docker compose -f compose.yml exec -T postgres pg_dump -U omi_studio -d omi_identity --format=custom > omi_identity.dump
```

Store `.env` and the dumps in a protected location separate from the server. Without `INTEGRATION_MASTER_KEY`, previously stored third-party service credentials cannot be decrypted. The `msmtprc` file may also contain secrets.

Before restoring, stop the API and web services, then restore only into suitably prepared databases. The [deployment README](README.md#backup-and-restore) contains the restore commands and a complete example. As part of maintenance, test a restore in a separate test environment.

## Upgrade

1. Back up the databases and configuration.
2. Check out the source for the desired, verified Studio release; preserve the existing `.env`, `msmtprc`, and PostgreSQL data.
3. From the `deployment/` directory, rebuild and start the services:

   ```sh
   docker compose -f compose.yml up --build -d
   docker compose -f compose.yml ps
   ```

The API runs database migrations during startup. Run only one API instance at a time. If checks fail after an upgrade, inspect the API logs and restore the database from backup in step with the application version rollback.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The website cannot be reached | Run `docker compose ps`; check the port, DNS, proxy upstream, and firewall |
| The proxy returns 502 | Run `docker compose logs --tail=100 api web`; the API may still be migrating or may not be healthy |
| Login or CORS errors | Make sure `PUBLIC_ORIGIN` exactly matches the browser's HTTPS address; rebuild the web container after changing it |
| Email is not delivered | Check the `msmtprc` host, port, TLS, username, and sender, then check file permissions and API logs |
| Collaboration WebSocket does not connect | Allow WebSocket upgrades in the reverse proxy; make sure the domain and `PUBLIC_ORIGIN` match |
| The VM cannot be reached from Windows Server | Check the VM's stable IP, `STUDIO_BIND_ADDRESS=0.0.0.0`, and the VM firewall rule restricted to the proxy |

Useful logs:

```sh
docker compose -f compose.yml logs --tail=200 api
docker compose -f compose.yml logs --tail=200 web
docker compose -f compose.yml logs --tail=100 postgres
```

## Deployment scope

This package provides the web application and API on your own server. Native desktop and mobile applications still use their configured Studio API endpoint; selecting a server from those clients requires a separate change.
