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

Run this from the `server` directory. The `--secret` value must be exactly the same shared secret configured in the OJS plugin:

```bash
npm run integration:add -- \
  --platform=ojs \
  --id=example-ojs-production \
  --name="Example Journal OJS" \
  --base-url=https://journal.example.org/ojs \
  --secret=<OJS_SHARED_SECRET>
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

A successfully verified launch currently returns the verified integration context. Workspace creation and authenticated Studio-session continuation are the next integration layer.

## Security notes

- Never place an OJS/OMP shared secret in `VITE_*` variables.
- Never store the shared secret in browser `localStorage`.
- Never commit `server/.env`.
- Use HTTPS for OJS, OMP and Studio in production.
- Rotate a shared secret if it has been exposed.
- Use a different shared secret for each external installation.
- Use a different `INTEGRATION_MASTER_KEY` from every OJS/OMP shared secret.
