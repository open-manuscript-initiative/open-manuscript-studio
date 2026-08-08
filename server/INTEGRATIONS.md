# External publishing-system integrations

Open Manuscript Studio stores OJS and OMP integration credentials server-side. Shared secrets are encrypted at rest with AES-256-GCM and are never exposed to the Studio frontend.

## 1. Configure the server master key

Generate a separate master key on the Studio server:

```bash
openssl rand -hex 32
```

Add the resulting 64-character hexadecimal value to `server/.env`:

```env
INTEGRATION_MASTER_KEY=<64-character-master-key>
```

This is **not** the OJS shared secret. It is a Studio-only key used to encrypt all external integration secrets stored in PostgreSQL. Keep it outside Git and back it up securely. Losing it makes stored integration secrets undecryptable.

## 2. Apply the database migration

From the `server` directory:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
```

The migration creates `external_installations` and `external_launch_nonces`.

## 3. Configure the OJS plugin

In the OJS Studio Integration plugin settings, configure:

- **Studio URL:** the public Studio URL, for example `https://studio.example.org`
- **Stable installation ID:** a stable identifier, for example `example-ojs-production`
- **Shared secret:** a random 64-character hexadecimal value
- **Launch token lifetime:** `300` seconds is recommended

Generate the OJS shared secret with:

```bash
openssl rand -hex 32
```

## 4. Register the same OJS secret in Studio

Run the registration from the `server` directory. The secret must be exactly the same value configured in the OJS plugin.

To avoid putting the secret in shell history, read it without echo and pass it through a temporary environment variable:

```bash
read -s -p "OJS shared secret: " OJS_SECRET
echo
OMI_INTEGRATION_SHARED_SECRET="$OJS_SECRET" npm run integration:add -- \
  --platform=ojs \
  --id=example-ojs-production \
  --name="Example Journal OJS" \
  --base-url=https://journal.example.org/ojs
unset OJS_SECRET
```

The command encrypts the shared secret before saving it to PostgreSQL. The plaintext secret is not returned by the API.

The `--id` value must exactly match **Stable installation ID** in the OJS plugin.

## 5. Reverse-proxy the launch endpoint

The OJS plugin launches Studio at:

```text
/integrations/ojs/launch
```

Your web server must route that path to the Studio backend. The frontend itself does not process or know the shared secret.

The backend verifies:

1. OMI protocol/profile identifiers;
2. installation identity;
3. HMAC-SHA256 signature;
4. issue and expiration times;
5. launch lifetime;
6. one-time nonce/replay protection;
7. that the registered external platform is OJS.

## 6. Launch handoff and metadata import

After verification, the Studio backend uses the same short-lived OMI assertion to request the permitted OJS integration resources server-side:

- submission metadata (`metadata.read`);
- contributors (`contributors.read`);
- submission file manifest (`files.read`).

The backend then writes only the verified launch data to same-origin `sessionStorage` through a short-lived CSP-protected handoff page and redirects to the Studio frontend. No shared secret is exposed to the browser.

After the Studio user is authenticated, the frontend consumes the handoff exactly once and loads a new Studio manuscript using the OJS title, subtitle, abstract, keywords, contributor identities, ORCID values where available, and source file names.

The source OJS submission ID and installation context remain visible in the imported source description.

### Current binary-transfer boundary

The OJS connector currently advertises `files.read`, which exposes the authorized file manifest, but it does not yet advertise or implement protected binary file transfer. Therefore DOCX, JATS, PDF or other source file bytes are not imported in this stage.

The next connector capability is protected file download followed by format-specific Studio import (for example DOCX or JATS). Until that capability is implemented, Studio MUST NOT imply that the manuscript body has been imported when only OJS metadata and a file manifest are available.

## 7. Deploying launch-handoff changes

No new database migration or npm dependency is required for the metadata handoff itself. Rebuild both application layers after pulling the updated repository:

```bash
# Frontend, from repository root
npm install
npm run build

# Backend
cd server
npm install
npm run build
```

Then restart the Studio API service and deploy the frontend `dist/` output using the normal deployment process.

## Security notes

- Never place an OJS/OMP shared secret in `VITE_*` variables.
- Never store the shared secret in browser `localStorage`.
- Never commit `server/.env`.
- Use HTTPS for OJS, OMP and Studio in production.
- Rotate a shared secret if it has been exposed.
- Use a different shared secret for each external installation.
- Use a different `INTEGRATION_MASTER_KEY` from every OJS/OMP shared secret.
- Launch handoff data is stored only in `sessionStorage` and is consumed once by the authenticated Studio application.
