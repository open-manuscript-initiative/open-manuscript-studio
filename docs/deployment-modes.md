# Studio deployment modes

Open Manuscript Studio uses one codebase and one set of desktop/mobile/web clients, with a server-side deployment profile deciding who manages external-service credentials.

## Personal

```dotenv
DEPLOYMENT_MODE=personal
```

Use for standalone author/user installations. The user-facing application should not ask for ORCID passwords. ORCID authentication always happens on ORCID's own authorization page through OAuth/OpenID Connect. In the mature Personal architecture, centrally managed OMI Identity credentials can broker this flow so individual authors do not need to register ORCID API credentials themselves.

## Institutional

```dotenv
DEPLOYMENT_MODE=institutional
```

Use for publishers, journals, universities, repositories and managed OJS/OMP environments. The organization can configure its own ORCID Public or Member API client and other organization-managed integrations. Secrets remain server-side.

The first implementation deliberately does not change ORCID credential routing yet: it establishes the deployment profile as a stable runtime contract while preserving the working ORCID flow. Credential-source selection can then be added without creating separate Studio binaries.

## Runtime visibility

`GET /api/auth/providers` includes:

```json
{
  "deployment": {
    "mode": "personal",
    "label": "Personal"
  }
}
```

The desktop/web footer reads the actual server value and displays `OMI Studio · Personal` or `OMI Studio · Institutional`. When ORCID is still using the Sandbox network, the footer also displays `ORCID Sandbox`. Production ORCID is intentionally not shown as a warning badge.

## Design constraints

- The deployment mode is server-controlled, never trusted from local browser state.
- Switching mode does not change document format or manuscript portability.
- ORCID passwords are never collected by Studio in either mode.
- Sandbox and production ORCID identities remain separated by issuer.
- A future Institutional administration screen may manage organization-owned integration settings, subject to role-based access control.
- A future Personal mode may route ORCID through OMI Identity while keeping the same front-end interaction.

## Production configuration example

For a publisher-hosted Studio instance:

```dotenv
NODE_ENV=production
DEPLOYMENT_MODE=institutional
ORCID_ENVIRONMENT=production
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_REDIRECT_URI=https://example.org/api/auth/orcid/callback
```

For the current ORCID Sandbox validation period, keep `ORCID_ENVIRONMENT=sandbox` even if the installation is already marked `institutional`.
