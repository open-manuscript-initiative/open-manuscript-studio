# Studio deployment modes

Open Manuscript Studio uses one codebase and one set of desktop/mobile/web clients, with a server-side deployment profile deciding who manages external-service credentials.

## Personal

```dotenv
DEPLOYMENT_MODE=personal
```

Use for standalone author/user installations. The user-facing application never asks for an ORCID password. ORCID authentication happens on ORCID's own authorization page through OAuth/OpenID Connect.

Personal mode reads the backward-compatible ORCID credential names:

```dotenv
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_REDIRECT_URI=https://studio.example.org/api/auth/orcid/callback
```

In the mature Personal architecture these credentials can be supplied by OMI Identity so individual authors do not need to register ORCID API clients themselves.

## Institutional

```dotenv
DEPLOYMENT_MODE=institutional
```

Use for publishers, journals, universities, repositories and managed OJS/OMP environments. Institutional mode has a separate credential namespace owned by the organization:

```dotenv
INSTITUTIONAL_ORCID_CLIENT_ID=APP-...
INSTITUTIONAL_ORCID_CLIENT_SECRET=...
INSTITUTIONAL_ORCID_REDIRECT_URI=https://publisher.example.org/api/auth/orcid/callback
INSTITUTIONAL_ORCID_API_TYPE=public
```

`INSTITUTIONAL_ORCID_API_TYPE` accepts `public` or `member`. The value describes the organization's ORCID integration profile; OAuth/OpenID Connect remains the authentication mechanism and Studio never receives the user's ORCID password.

## Credential isolation

Credential selection is server-side and deterministic:

- `DEPLOYMENT_MODE=personal` uses only `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET`, and `ORCID_REDIRECT_URI`.
- `DEPLOYMENT_MODE=institutional` uses only the `INSTITUTIONAL_ORCID_*` credential set.
- Switching to Institutional mode does **not** silently reuse Personal/OMI-owned credentials.
- If the active credential pair is missing, ORCID is reported as unconfigured and sign-in is disabled until the correct client is installed.
- A partial active credential pair is rejected during server startup.
- Secrets remain server-side and are never returned by the provider-status API.

The ORCID network is selected independently:

```dotenv
ORCID_ENVIRONMENT=sandbox
```

or:

```dotenv
ORCID_ENVIRONMENT=production
```

This allows an Institutional deployment to be tested safely against ORCID Sandbox before production credentials are activated.

## Runtime visibility

`GET /api/auth/providers` reports both deployment mode and non-secret ORCID credential metadata. Example:

```json
{
  "deployment": {
    "mode": "institutional",
    "label": "Institutional"
  },
  "providers": {
    "orcid": {
      "enabled": true,
      "environment": "sandbox",
      "credentialSource": "institutional",
      "apiType": "public"
    }
  }
}
```

The web, Windows and mobile clients display `OMI Studio · Personal` or `OMI Studio · Institutional` in the footer. When ORCID uses the Sandbox network, they also display `ORCID Sandbox`. Production ORCID is intentionally not shown as a warning badge.

## Design constraints

- The deployment mode is server-controlled, never trusted from local browser state.
- Switching mode does not change document format or manuscript portability.
- ORCID passwords are never collected by Studio in either mode.
- Sandbox and production ORCID identities remain separated by issuer.
- Credential ownership and ORCID network selection are separate concepts.
- An Institutional administration screen may later manage organization-owned integration settings subject to role-based access control; secrets must remain server-side.
- Personal mode may later route ORCID through OMI Identity while keeping the same front-end interaction.

## Production configuration examples

Personal/OMI-managed deployment:

```dotenv
NODE_ENV=production
DEPLOYMENT_MODE=personal
ORCID_ENVIRONMENT=production
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_REDIRECT_URI=https://studio.example.org/api/auth/orcid/callback
```

Publisher-hosted Institutional deployment:

```dotenv
NODE_ENV=production
DEPLOYMENT_MODE=institutional
ORCID_ENVIRONMENT=production
INSTITUTIONAL_ORCID_CLIENT_ID=APP-...
INSTITUTIONAL_ORCID_CLIENT_SECRET=...
INSTITUTIONAL_ORCID_REDIRECT_URI=https://publisher.example.org/api/auth/orcid/callback
INSTITUTIONAL_ORCID_API_TYPE=member
```
