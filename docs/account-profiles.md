# Personal and institutional account profiles

Open Manuscript Studio separates the durable personal scholarly profile from organization-specific institutional profiles.

## Personal profile

The personal profile belongs to the individual Studio account and follows the user across devices. It contains personal scholarly identity and user preferences, including the account name, ORCID iD, biography, interface language, and time zone. Authentication identities are managed separately under Connected identities.

Institutional affiliation is not edited as part of the personal profile. Existing legacy affiliation fields remain available only as a compatibility shadow while older integrations are migrated.

## Institutional profiles

A Studio account can have zero, one, or many institutional profiles. Each institutional profile can contain:

- institution / organization name
- ROR identifier
- department or organizational unit
- position / role title
- institutional e-mail address
- an optional linked institutional OIDC/SAML identity
- a default flag

Institutional profiles are stored in the Identity database and therefore follow the signed-in account instead of the current device.

Only one institutional profile is treated as the default at a time. The default profile is also mirrored to the legacy `affiliation` and `affiliation_ror_id` fields so existing manuscript and integration code continues to work while it is migrated to explicit profile selection.

## Manuscript use

Institutional profiles are reusable account data, not manuscript metadata themselves. A manuscript or submission can later pin the institutional profile (or a snapshot of it) used for a particular contribution without changing the author's personal account profile.

## Security and identity linking

An institutional profile may reference an external identity only when that identity belongs to the same Studio user and is an institutional OIDC or SAML identity. ORCID remains a personal scholarly identifier and is not treated as an institutional profile credential.

Deleting an institutional profile does not delete the Studio account or the external identity. Disconnecting an external identity remains governed by Connected identities and its lockout protection.
