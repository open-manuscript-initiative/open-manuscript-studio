# `omi-identity` Service Bootstrap Specification

This document is the implementation blueprint for the future `open-manuscript-initiative/omi-identity` repository.

## Service responsibilities

The service is the global OMI authentication and account-linking authority. It is not an editorial workflow service.

It must provide:

- global OMI account UUIDs;
- external identity linking (initially ORCID, later institutional OIDC/SAML);
- verified e-mail management;
- OpenID Connect provider functionality for Studio installations;
- client registration and redirect-URI enforcement;
- consent/account-linking UI;
- account security and recovery;
- minimal portable profile claims.

It must not receive or persist manuscript, journal-role, assignment, or peer-review data.

## Suggested repository layout

```text
omi-identity/
  README.md
  LICENSE
  package.json
  tsconfig.json
  prisma/
    schema.prisma
    migrations/
  src/
    app.ts
    server.ts
    config/
    oidc/
      discovery.ts
      authorize.ts
      token.ts
      jwks.ts
      claims.ts
    providers/
      orcid.ts
      oidc.ts
      saml.ts
    accounts/
      accountService.ts
      identityLinkService.ts
    clients/
      clientRegistry.ts
    security/
      sessions.ts
      state.ts
      pkce.ts
      audit.ts
  tests/
  docs/
```

Node.js + TypeScript + PostgreSQL + Prisma is recommended to keep the operational stack aligned with Studio.

## Initial database model

```text
GlobalUser
  id UUID primary key
  status
  displayName
  preferredLanguage
  createdAt
  updatedAt
  lastLoginAt

GlobalIdentity
  id UUID primary key
  userId -> GlobalUser
  provider ORCID | OIDC | SAML
  issuer
  subject
  displayName
  profile JSONB
  createdAt
  updatedAt
  lastUsedAt
  UNIQUE(provider, issuer, subject)

VerifiedEmail
  id UUID primary key
  userId -> GlobalUser
  email normalized unique as appropriate
  verifiedAt
  primary

OidcClient
  id UUID primary key
  clientId unique
  displayName
  clientSecretHash nullable
  clientType confidential | public
  redirectUris JSONB
  status ACTIVE | DISABLED
  createdAt
  updatedAt

AuthorizationCode
  id UUID primary key
  codeHash unique
  userId
  clientId
  redirectUri
  scope
  nonce
  codeChallenge
  codeChallengeMethod
  expiresAt
  usedAt

IdentitySession
  id UUID primary key
  userId
  tokenHash unique
  expiresAt
  createdAt

ProviderOAuthState
  id UUID primary key
  stateHash unique
  provider
  returnContext opaque/local-only reference
  expiresAt
```

Raw OAuth authorization codes, session tokens, client secrets, and provider state tokens must not be stored in plaintext.

## OIDC endpoints

Minimum provider surface:

```text
GET  /.well-known/openid-configuration
GET  /oauth/authorize
POST /oauth/token
GET  /.well-known/jwks.json
GET  /userinfo            optional in first release
```

The discovery document must advertise Authorization Code flow and `S256` PKCE.

Initial scopes:

```text
openid
profile
email
orcid
```

No scope may expose editorial workflow information.

## ID token contract

Required claims:

```text
iss
sub = immutable global OMI UUID
aud
exp
iat
nonce when supplied
```

Optional claims:

```text
name
preferred_username
locale
email
email_verified
orcid
```

Never emit journal roles, manuscript IDs, submission IDs, assignment types, reviewer state, or review metadata.

## Signing keys

Use asymmetric signing keys with rotation. The service publishes public keys through JWKS. Private signing keys remain server-side and must not be committed to Git.

The first release should use a modern JOSE library and a supported asymmetric algorithm such as RS256 or ES256. Key rotation must permit an overlap window where old public keys remain available until issued tokens have expired.

## ORCID provider

ORCID is an upstream identity provider, not the global OMI primary key.

Initial upstream flow:

```text
Studio
  -> OMI Identity authorize
  -> ORCID OAuth /authenticate
  <- authenticated ORCID iD
  -> link/find GlobalIdentity
  <- global OMI account
  -> Studio OIDC callback
```

The ORCID client ID and secret are configured only in the central service after migration.

## Account creation and linking

Rules:

1. A provider `(issuer, subject)` maps to at most one global OMI user.
2. E-mail equality alone never merges accounts.
3. Linking a new identity requires an authenticated OMI session plus successful authentication at the new provider, except for a separately designed verified recovery flow.
4. A new ORCID-authenticated visitor may create a new global account.
5. Account merge must be explicit and auditable; it is not required for the first release.

## Studio client registration

Initially clients may be provisioned administratively.

Required registration fields:

```text
clientId
clientSecret for confidential server-side Studio deployments
allowed redirect URIs
display name
status
```

Redirect URI matching must be exact.

Dynamic client registration is explicitly out of scope for the first release.

## Invitation privacy

A Studio assignment invitation may cause authentication at OMI Identity, but the central service must receive only generic login/register context. Do not send:

```text
manuscript id
journal id
submission id
assignment type
reviewer role
review round
anonymity mode
```

The local Studio maintains an opaque invitation token/reference and performs assignment binding after successful OIDC callback.

## Audit and observability

Central audit logs may record authentication/security events such as:

- login success/failure;
- provider link/unlink;
- client authorization;
- session creation/revocation;
- security/recovery changes.

They must not log OAuth tokens, authorization codes, client secrets, or editorial workflow context.

## Initial delivery milestones

### M1 — account core

Prisma schema, global user, verified e-mail, sessions, ORCID identity linking.

### M2 — OIDC provider

Discovery, JWKS, authorization code + PKCE, token endpoint, Studio client registry.

### M3 — Studio integration

Studio uses OMI Identity as an OIDC client and stores `omiUserId` locally while retaining the current local authorization model.

### M4 — invitation integration

Pending OJS/OMP assignees can authenticate/register through OMI Identity and become bound to the local pending assignment without revealing assignment context centrally.

### M5 — migration

Enroll existing direct-ORCID Studio users into global OMI accounts, then deprecate per-installation ORCID OAuth configuration.
