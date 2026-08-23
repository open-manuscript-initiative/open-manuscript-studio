# Central institution administration and Institution Admin API

Open Manuscript Studio separates three authorization planes:

1. **Personal account** — the durable author/reviewer/editor identity.
2. **Institution administration** — `MEMBER`, `ADMIN`, and `OWNER` membership inside one institution.
3. **OMI central administration** — cross-institution operational administration. This is stored in `CentralAdminGrant` and is never inferred from an institution role.

Central administration does **not** grant manuscript, review, or editorial-content access. Content authorization continues to use the existing manuscript/workspace capability model.

## Central administrators

Central administrators use ordinary Studio accounts. The central role is an explicit server-side grant:

- `ADMIN` — institution lifecycle, institution administrators, API credentials, audit visibility.
- `OWNER` — all ADMIN capabilities plus central-operator management.

The last central OWNER cannot be removed or demoted.

Initial bootstrap is configured with:

```dotenv
CENTRAL_ADMIN_EMAILS=admin@example.org,second-admin@example.org
```

An e-mail match is not sufficient. Automatic bootstrap occurs only after the Studio account has a linked OIDC or SAML identity. This prevents a password-only account from becoming a central administrator from an e-mail allow-list alone.

## Central administration API

Human central administrators authenticate with their normal Studio session.

### Context

```http
GET /api/central-admin/context
```

### Institutions

```http
GET   /api/central-admin/institutions
POST  /api/central-admin/institutions
PATCH /api/central-admin/institutions/{institutionId}
```

Disabling an institution immediately makes its Institution Admin API credentials unusable because token validation also checks institution status.

### Institution administrators

```http
GET    /api/central-admin/institutions/{institutionId}/admins
POST   /api/central-admin/institutions/{institutionId}/admins
PATCH  /api/central-admin/institutions/{institutionId}/admins/{membershipId}
DELETE /api/central-admin/institutions/{institutionId}/admins/{membershipId}
```

Removing admin access demotes the membership to `MEMBER`; it does not delete the user's institutional profile. The last institution OWNER is protected.

### Central operators

Central OWNER only:

```http
GET    /api/central-admin/operators
POST   /api/central-admin/operators
PATCH  /api/central-admin/operators/{grantId}
DELETE /api/central-admin/operators/{grantId}
```

New central operators must already have an OIDC or SAML identity linked to their Studio account.

## Institution Admin API credentials

Central administrators can issue machine credentials for one institution:

```http
GET    /api/central-admin/institutions/{institutionId}/api-credentials
POST   /api/central-admin/institutions/{institutionId}/api-credentials
DELETE /api/central-admin/institutions/{institutionId}/api-credentials/{credentialId}
```

A raw token is returned only once at creation. Only a SHA-256 hash is stored in the Identity database. The visible prefix can be used to identify a credential without exposing the secret.

Default token lifetime:

```dotenv
INSTITUTION_API_TOKEN_TTL_DAYS=365
```

Tokens can be revoked at any time and automatically fail after expiry or when the institution is disabled.

### Scopes

Initial scopes:

- `institution:read`
- `members:read`
- `members:write`
- `integrations:read`
- `integrations:write`

The first three are implemented by the v1 institution API. Integration scopes are reserved for the institution-scoped integration administration endpoints and grant no access until those endpoints are implemented.

## Institution Admin API v1

Machine clients authenticate with:

```http
Authorization: Bearer omi_ia_...
```

Endpoints:

```http
GET   /api/institution-admin/v1/context
GET   /api/institution-admin/v1/members
PATCH /api/institution-admin/v1/members/{membershipId}/role
```

The machine API can change `MEMBER` and `ADMIN` roles when `members:write` is present. It cannot create, remove, promote, or demote an `OWNER`; ownership changes require a human institution OWNER or central administrator.

## Audit log

Central and machine administrator mutations create append-only audit events containing the actor user or API credential, institution, action, target, timestamp and client IP when available.

```http
GET /api/central-admin/audit
GET /api/central-admin/audit?institutionId={institutionId}&limit=100
```

API secrets, passwords and OAuth tokens must never be copied into audit details.

## UI

A Studio account with a central grant receives a third Account tab: **Central administration**. It provides:

- institution list and status management
- institution administrator assignment/removal
- institution Admin API credential creation/revocation
- one-time token display
- recent institution audit events

The tab is absent for ordinary users and ordinary institution administrators.

## Deployment

The feature extends the Identity database. After deploying the code, apply Identity migrations before restarting the API:

```bash
cd server
npm run prisma:migrate:identity:deploy
```

Then restart the Studio API service.
