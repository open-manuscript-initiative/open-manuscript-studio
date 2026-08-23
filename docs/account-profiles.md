# Personal profiles, institutional profiles, and institution administration

Open Manuscript Studio separates the durable personal scholarly profile from organization-specific institutional memberships and from institution administrator permissions.

## Personal profile

The personal profile belongs to the individual Studio account and follows the user across devices. It contains personal scholarly identity and preferences, including:

- full name
- ORCID iD
- biography
- interface language
- time zone

Authentication identities are managed separately under **Connected identities**. Institutional affiliation is no longer edited as a personal-profile field. The legacy `affiliation` and `affiliation_ror_id` columns remain only as a compatibility shadow while older integrations are migrated.

## Institution and institutional profile

The Identity database stores the institution itself separately from the user's relationship to it:

- `Institution` is the shared organization record (name, optional ROR identifier, status).
- `InstitutionMembership` is the user's institutional profile for that organization.

A Studio account can therefore belong to zero, one, or many institutions without duplicating the organization as personal account data.

An institutional membership can contain:

- department or organizational unit
- position / role title
- institutional e-mail address
- an optional linked OIDC/SAML identity
- a default-profile flag
- a server-controlled institution role

Only one membership is treated as the user's default institution at a time. That institution is mirrored to the legacy affiliation fields for compatibility with existing manuscript and integration code.

Institution name and ROR are shared organization data. A normal member can add or remove their membership/profile, but cannot rename the shared organization through the personal account screen.

## Institution roles

Institution permissions are server-authoritative:

- `MEMBER` — normal institutional affiliation; no organization administration.
- `ADMIN` — can use the institutional administration context and manage ordinary member roles/settings allowed by the admin API.
- `OWNER` — highest organization role; can also grant or remove owner-level permissions.

Creating an institutional profile always creates a `MEMBER` relationship. A user cannot self-promote to `ADMIN` or `OWNER` from the profile screen.

At least one owner must remain. An admin cannot modify an owner's role; only an owner can do so.

## Institutional administrator sign-in

Institutional deployments expose a separate **Institution administrator** sign-in mode. It uses the same durable Studio account rather than creating a separate administrator account.

For password sign-in, `POST /api/auth/institution-admin/login` creates a session only when the authenticated user has an active `ADMIN` or `OWNER` membership. A normal member receives `403 INSTITUTION_ADMIN_REQUIRED`.

For Google, Microsoft, or institutional OIDC sign-in, the client marks the login as an administrator attempt. After the federated callback creates/restores the normal Studio session, the client immediately calls the server-side administrator-context endpoint. If no active admin membership exists, the session is logged out and the admin attempt is rejected. All institution-administration APIs independently enforce the membership role, so this client-side post-login routing check is not an authorization boundary.

ORCID remains a personal scholarly identifier and is intentionally omitted from the administrator-mode provider list.

## Initial owner bootstrap

A managed institutional deployment can bootstrap its initial owner with server-controlled configuration:

```env
DEPLOYMENT_MODE=institutional
INSTITUTIONAL_NAME=Example University
INSTITUTIONAL_ROR_ID=https://ror.org/012345678
INSTITUTIONAL_ADMIN_EMAILS=admin@example.edu,second-admin@example.edu
```

The e-mail allow-list alone is not sufficient. Studio automatically provisions `OWNER` only after the listed Studio account has an OIDC or SAML identity linked. A password-only account is never promoted automatically from the e-mail allow-list.

After the initial owner exists, institution role management should happen through the institution administrator API/UI rather than by expanding the bootstrap list indefinitely.

## Administrator API

Authenticated institution administrators can use:

- `GET /api/auth/institutions/admin-context` — institutions for which the current user is `ADMIN` or `OWNER`.
- `GET /api/auth/institutions/:institutionId/members` — list organization members; requires `ADMIN` or `OWNER`.
- `PATCH /api/auth/institutions/:institutionId/members/:membershipId/role` — change member roles with owner-protection rules.

Institutional profile APIs remain account-scoped:

- `GET /api/auth/profiles/institutions`
- `POST /api/auth/profiles/institutions`
- `PATCH /api/auth/profiles/institutions/:profileId`
- `POST /api/auth/profiles/institutions/:profileId/default`
- `DELETE /api/auth/profiles/institutions/:profileId`

## Manuscript use

Institutional profiles are reusable account data, not manuscript metadata themselves. A manuscript or submission can later pin the institutional membership (or a snapshot of its institution/department/position data) used for a particular contribution without changing the author's personal account profile.

## Security and identity linking

An institutional membership may reference an external identity only when that identity belongs to the same Studio user and is OIDC or SAML. Disconnecting the external identity remains governed by **Connected identities** and its lockout protection.

Removing a membership does not delete the shared institution, Studio account, or external login identity. The final `OWNER` membership cannot be removed until another owner exists.
