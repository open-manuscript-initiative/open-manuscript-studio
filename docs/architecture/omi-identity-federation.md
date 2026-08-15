# OMI Federated Identity Architecture

Status: draft architecture for the central `omi-identity` service.

## Goal

Open Manuscript Studio installations should share a portable scholarly account identity without centralizing manuscripts, editorial workflow, peer-review assignments, annotations, or journal permissions.

The central service owns authentication and a minimal portable profile. Each Studio installation owns authorization and editorial state.

## Core model

```text
External identity providers
ORCID / institutional OIDC / SAML
              |
              v
      OMI Identity Service
      --------------------
      global OMI user UUID
      linked identities
      verified e-mail(s)
      portable profile
      account security
              |
             OIDC
       +------+------+
       |             |
   Studio A       Studio B
   local DB       local DB
   roles          roles
   manuscripts    manuscripts
   reviews        reviews
```

The global identifier is an OMI-generated UUID. ORCID is a linked verified identity, not the primary key of the OMI account.

## Privacy boundary

The Identity Service MAY store:

- global OMI user UUID;
- linked external identity provider subjects (ORCID, OIDC, SAML);
- verified e-mail addresses;
- display name and optional portable profile fields;
- preferred interface language;
- account security and authentication audit information;
- registered Studio OIDC clients.

The Identity Service MUST NOT store:

- manuscript or submission identifiers;
- journal-specific roles;
- peer-review assignment identifiers;
- whether a person is a reviewer of a specific manuscript;
- review status, recommendation, review text, annotations, or editorial decisions;
- double-blind identity relationships.

This boundary is mandatory. A central identity outage or data breach must not reveal the scholarly review graph.

## Local Studio model

A Studio installation keeps a local user projection and all local authorization. The future local account shape is:

```text
LocalUser
  id                   local UUID
  omiUserId            global UUID, unique when present
  email                cached/profile projection
  fullName             cached/profile projection
  profileSnapshot      optional cache
  lastIdentitySyncAt   timestamp
  status               local account status
```

All manuscript roles, assignments, access grants, review records, and workspace permissions continue to reference the local `User.id`. This minimizes migration risk and permits controlled degraded operation when the central identity service is temporarily unavailable.

## Authentication flow

A migrated Studio installation is an OpenID Connect relying party of the OMI Identity Service.

```text
Studio -> OMI Identity -> ORCID/OIDC/SAML
Studio <- signed OIDC ID token <- OMI Identity
```

Required OIDC properties:

- Authorization Code flow;
- PKCE (S256);
- `state` and `nonce` validation;
- issuer and audience validation;
- signed ID tokens;
- standard discovery metadata;
- JWKS key rotation;
- HTTPS in production.

Minimal ID-token claims consumed by Studio:

```json
{
  "iss": "https://identity.openmanuscript.org",
  "sub": "<global OMI UUID>",
  "aud": "<studio client id>",
  "exp": 0,
  "iat": 0,
  "email": "optional",
  "email_verified": true,
  "name": "optional",
  "locale": "optional",
  "orcid": "optional"
}
```

No editorial claims are permitted.

## Account linking rules

A global OMI account may have several authentication identities. Examples:

```text
OMI user UUID
  ORCID
  institutional OIDC
  SAML institution identity
  local recovery identity (if enabled centrally)
```

An identical e-mail address is not sufficient for automatic account merging. Linking requires an authenticated existing account plus authentication with the new provider, or another explicit verified recovery procedure.

One provider `(issuer, subject)` tuple belongs to exactly one global OMI account.

## ORCID

The direct ORCID OAuth implementation introduced in Studio is transitional. After central identity rollout:

- ORCID OAuth credentials are configured once on `omi-identity`;
- individual Studio installations no longer need ORCID client credentials;
- Studio receives the stable OMI UUID in OIDC `sub`;
- the ORCID iD may be supplied as a verified profile claim;
- direct Studio -> ORCID authentication remains available only during migration and may later be retired.

## OJS assignment invitations

The central service must not learn why a person was invited.

Recommended flow:

1. OJS provides a candidate to the local Studio.
2. Studio creates the local assignment and an opaque local invitation reference.
3. The invitation redirects the person to the OMI Identity Service for authentication/registration.
4. OMI Identity returns only the global OMI UUID and permitted profile claims.
5. Studio binds the local pending user/assignment to that OMI UUID.
6. Assignment type, manuscript ID, journal, reviewer anonymity, and review state remain local.

The OIDC request must not contain manuscript identifiers or role names in `state`, `scope`, `login_hint`, or custom claims.

## Installation registry

The central Identity Service needs a client registry for Studio installations. A registration may contain:

- installation/client UUID;
- display name;
- allowed redirect URIs;
- public/client type and credential metadata;
- enabled/disabled status;
- created/updated timestamps.

It must not contain local editorial roles or manuscript relationships.

## Migration from current Studio identities

Current Studio contains local `UserIdentity` rows created by the direct ORCID implementation. Migration is staged:

### Phase 1: compatibility

Keep local login and direct ORCID login. Add optional OMI Identity configuration. No existing account is changed automatically.

### Phase 2: global account enrollment

For each local account, the user authenticates to OMI Identity. Studio receives `sub` and stores it as the local account's `omiUserId`. If the local account has a verified ORCID identity, OMI Identity can link it only after normal authentication/linking checks.

### Phase 3: OMI Identity becomes preferred

New sign-ins and assignment invitations use OMI Identity. Direct ORCID remains as a fallback while installations migrate.

### Phase 4: retire duplicate authentication

Once migration is complete, Studio may remove direct ORCID credentials and local external identity secrets. The local `UserIdentity` table can then become historical/migration data or be removed in a later schema version.

## Degraded operation

Identity is central; editorial authorization remains local.

If OMI Identity is unavailable:

- existing authenticated Studio sessions may continue until their normal local expiry;
- already authorized local manuscript work remains available;
- new central sign-ins and new global identity links are unavailable;
- Studio must not silently fall back to e-mail matching to establish identity.

## Configuration reserved in Studio

The Studio server accepts optional configuration keys for the future OIDC client:

```env
OMI_IDENTITY_ISSUER=https://identity.openmanuscript.org
OMI_IDENTITY_CLIENT_ID=...
OMI_IDENTITY_CLIENT_SECRET=...
OMI_IDENTITY_REDIRECT_URI=https://studio.example.org/api/auth/omi/callback
```

They are intentionally optional until the `omi-identity` service exists and the OIDC integration PR is completed.

## Repository boundary

The central service should live in a separate repository named `omi-identity`. The Studio repository should contain only:

- the OIDC relying-party integration;
- local `omiUserId` mapping and profile cache;
- invitation binding logic;
- migration tooling;
- protocol types that Studio consumes.

The central account store, identity-provider credentials, discovery/JWKS endpoints, global account linking, and identity client registry belong in `omi-identity`.
