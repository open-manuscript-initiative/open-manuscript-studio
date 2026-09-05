# Database and Server

Open Manuscript Studio's server is a Node.js/TypeScript Express service backed by PostgreSQL through Prisma.

## Recommended production baseline

- Node.js 24
- PostgreSQL 16 or newer
- HTTPS
- a reverse proxy such as Nginx, Apache, Caddy, or Plesk-managed Nginx/Apache
- a dedicated, least-privilege PostgreSQL role for each database
- tested database and configuration backups

## Two database connections

Studio maintains separate Prisma migration trees:

| Connection | Prisma schema | Migration tree | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | `server/prisma/schema.prisma` | `server/prisma/migrations/` | Studio application, review, integrations, storage |
| `IDENTITY_DATABASE_URL` | `server/prisma/identity/schema.prisma` | `server/prisma/identity/migrations/` | identity, profiles, institutions, central administration |

Use separate PostgreSQL databases in production. OJS/OMP databases must remain separate from both.

Example development configuration:

```dotenv
NODE_ENV=development
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://omi_studio_app:change-me@127.0.0.1:5432/omi_studio
IDENTITY_DATABASE_URL=postgresql://omi_identity_app:change-me@127.0.0.1:5432/omi_identity
INTEGRATION_MASTER_KEY=<64 hexadecimal characters>
DEPLOYMENT_MODE=personal
```

Generate the integration encryption key once and store it outside Git:

```bash
openssl rand -hex 32
```

Losing this key makes stored integration credentials undecryptable. Do not reuse an OJS/OMP shared secret as the master key.

## Install and migrate

From `server/`:

```bash
npm ci
npm run prisma:generate:all
npm run prisma:migrate:deploy
npm run prisma:migrate:identity:deploy
npm run build
npm start
```

For local schema development, use the corresponding `*:dev` migration scripts. Production deployments must use `migrate deploy` and committed migrations.

## Reverse proxy

Route both API families to the server's default port (`3001` unless configured otherwise):

- `/api/`
- `/integrations/`

Preserve the original host, client forwarding chain, and HTTPS scheme. The frontend origin must exactly match `FRONTEND_ORIGIN`, because the API enforces a CORS allow-list and uses credentialed sessions.

The health endpoint is:

```text
GET /api/health
```

## Operational security

- Run the API as an unprivileged service account.
- Keep `.env`, database URLs, OAuth credentials, integration secrets, and signing keys outside Git.
- Restrict PostgreSQL to the hosts that need it.
- Terminate TLS at a maintained reverse proxy.
- Back up both databases, environment configuration, and user-managed files.
- Test restoration, not only backup creation.
- Rotate an integration secret immediately after exposure.
- Keep identity/institution administration separate from manuscript authorization.

## References

- [`server/.env.example`](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/server/.env.example)
- [Database schema notes](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/server/database-schema.md)
- [Security model](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/server/security-model.md)
- [Deployment modes](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/deployment-modes.md)
- [External integration setup](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/server/INTEGRATIONS.md)
